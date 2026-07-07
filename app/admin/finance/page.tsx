import Link from "next/link";
import { getFinance, fmtILS, type MonthFin, type PaymentRow } from "@/lib/finance";
import { notionSyncHealth } from "@/lib/payments";
import { timeAgo } from "@/lib/dashboard";
import FinanceTabs from "@/components/admin/FinanceTabs";
import { syncFinance } from "../actions";
import { resyncNotionPaymentsAction } from "../invoice-actions";

export const dynamic = "force-dynamic";

const NOTION_TRACKER_URL = "https://www.notion.so/16c2487b8e7e805b9d9eff1fea9ef021";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const sum = (arr: MonthFin[], k: "income" | "expenses" | "expected") => arr.reduce((s, m) => s + m[k], 0);

function GrowthBadge({ now, prev }: { now: number; prev: number }) {
  if (prev <= 0) return null;
  const pct = Math.round(((now - prev) / prev) * 100);
  if (!Number.isFinite(pct)) return null;
  return (
    <span className={`lq-chip ${pct >= 0 ? "lq-chip--green" : "lq-chip--red"} !px-1.5 !py-0.5 !text-[10px] tabular-nums`}>
      {pct >= 0 ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  );
}

export default async function FinanceAdmin({ searchParams }: { searchParams: { ok?: string; year?: string; n?: string } }) {
  const f = await getFinance();
  // Health of the app→Notion payment mirror. When a write fails, the app used
  // to swallow the error silently — this surfaces it so a payment can never go
  // missing from Notion unnoticed again.
  const syncHealth = await notionSyncHealth();

  // Years with any activity, newest first; the current year always selectable.
  const yearSet = new Set(f.monthly.map((m) => m.ym.slice(0, 4)));
  yearSet.add(String(new Date().getFullYear()));
  const years = Array.from(yearSet).sort().reverse();
  const year = years.includes(searchParams.year || "") ? (searchParams.year as string) : years[0];

  const byYm = new Map(f.monthly.map((m) => [m.ym, m]));
  const months: MonthFin[] = Array.from({ length: 12 }, (_, i) => {
    const ym = `${year}-${String(i + 1).padStart(2, "0")}`;
    return byYm.get(ym) || { ym, income: 0, expenses: 0, expected: 0 };
  });
  const nowYm = new Date().toISOString().slice(0, 7);

  const yearOf = (y: string) => f.monthly.filter((m) => m.ym.startsWith(`${y}-`));
  const income = sum(months, "income");
  const expenses = sum(months, "expenses");
  const open = sum(months, "expected");
  const net = income - expenses;
  const prev = yearOf(String(Number(year) - 1));
  const prevIncome = sum(prev, "income");
  const prevExpenses = sum(prev, "expenses");

  const chartMax = Math.max(1, ...months.map((m) => Math.max(m.income, m.expenses)));
  const bestMonth = months.reduce((best, m) => (m.income > best.income ? m : best), months[0]);

  // Payments of the selected year, grouped by month (newest month first —
  // payments inside a month are already newest-first from the lib).
  const paymentMonths: { ym: string; rows: PaymentRow[]; total: number }[] = [];
  for (const p of f.payments.filter((p) => p.payDate.startsWith(`${year}-`))) {
    const ym = p.payDate.slice(0, 7);
    let g = paymentMonths[paymentMonths.length - 1];
    if (!g || g.ym !== ym) {
      g = { ym, rows: [], total: 0 };
      paymentMonths.push(g);
    }
    g.rows.push(p);
    g.total += p.ilsTotal;
  }

  // Year-over-year overview rows.
  const yearRows = years.map((y) => {
    const ms = yearOf(y);
    return { y, income: sum(ms, "income"), expenses: sum(ms, "expenses"), months: ms.length };
  });
  const maxYearIncome = Math.max(1, ...yearRows.map((r) => r.income));

  // Clients who still owe money — the studio's debt picture from the tracker,
  // highest balance first. This is the "what's left to pay" view.
  const owing = f.debtors.filter((d) => d.debt > 0);

  return (
    <div className="space-y-5">
      <FinanceTabs />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-display font-bold uppercase tracking-[0.14em] text-charcoal-60">Studio money</p>
          <h1 className="font-display font-extrabold text-[28px] tracking-tight text-ink leading-tight mt-1">Finance</h1>
          {f.available ? (
            <>
              {/* The answer up top — one sentence, each segment jumps to its zone. */}
              <p className="text-[15px] leading-relaxed text-charcoal-80 mt-1.5">
                <a href="#position" className="font-semibold text-ink hover:text-orange-deep no-underline">{fmtILS(f.bankTotal)} in the bank</a>
                <span className="text-charcoal-40"> · </span>
                <a href="#position" className="font-semibold text-ink hover:text-orange-deep no-underline">{fmtILS(f.totalDebt)} owed by clients</a>
                <span className="text-charcoal-40"> · </span>
                {f.overdue.length > 0 ? (
                  <a href="#position" className="font-semibold text-rose-600 hover:text-rose-700 no-underline">
                    {f.overdue.length} overdue · {fmtILS(f.overdueTotal)}
                  </a>
                ) : (
                  <span className="font-semibold text-emerald-700">nothing past due</span>
                )}
              </p>
              <p className="text-xs text-charcoal-40 mt-1">
                Live from the Notion Budget Tracker{f.syncedAt ? ` · synced ${timeAgo(f.syncedAt)}` : ""}
              </p>
            </>
          ) : (
            <p className="text-sm text-charcoal-60 mt-0.5">Money through time — live from the Notion Budget Tracker</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <a href={NOTION_TRACKER_URL} target="_blank" rel="noreferrer" className="lq-btn lq-btn--ghost no-underline">
            Open in Notion ↗
          </a>
          <form action={resyncNotionPaymentsAction} title="Push any recorded payments that haven't reached Notion yet">
            <button className="lq-btn lq-btn--glass">Re-sync payments</button>
          </form>
          <form action={syncFinance}>
            <button className="lq-btn lq-btn--dark">Sync now</button>
          </form>
        </div>
      </header>

      {searchParams.ok === "synced" && (
        <p className="lq-card text-sm text-emerald-800 px-4 py-3 !border-emerald-300/40">Synced fresh numbers from Notion.</p>
      )}
      {searchParams.ok === "resynced" && (
        <p className="lq-card text-sm text-emerald-800 px-4 py-3 !border-emerald-300/40">
          {Number(searchParams.n) > 0
            ? `Tried to re-push ${searchParams.n} payment${searchParams.n === "1" ? "" : "s"} to Notion — if any are still listed in the red box below, the exact error is shown there.`
            : "No pending payments were found to push. If payments are still missing from Notion, they may be wrongly marked as synced — tell me and I'll dig in."}
        </p>
      )}

      {/* Payment→Notion sync health — loud, never silent. When a write to the
          Notion Income DB fails, the app records it here so it can't go unnoticed. */}
      {syncHealth.pending > 0 && (
        <div className="lq-card lq-rise !border-rose-300/50 px-5 py-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 w-6 h-6 shrink-0 rounded-full bg-rose-500/15 text-rose-700 flex items-center justify-center text-sm font-bold">!</span>
              <div>
                <h2 className="font-display font-bold text-[16px] tracking-tight text-rose-900">
                  {syncHealth.pending} payment{syncHealth.pending === 1 ? "" : "s"} haven&apos;t reached Notion
                </h2>
                <p className="text-sm text-rose-800 mt-0.5">
                  {[
                    syncHealth.ils > 0 ? `${fmtILS(syncHealth.ils)}` : "",
                    syncHealth.usd > 0 ? `$${syncHealth.usd.toLocaleString("en-US")}` : "",
                  ].filter(Boolean).join(" + ")}{" "}
                  recorded in the app but not written to the Notion Income database
                  {syncHealth.oldestPaidOn ? ` (since ${syncHealth.oldestPaidOn})` : ""}. They&apos;re saved
                  safely here — they just haven&apos;t mirrored across.
                </p>
                {syncHealth.lastError && (
                  <p className="mt-2 text-xs text-rose-700">
                    <span className="font-semibold">What Notion said:</span>{" "}
                    <code className="font-mono bg-rose-500/10 px-1.5 py-0.5 rounded break-all">{syncHealth.lastError}</code>
                  </p>
                )}
                <p className="mt-2 text-xs text-rose-700/90">
                  This usually means the app&apos;s Notion connection lost <b>edit</b> access to the Income
                  database. In Notion → Settings → Connections, confirm the integration can edit the Budget
                  Tracker, then re-sync below.
                </p>
              </div>
            </div>
            <form action={resyncNotionPaymentsAction} className="shrink-0">
              <button className="lq-btn lq-btn--danger whitespace-nowrap">Re-sync now</button>
            </form>
          </div>
        </div>
      )}

      {f.available && f.diag && (
        <p className="lq-card text-sm text-amber-800 px-4 py-3 !border-amber-300/40">{f.diag}</p>
      )}

      {!f.available ? (
        <div className="lq-card p-8 text-center">
          <p className="lq-chip lq-chip--orange !text-sm !px-4 !py-3">
            {f.error || "Notion isn't connected."}
          </p>
          <p className="text-sm text-charcoal-60 mt-4 max-w-md mx-auto">
            Set <code className="font-mono text-xs bg-charcoal/5 px-1.5 py-0.5 rounded">NOTION_TOKEN</code> and share the Budget
            Tracker page with the integration — the monthly and yearly analysis will appear here.
          </p>
        </div>
      ) : (
        <>
          {/* ---- Zone 1 — Position: where the money sits today ---- */}
          <section id="position" className="lq-card lq-rise p-5 sm:p-6">
            <h2 className="font-display font-bold text-[16px] tracking-tight text-ink">Position — today</h2>

            {/* Lead figures — the bank balance dominates; owed and overdue read beside it. */}
            <div className="flex flex-wrap items-end gap-x-10 gap-y-4 mt-3">
              <div className="min-w-0">
                <div className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-charcoal-60">In the bank</div>
                <div className="mt-1.5 font-display font-extrabold text-[38px] sm:text-[44px] leading-none tracking-tight tabular-nums text-ink">{fmtILS(f.bankTotal)}</div>
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-charcoal-60">Clients owe us</div>
                <div className="mt-1.5 font-display font-extrabold text-[24px] leading-none tracking-tight tabular-nums text-orange-deep">{fmtILS(f.totalDebt)}</div>
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-charcoal-60">Overdue</div>
                <div className={`mt-1.5 font-display font-extrabold text-[24px] leading-none tracking-tight tabular-nums ${f.overdue.length ? "text-rose-600" : "text-ink"}`}>
                  {f.overdue.length ? `${f.overdue.length} · ${fmtILS(f.overdueTotal)}` : "None"}
                </div>
              </div>
            </div>

            {/* Accounts — quiet inline facts, not tiles. */}
            <div className="mt-4 pt-4 border-t border-charcoal/5 flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-charcoal-60">
              {f.banks.length === 0 ? (
                <span>No accounts in the tracker.</span>
              ) : (
                f.banks.map((b) => (
                  <span key={b.name}>
                    {b.name}{" "}
                    <b className={`tabular-nums ${b.balance < 0 ? "text-rose-600" : "text-charcoal-80"}`}>{fmtILS(b.balance)}</b>
                  </span>
                ))
              )}
            </div>

            {/* What clients still owe — debtor bars inline, same surface. */}
            <div className="mt-5 pt-5 border-t border-charcoal/5">
              <div className="flex items-center justify-between gap-4 flex-wrap mb-1">
                <h3 className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-charcoal-60">What clients still owe</h3>
                {owing.length > 0 && (
                  <span className="text-xs text-charcoal-40 tabular-nums">
                    {owing.length} client{owing.length === 1 ? "" : "s"} · {fmtILS(f.totalDebt)} left
                  </span>
                )}
              </div>
              <p className="text-xs text-charcoal-60 mb-3">
                Outstanding balance per client, largest first — what&apos;s paid and what&apos;s left, so you can see it here instead of in Notion.
              </p>
            {owing.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <span className="w-9 h-9 rounded-full bg-emerald-500/15 text-emerald-700 flex items-center justify-center">✓</span>
                <p className="text-sm text-charcoal-60">Everyone&apos;s paid up — no outstanding balances.</p>
              </div>
            ) : (
              <ul className="divide-y divide-charcoal/5 lq-stagger">
                {owing.map((d, i) => {
                  const behLabel =
                    d.behavior === "on-time" ? "always on time"
                    : d.behavior === "mostly-on-time" ? "mostly on time"
                    : d.behavior === "often-late" ? `often late · ~${d.avgDelayDays}d` : "";
                  const behClass =
                    d.behavior === "on-time" ? "lq-chip--green"
                    : d.behavior === "mostly-on-time" ? "lq-chip--orange"
                    : "lq-chip--red";
                  return (
                    <li key={d.sourceId} className="py-3 flex items-center gap-4 flex-wrap" style={{ "--i": i } as React.CSSProperties}>
                      <div className="flex-1 min-w-[200px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-ink truncate">{d.name}</span>
                          {behLabel && (
                            <span className={`lq-chip ${behClass} !px-2 !py-0.5 !text-[10px] whitespace-nowrap`}>{behLabel}</span>
                          )}
                        </div>
                        <div className="mt-1.5 h-2 rounded-full bg-charcoal/5 overflow-hidden max-w-xs">
                          <div className="h-full rounded-full bg-orange" style={{ width: `${Math.max(2, d.paidPct)}%` }} />
                        </div>
                        <div className="mt-1 text-[11px] text-charcoal-60 tabular-nums">
                          {d.paidPct}% paid
                          {d.lastPaymentDate ? ` · last paid ${new Date(d.lastPaymentDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}` : ""}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="tabular-nums font-display text-lg font-extrabold text-orange-deep">{fmtILS(d.debt)}</div>
                        <div className="text-[11px] text-charcoal-40">still to pay</div>
                      </div>
                      {d.clientSlug ? (
                        <div className="flex items-center gap-2">
                          <Link href={`/admin/invoices`} className="text-xs font-semibold text-charcoal-60 hover:text-orange-deep whitespace-nowrap no-underline">Invoice →</Link>
                          <Link href={`/admin/clients/${d.clientSlug}/edit`} className="text-xs font-semibold text-charcoal-40 hover:text-orange-deep no-underline">Client →</Link>
                        </div>
                      ) : d.notionUrl ? (
                        <a href={d.notionUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-charcoal-40 hover:text-orange-deep no-underline">Notion ↗</a>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
            </div>

            {/* Overdue detail — only rendered when something is actually past due;
                the lead figure above already answers the quiet case. */}
            {f.overdue.length > 0 && (
              <div className="mt-5 pt-5 border-t border-charcoal/5">
                <h3 className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-charcoal-60 mb-1">Overdue right now</h3>
                <ul className="divide-y divide-charcoal/5">
                  {f.overdue.slice(0, 7).map((o, i) => (
                    <li key={i} className="py-2.5 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-ink truncate">{o.sourceName || o.name}</div>
                        <div className="text-[11px] text-charcoal-60 truncate">due {o.dueDate}</div>
                      </div>
                      <span className="tabular-nums text-sm font-bold text-ink">{o.amountLabel}</span>
                      <span className="lq-chip lq-chip--red !px-2 !py-0.5 !text-[10px] whitespace-nowrap">{o.daysOverdue}d</span>
                      {o.clientSlug && (
                        <Link href={`/admin/clients/${o.clientSlug}/edit`} className="text-xs font-semibold text-charcoal-40 hover:text-orange-deep no-underline">→</Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* ---- Zone 2 — Flow: money through the months ---- */}
          <section id="flow" className="lq-card lq-rise p-5 sm:p-6" style={{ animationDelay: "90ms" }}>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <h2 className="font-display font-bold text-[16px] tracking-tight text-ink">Flow — {year}</h2>
              <div className="lq-seg flex-wrap">
                {years.map((y) => (
                  <Link
                    key={y}
                    href={`/admin/finance?year=${y}`}
                    className={`lq-seg__opt no-underline tabular-nums ${y === year ? "is-on" : ""}`}
                  >
                    {y}
                  </Link>
                ))}
              </div>
            </div>

            {/* Collected · spent · net — one divided strip, growth beside each figure. */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-0 mt-4">
              <div className="min-w-0 sm:pe-5">
                <div className="flex items-center gap-2">
                  <div className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-charcoal-60">Collected in {year}</div>
                  <GrowthBadge now={income} prev={prevIncome} />
                </div>
                <div className="mt-1 font-display font-extrabold text-[26px] tracking-tight tabular-nums text-ink">{fmtILS(income)}</div>
                <div className="mt-0.5 text-xs text-charcoal-60">{prevIncome > 0 ? `${fmtILS(prevIncome)} in ${Number(year) - 1}` : "no prior-year data"}</div>
              </div>
              <div className="min-w-0 sm:border-s sm:border-charcoal/5 sm:ps-5 sm:pe-5">
                <div className="flex items-center gap-2">
                  <div className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-charcoal-60">Spent in {year}</div>
                  <GrowthBadge now={expenses} prev={prevExpenses} />
                </div>
                <div className="mt-1 font-display font-extrabold text-[26px] tracking-tight tabular-nums text-ink">{fmtILS(expenses)}</div>
                <div className="mt-0.5 text-xs text-charcoal-60">{prevExpenses > 0 ? `${fmtILS(prevExpenses)} in ${Number(year) - 1}` : "expenses, all categories"}</div>
              </div>
              <div className="min-w-0 sm:border-s sm:border-charcoal/5 sm:ps-5">
                <div className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-charcoal-60">Net {year}</div>
                <div className={`mt-1 font-display font-extrabold text-[26px] tracking-tight tabular-nums ${net >= 0 ? "text-emerald-700" : "text-rose-600"}`}>{fmtILS(net)}</div>
                <div className="mt-0.5 text-xs text-charcoal-60">{open > 0 ? `+ ${fmtILS(open)} still open (unpaid dues)` : "everything due is collected"}</div>
              </div>
            </div>

            {/* Month-by-month bars, under a hairline on the same surface. */}
            <div className="mt-5 pt-5 border-t border-charcoal/5">
              <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
                <h3 className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-charcoal-60">Cashflow, month by month</h3>
                <div className="flex items-center gap-3 text-[11px] text-charcoal-60">
                  <span className="inline-flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-orange inline-block" /> in</span>
                  <span className="inline-flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-charcoal-20 inline-block" /> out</span>
                </div>
              </div>
              <div className="grid grid-cols-12 gap-1.5 sm:gap-2 items-end h-44">
                {months.map((m, i) => {
                  const future = m.ym > nowYm;
                  const inH = Math.round((m.income / chartMax) * 100);
                  const outH = Math.round((m.expenses / chartMax) * 100);
                  return (
                    <div
                      key={m.ym}
                      className={`flex flex-col items-center gap-1.5 h-full justify-end ${future ? "opacity-35" : ""}`}
                      title={`${MONTHS[i]} ${year}: in ${fmtILS(m.income)} · out ${fmtILS(m.expenses)} · net ${fmtILS(m.income - m.expenses)}${m.expected ? ` · open ${fmtILS(m.expected)}` : ""}`}
                    >
                      <div className="relative w-full h-full flex items-end justify-center gap-[2px]">
                        <div className="adm-bar w-1/2 rounded-t-sm bg-gradient-to-t from-[#F57F00] to-[#FFA226]" style={{ height: `${Math.max(m.income > 0 ? 3 : 0, inH)}%`, animationDelay: `${280 + i * 45}ms` }} />
                        <div className="adm-bar w-1/2 rounded-t-sm bg-charcoal-20" style={{ height: `${Math.max(m.expenses > 0 ? 3 : 0, outH)}%`, animationDelay: `${320 + i * 45}ms` }} />
                      </div>
                      <span className={`text-[10px] font-semibold ${m.ym === nowYm ? "text-orange-deep" : "text-charcoal-60"}`}>{MONTHS[i]}</span>
                    </div>
                  );
                })}
              </div>
              {bestMonth.income > 0 && (
                <p className="mt-3 text-xs text-charcoal-60">
                  Best month: <b className="text-charcoal-80">{MONTHS[Number(bestMonth.ym.slice(5)) - 1]}</b> with {fmtILS(bestMonth.income)} collected.
                </p>
              )}
            </div>

            {/* Year over year — the longer arc, same surface. */}
            {yearRows.filter((r) => r.income || r.expenses).length > 1 && (
              <div className="mt-5 pt-5 border-t border-charcoal/5">
                <h3 className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-charcoal-60 mb-3">Year over year</h3>
                <ul className="space-y-3">
                  {yearRows.map((r, i) => {
                    const prevR = yearRows[i + 1];
                    const rNet = r.income - r.expenses;
                    return (
                      <li key={r.y}>
                        <div className="flex items-center gap-3 text-sm flex-wrap">
                          <Link href={`/admin/finance?year=${r.y}`} className={`font-bold tabular-nums no-underline ${r.y === year ? "text-orange-deep" : "text-ink hover:text-orange-deep"}`}>
                            {r.y}
                          </Link>
                          {prevR && <GrowthBadge now={r.income} prev={prevR.income} />}
                          <span className="flex-1" />
                          <span className="tabular-nums text-charcoal-60">in <b className="text-ink">{fmtILS(r.income)}</b></span>
                          <span className="tabular-nums text-charcoal-60">out <b className="text-charcoal-80">{fmtILS(r.expenses)}</b></span>
                          <span className={`tabular-nums font-bold ${rNet >= 0 ? "text-emerald-700" : "text-rose-600"}`}>net {fmtILS(rNet)}</span>
                        </div>
                        <div className="mt-1.5 h-2 rounded-full bg-charcoal/5 overflow-hidden">
                          <div
                            className="adm-bar h-full rounded-full bg-orange"
                            style={{ width: `${Math.max(2, Math.round((r.income / maxYearIncome) * 100))}%`, animationDelay: `${460 + i * 60}ms` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>

          {/* ---- Zone 3 — Detail: every payment and the monthly ledger, one surface ---- */}
          <section className="lq-card lq-rise p-5 sm:p-6" style={{ animationDelay: "180ms" }}>
            <h2 className="font-display font-bold text-[16px] tracking-tight text-ink">The detail — {year}</h2>

            <div className="flex items-center justify-between gap-4 flex-wrap mt-4 mb-1">
              <h3 className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-charcoal-60">Payments received</h3>
              {paymentMonths.length > 0 && (
                <span className="text-xs text-charcoal-40 tabular-nums">
                  {paymentMonths.reduce((n, g) => n + g.rows.length, 0)} payments · {fmtILS(paymentMonths.reduce((s, g) => s + g.total, 0))}
                </span>
              )}
            </div>
            <p className="text-xs text-charcoal-60 mb-3">Every payment received, newest first. The current month is open — tap a month to expand it.</p>
            {paymentMonths.length === 0 ? (
              <p className="text-sm text-charcoal-40 py-6 text-center">No payments recorded in {year} yet.</p>
            ) : (
              <div className="divide-y divide-charcoal/5">
                {paymentMonths.map((g, gi) => (
                  <details key={g.ym} open={gi === 0} className="group">
                    <summary className="flex items-center gap-3 py-2.5 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden hover:bg-white/60 rounded-lg -mx-1 px-1">
                      <span className="text-charcoal-20 text-xs transition-transform group-open:rotate-90">▶</span>
                      <span className="font-display font-bold text-ink">
                        {MONTHS[Number(g.ym.slice(5)) - 1]} {g.ym.slice(0, 4)}
                      </span>
                      <span className="text-xs text-charcoal-40 tabular-nums">
                        {g.rows.length} payment{g.rows.length === 1 ? "" : "s"}
                      </span>
                      <span className="ml-auto tabular-nums font-bold text-emerald-700">{fmtILS(g.total)}</span>
                    </summary>
                    <ul className="pb-3 ps-6 divide-y divide-charcoal/5">
                      {g.rows.map((p, i) => (
                        <li key={i} className="py-2 flex items-center gap-3 flex-wrap">
                          <div className="flex-1 min-w-[160px]">
                            <div className="text-sm font-semibold text-ink truncate">{p.sourceName || p.name}</div>
                            <div className="text-[11px] text-charcoal-60 truncate">
                              {p.sourceName && p.name !== p.sourceName ? `${p.name} · ` : ""}
                              paid {new Date(p.payDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                            </div>
                          </div>
                          {p.daysLate > 3 && (
                            <span className="lq-chip lq-chip--red !px-2 !py-0.5 !text-[10px] whitespace-nowrap">
                              {p.daysLate}d late
                            </span>
                          )}
                          <div className="text-right">
                            <span className="tabular-nums text-sm font-bold text-ink">{p.amountLabel}</span>
                            {p.usd > 0 && p.ils > 0 && (
                              <div className="text-[10px] text-charcoal-40 tabular-nums">≈ {fmtILS(p.ilsTotal)} total</div>
                            )}
                          </div>
                          {p.clientSlug ? (
                            <Link href={`/admin/clients/${p.clientSlug}/edit`} className="text-xs font-semibold text-charcoal-40 hover:text-orange-deep no-underline">→</Link>
                          ) : p.notionUrl ? (
                            <a href={p.notionUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-charcoal-20 hover:text-orange-deep no-underline">↗</a>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
            )}

            {/* The ledger — under a hairline, same surface. */}
            <div className="mt-5 pt-5 border-t border-charcoal/5">
              <h3 className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-charcoal-60 mb-1">The ledger</h3>
              <p className="text-xs text-charcoal-60 mb-4">Collected, spent and net per month, with the running total for the year. Open = invoiced/due that month, not paid yet.</p>
              <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="text-left text-[10px] font-display font-bold uppercase tracking-[0.12em] text-charcoal-60 border-b border-charcoal/5">
                    <th className="py-2 pe-4">Month</th>
                    <th className="py-2 pe-4 text-right">Collected</th>
                    <th className="py-2 pe-4 text-right">Open</th>
                    <th className="py-2 pe-4 text-right">Spent</th>
                    <th className="py-2 pe-4 text-right">Net</th>
                    <th className="py-2 text-right">Running net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal/5">
                  {(() => {
                    let running = 0;
                    return months.map((m, i) => {
                      const mNet = m.income - m.expenses;
                      running += mNet;
                      const future = m.ym > nowYm;
                      const isNow = m.ym === nowYm;
                      const empty = !m.income && !m.expenses && !m.expected;
                      return (
                        <tr key={m.ym} className={`${isNow ? "bg-orange/5" : "hover:bg-white/60"} ${future ? "opacity-40" : ""}`}>
                          <td className="py-2.5 pe-4 font-semibold text-ink">
                            {MONTHS[i]} {isNow && <span className="ms-1.5 text-[10px] font-bold uppercase tracking-wide text-orange-deep">now</span>}
                            {m.ym === bestMonth.ym && bestMonth.income > 0 && (
                              <span className="lq-chip lq-chip--green !px-1.5 !py-0.5 !text-[10px] uppercase tracking-wide ms-1.5">best</span>
                            )}
                          </td>
                          <td className="py-2.5 pe-4 text-right tabular-nums font-semibold text-ink">{empty && !m.income ? "—" : fmtILS(m.income)}</td>
                          <td className={`py-2.5 pe-4 text-right tabular-nums ${m.expected ? "text-orange-deep font-semibold" : "text-charcoal-20"}`}>
                            {m.expected ? fmtILS(m.expected) : "—"}
                          </td>
                          <td className="py-2.5 pe-4 text-right tabular-nums text-charcoal-60">{m.expenses ? fmtILS(m.expenses) : "—"}</td>
                          <td className={`py-2.5 pe-4 text-right tabular-nums font-semibold ${mNet > 0 ? "text-emerald-700" : mNet < 0 ? "text-rose-600" : "text-charcoal-20"}`}>
                            {mNet === 0 ? "—" : fmtILS(mNet)}
                          </td>
                          <td className={`py-2.5 text-right tabular-nums font-bold ${running >= 0 ? "text-ink" : "text-rose-600"}`}>{fmtILS(running)}</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-charcoal/10">
                    <td className="py-2.5 pe-4 font-bold text-ink">Total {year}</td>
                    <td className="py-2.5 pe-4 text-right tabular-nums font-bold text-ink">{fmtILS(income)}</td>
                    <td className="py-2.5 pe-4 text-right tabular-nums font-bold text-orange-deep">{open ? fmtILS(open) : "—"}</td>
                    <td className="py-2.5 pe-4 text-right tabular-nums font-bold text-charcoal-80">{fmtILS(expenses)}</td>
                    <td className={`py-2.5 pe-4 text-right tabular-nums font-bold ${net >= 0 ? "text-emerald-700" : "text-rose-600"}`}>{fmtILS(net)}</td>
                    <td className="py-2.5" />
                  </tr>
                </tfoot>
              </table>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
