import Link from "next/link";
import { getFinance, fmtILS, type MonthFin, type PaymentRow } from "@/lib/finance";
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
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
        pct >= 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"
      }`}
    >
      {pct >= 0 ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  );
}

export default async function FinanceAdmin({ searchParams }: { searchParams: { ok?: string; year?: string } }) {
  const f = await getFinance();

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
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Finance</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Money through time — live from the Notion Budget Tracker
            {f.syncedAt ? <span className="text-neutral-400"> · synced {timeAgo(f.syncedAt)}</span> : null}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a href={NOTION_TRACKER_URL} target="_blank" rel="noreferrer" className="text-sm font-medium text-neutral-500 hover:text-neutral-900">
            Open in Notion ↗
          </a>
          <form action={resyncNotionPaymentsAction} title="Push any recorded payments that haven't reached Notion yet">
            <button className="border border-neutral-300 text-neutral-700 text-sm font-semibold rounded-md px-4 py-2 hover:bg-neutral-50 transition-colors">Re-sync payments</button>
          </form>
          <form action={syncFinance}>
            <button className="bg-charcoal text-white text-sm font-semibold rounded-md px-4 py-2 hover:bg-ink transition-colors">Sync now</button>
          </form>
        </div>
      </div>

      {searchParams.ok === "synced" && (
        <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-md px-4 py-2.5">Synced fresh numbers from Notion.</p>
      )}
      {searchParams.ok === "resynced" && (
        <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-md px-4 py-2.5">Re-pushed any payments that weren&apos;t in Notion yet.</p>
      )}
      {f.available && f.diag && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-4 py-2.5">{f.diag}</p>
      )}

      {!f.available ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center">
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-4 py-3 inline-block">
            {f.error || "Notion isn't connected."}
          </p>
          <p className="text-sm text-neutral-500 mt-4 max-w-md mx-auto">
            Set <code className="font-mono text-xs bg-neutral-100 px-1.5 py-0.5 rounded">NOTION_TOKEN</code> and share the Budget
            Tracker page with the integration — the monthly and yearly analysis will appear here.
          </p>
        </div>
      ) : (
        <>
          {/* ---- Year selector ---- */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {years.map((y) => (
              <Link
                key={y}
                href={`/admin/finance?year=${y}`}
                className={`rounded-full px-3.5 py-1.5 text-sm font-bold tabular-nums transition-colors ${
                  y === year ? "bg-charcoal text-white" : "bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-400"
                }`}
              >
                {y}
              </Link>
            ))}
          </div>

          {/* ---- KPI row for the selected year ---- */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="adm-rise bg-charcoal text-white rounded-xl px-5 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-white/60">In the bank · today</div>
              <div className="mt-2 text-3xl font-extrabold tracking-tight tabular-nums text-orange">{fmtILS(f.bankTotal)}</div>
              <div className="mt-1 text-xs text-white/60">
                {f.banks.length} account{f.banks.length === 1 ? "" : "s"} · {fmtILS(f.totalDebt)} still owed by clients
              </div>
            </div>
            <div className="adm-rise bg-white border border-neutral-200 rounded-xl px-5 py-4" style={{ animationDelay: "60ms" }}>
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Collected in {year}</div>
                <GrowthBadge now={income} prev={prevIncome} />
              </div>
              <div className="mt-2 text-3xl font-extrabold tracking-tight tabular-nums text-neutral-900">{fmtILS(income)}</div>
              <div className="mt-1 text-xs text-neutral-500">{prevIncome > 0 ? `${fmtILS(prevIncome)} in ${Number(year) - 1}` : "no prior-year data"}</div>
            </div>
            <div className="adm-rise bg-white border border-neutral-200 rounded-xl px-5 py-4" style={{ animationDelay: "120ms" }}>
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Spent in {year}</div>
                <GrowthBadge now={expenses} prev={prevExpenses} />
              </div>
              <div className="mt-2 text-3xl font-extrabold tracking-tight tabular-nums text-neutral-900">{fmtILS(expenses)}</div>
              <div className="mt-1 text-xs text-neutral-500">{prevExpenses > 0 ? `${fmtILS(prevExpenses)} in ${Number(year) - 1}` : "expenses, all categories"}</div>
            </div>
            <div className="adm-rise bg-white border border-neutral-200 rounded-xl px-5 py-4" style={{ animationDelay: "180ms" }}>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Net {year}</div>
              <div className={`mt-2 text-3xl font-extrabold tracking-tight tabular-nums ${net >= 0 ? "text-green-700" : "text-red-600"}`}>
                {fmtILS(net)}
              </div>
              <div className="mt-1 text-xs text-neutral-500">{open > 0 ? `+ ${fmtILS(open)} still open (unpaid dues)` : "everything due is collected"}</div>
            </div>
          </div>

          {/* ---- What clients still owe — the "money left" picture ---- */}
          <div className="adm-rise bg-white border border-neutral-200 rounded-xl p-5" style={{ animationDelay: "210ms" }}>
            <div className="flex items-center justify-between gap-4 flex-wrap mb-1">
              <h2 className="font-bold tracking-tight">What clients still owe</h2>
              {owing.length > 0 && (
                <span className="text-xs text-neutral-400 tabular-nums">
                  {owing.length} client{owing.length === 1 ? "" : "s"} · {fmtILS(f.totalDebt)} left
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-500 mb-3">
              Outstanding balance per client, largest first — what&apos;s paid and what&apos;s left, so you can see it here instead of in Notion.
            </p>
            {owing.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <span className="w-9 h-9 rounded-full bg-green-100 text-green-700 flex items-center justify-center">✓</span>
                <p className="text-sm text-neutral-500">Everyone&apos;s paid up — no outstanding balances.</p>
              </div>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {owing.map((d) => {
                  const behLabel =
                    d.behavior === "on-time" ? "always on time"
                    : d.behavior === "mostly-on-time" ? "mostly on time"
                    : d.behavior === "often-late" ? `often late · ~${d.avgDelayDays}d` : "";
                  const behClass =
                    d.behavior === "on-time" ? "bg-green-100 text-green-800"
                    : d.behavior === "mostly-on-time" ? "bg-amber-100 text-amber-800"
                    : "bg-red-100 text-red-700";
                  return (
                    <li key={d.sourceId} className="py-3 flex items-center gap-4 flex-wrap">
                      <div className="flex-1 min-w-[200px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-neutral-900 truncate">{d.name}</span>
                          {behLabel && (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${behClass}`}>{behLabel}</span>
                          )}
                        </div>
                        <div className="mt-1.5 h-2 rounded-full bg-neutral-100 overflow-hidden max-w-xs">
                          <div className="h-full rounded-full bg-orange" style={{ width: `${Math.max(2, d.paidPct)}%` }} />
                        </div>
                        <div className="mt-1 text-[11px] text-neutral-500 tabular-nums">
                          {d.paidPct}% paid
                          {d.lastPaymentDate ? ` · last paid ${new Date(d.lastPaymentDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}` : ""}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="tabular-nums text-lg font-extrabold text-orange-deep">{fmtILS(d.debt)}</div>
                        <div className="text-[11px] text-neutral-400">still to pay</div>
                      </div>
                      {d.clientSlug ? (
                        <div className="flex items-center gap-2">
                          <Link href={`/admin/invoices`} className="text-xs font-semibold text-neutral-500 hover:text-orange whitespace-nowrap">Invoice →</Link>
                          <Link href={`/admin/clients/${d.clientSlug}/edit`} className="text-xs font-semibold text-neutral-400 hover:text-orange">Client →</Link>
                        </div>
                      ) : d.notionUrl ? (
                        <a href={d.notionUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-neutral-300 hover:text-orange">Notion ↗</a>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* ---- Monthly cashflow chart + overdue/banks ---- */}
          <div className="grid lg:grid-cols-5 gap-4">
            <div className="adm-rise lg:col-span-3 bg-white border border-neutral-200 rounded-xl p-5" style={{ animationDelay: "240ms" }}>
              <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
                <h2 className="font-bold tracking-tight">Cashflow — {year}, month by month</h2>
                <div className="flex items-center gap-3 text-[11px] text-neutral-500">
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
                        <div className="adm-bar w-1/2 rounded-t-sm bg-orange" style={{ height: `${Math.max(m.income > 0 ? 3 : 0, inH)}%`, animationDelay: `${280 + i * 45}ms` }} />
                        <div className="adm-bar w-1/2 rounded-t-sm bg-charcoal-20" style={{ height: `${Math.max(m.expenses > 0 ? 3 : 0, outH)}%`, animationDelay: `${320 + i * 45}ms` }} />
                      </div>
                      <span className={`text-[10px] font-semibold ${m.ym === nowYm ? "text-orange-deep" : "text-neutral-500"}`}>{MONTHS[i]}</span>
                    </div>
                  );
                })}
              </div>
              {bestMonth.income > 0 && (
                <p className="mt-3 text-xs text-neutral-500">
                  Best month: <b className="text-neutral-800">{MONTHS[Number(bestMonth.ym.slice(5)) - 1]}</b> with {fmtILS(bestMonth.income)} collected.
                </p>
              )}
            </div>

            <div className="adm-rise lg:col-span-2 space-y-4" style={{ animationDelay: "300ms" }}>
              <div className="bg-white border border-neutral-200 rounded-xl p-5">
                <h2 className="font-bold tracking-tight mb-3">Overdue right now</h2>
                {f.overdue.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-5 text-center">
                    <span className="w-9 h-9 rounded-full bg-green-100 text-green-700 flex items-center justify-center">✓</span>
                    <p className="text-sm text-neutral-500">Nothing past due.</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-neutral-100">
                    {f.overdue.slice(0, 7).map((o, i) => (
                      <li key={i} className="py-2.5 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-neutral-900 truncate">{o.sourceName || o.name}</div>
                          <div className="text-[11px] text-neutral-500 truncate">due {o.dueDate}</div>
                        </div>
                        <span className="tabular-nums text-sm font-bold text-neutral-900">{o.amountLabel}</span>
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700 whitespace-nowrap">{o.daysOverdue}d</span>
                        {o.clientSlug && (
                          <Link href={`/admin/clients/${o.clientSlug}/edit`} className="text-xs font-semibold text-neutral-400 hover:text-orange">→</Link>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="bg-white border border-neutral-200 rounded-xl p-5">
                <h2 className="font-bold tracking-tight mb-3">Bank accounts</h2>
                {f.banks.length === 0 ? (
                  <p className="text-sm text-neutral-400 py-4 text-center">No accounts in the tracker.</p>
                ) : (
                  <ul className="divide-y divide-neutral-100">
                    {f.banks.map((b) => (
                      <li key={b.name} className="py-2.5 flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-neutral-900">{b.name}</div>
                        <span className={`tabular-nums font-bold ${b.balance < 0 ? "text-red-600" : "text-neutral-900"}`}>{fmtILS(b.balance)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* ---- Payments received, month by month ---- */}
          <div className="adm-rise bg-white border border-neutral-200 rounded-xl p-5" style={{ animationDelay: "330ms" }}>
            <div className="flex items-center justify-between gap-4 flex-wrap mb-1">
              <h2 className="font-bold tracking-tight">Payments — {year}</h2>
              {paymentMonths.length > 0 && (
                <span className="text-xs text-neutral-400 tabular-nums">
                  {paymentMonths.reduce((n, g) => n + g.rows.length, 0)} payments · {fmtILS(paymentMonths.reduce((s, g) => s + g.total, 0))}
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-500 mb-3">Every payment received, newest first. The current month is open — tap a month to expand it.</p>
            {paymentMonths.length === 0 ? (
              <p className="text-sm text-neutral-400 py-6 text-center">No payments recorded in {year} yet.</p>
            ) : (
              <div className="divide-y divide-neutral-100">
                {paymentMonths.map((g, gi) => (
                  <details key={g.ym} open={gi === 0} className="group">
                    <summary className="flex items-center gap-3 py-2.5 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
                      <span className="text-neutral-300 text-xs transition-transform group-open:rotate-90">▶</span>
                      <span className="font-bold text-neutral-900">
                        {MONTHS[Number(g.ym.slice(5)) - 1]} {g.ym.slice(0, 4)}
                      </span>
                      <span className="text-xs text-neutral-400 tabular-nums">
                        {g.rows.length} payment{g.rows.length === 1 ? "" : "s"}
                      </span>
                      <span className="ml-auto tabular-nums font-bold text-green-700">{fmtILS(g.total)}</span>
                    </summary>
                    <ul className="pb-3 pl-6 divide-y divide-neutral-50">
                      {g.rows.map((p, i) => (
                        <li key={i} className="py-2 flex items-center gap-3 flex-wrap">
                          <div className="flex-1 min-w-[160px]">
                            <div className="text-sm font-semibold text-neutral-900 truncate">{p.sourceName || p.name}</div>
                            <div className="text-[11px] text-neutral-500 truncate">
                              {p.sourceName && p.name !== p.sourceName ? `${p.name} · ` : ""}
                              paid {new Date(p.payDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                            </div>
                          </div>
                          {p.daysLate > 3 && (
                            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700 whitespace-nowrap">
                              {p.daysLate}d late
                            </span>
                          )}
                          <div className="text-right">
                            <span className="tabular-nums text-sm font-bold text-neutral-900">{p.amountLabel}</span>
                            {p.usd > 0 && p.ils > 0 && (
                              <div className="text-[10px] text-neutral-400 tabular-nums">≈ {fmtILS(p.ilsTotal)} total</div>
                            )}
                          </div>
                          {p.clientSlug ? (
                            <Link href={`/admin/clients/${p.clientSlug}/edit`} className="text-xs font-semibold text-neutral-400 hover:text-orange">→</Link>
                          ) : p.notionUrl ? (
                            <a href={p.notionUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-neutral-300 hover:text-orange">↗</a>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
            )}
          </div>

          {/* ---- Month-by-month ledger ---- */}
          <div className="adm-rise bg-white border border-neutral-200 rounded-xl p-5" style={{ animationDelay: "360ms" }}>
            <h2 className="font-bold tracking-tight mb-1">{year} — the ledger</h2>
            <p className="text-xs text-neutral-500 mb-4">Collected, spent and net per month, with the running total for the year. Open = invoiced/due that month, not paid yet.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-neutral-400 border-b border-neutral-100">
                    <th className="py-2 pr-4 font-semibold">Month</th>
                    <th className="py-2 pr-4 font-semibold text-right">Collected</th>
                    <th className="py-2 pr-4 font-semibold text-right">Open</th>
                    <th className="py-2 pr-4 font-semibold text-right">Spent</th>
                    <th className="py-2 pr-4 font-semibold text-right">Net</th>
                    <th className="py-2 font-semibold text-right">Running net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {(() => {
                    let running = 0;
                    return months.map((m, i) => {
                      const mNet = m.income - m.expenses;
                      running += mNet;
                      const future = m.ym > nowYm;
                      const isNow = m.ym === nowYm;
                      const empty = !m.income && !m.expenses && !m.expected;
                      return (
                        <tr key={m.ym} className={`${isNow ? "bg-orange-50/60" : ""} ${future ? "opacity-40" : ""}`}>
                          <td className="py-2.5 pr-4 font-semibold text-neutral-900">
                            {MONTHS[i]} {isNow && <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide text-orange-deep">now</span>}
                            {m.ym === bestMonth.ym && bestMonth.income > 0 && (
                              <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide bg-green-100 text-green-800 rounded-full px-1.5 py-0.5">best</span>
                            )}
                          </td>
                          <td className="py-2.5 pr-4 text-right tabular-nums font-semibold text-neutral-900">{empty && !m.income ? "—" : fmtILS(m.income)}</td>
                          <td className={`py-2.5 pr-4 text-right tabular-nums ${m.expected ? "text-orange-deep font-semibold" : "text-neutral-300"}`}>
                            {m.expected ? fmtILS(m.expected) : "—"}
                          </td>
                          <td className="py-2.5 pr-4 text-right tabular-nums text-neutral-600">{m.expenses ? fmtILS(m.expenses) : "—"}</td>
                          <td className={`py-2.5 pr-4 text-right tabular-nums font-semibold ${mNet > 0 ? "text-green-700" : mNet < 0 ? "text-red-600" : "text-neutral-300"}`}>
                            {mNet === 0 ? "—" : fmtILS(mNet)}
                          </td>
                          <td className={`py-2.5 text-right tabular-nums font-bold ${running >= 0 ? "text-neutral-900" : "text-red-600"}`}>{fmtILS(running)}</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-neutral-200">
                    <td className="py-2.5 pr-4 font-bold text-neutral-900">Total {year}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums font-bold text-neutral-900">{fmtILS(income)}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums font-bold text-orange-deep">{open ? fmtILS(open) : "—"}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums font-bold text-neutral-700">{fmtILS(expenses)}</td>
                    <td className={`py-2.5 pr-4 text-right tabular-nums font-bold ${net >= 0 ? "text-green-700" : "text-red-600"}`}>{fmtILS(net)}</td>
                    <td className="py-2.5" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ---- Year over year ---- */}
          {yearRows.filter((r) => r.income || r.expenses).length > 1 && (
            <div className="adm-rise bg-white border border-neutral-200 rounded-xl p-5" style={{ animationDelay: "420ms" }}>
              <h2 className="font-bold tracking-tight mb-4">Year over year</h2>
              <ul className="space-y-3">
                {yearRows.map((r, i) => {
                  const prevR = yearRows[i + 1];
                  const rNet = r.income - r.expenses;
                  return (
                    <li key={r.y}>
                      <div className="flex items-center gap-3 text-sm flex-wrap">
                        <Link href={`/admin/finance?year=${r.y}`} className={`font-bold tabular-nums ${r.y === year ? "text-orange-deep" : "text-neutral-900 hover:text-orange"}`}>
                          {r.y}
                        </Link>
                        {prevR && <GrowthBadge now={r.income} prev={prevR.income} />}
                        <span className="flex-1" />
                        <span className="tabular-nums text-neutral-500">in <b className="text-neutral-900">{fmtILS(r.income)}</b></span>
                        <span className="tabular-nums text-neutral-500">out <b className="text-neutral-700">{fmtILS(r.expenses)}</b></span>
                        <span className={`tabular-nums font-bold ${rNet >= 0 ? "text-green-700" : "text-red-600"}`}>net {fmtILS(rNet)}</span>
                      </div>
                      <div className="mt-1.5 h-2 rounded-full bg-neutral-100 overflow-hidden">
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
        </>
      )}
    </div>
  );
}
