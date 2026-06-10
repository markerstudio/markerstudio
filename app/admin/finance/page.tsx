import Link from "next/link";
import { getFinance, fmtILS, type DebtorBehavior } from "@/lib/finance";
import { timeAgo } from "@/lib/dashboard";
import { syncFinance } from "../actions";

export const dynamic = "force-dynamic";

const NOTION_TRACKER_URL = "https://www.notion.so/16c2487b8e7e805b9d9eff1fea9ef021";

function BehaviorBadge({ behavior, late, avgDelayDays }: { behavior: DebtorBehavior; late?: number; avgDelayDays?: number }) {
  if (behavior === "no-data") return <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase bg-neutral-100 text-neutral-500">No history</span>;
  if (behavior === "on-time") return <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase bg-green-100 text-green-800">On time</span>;
  if (behavior === "mostly-on-time") return <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase bg-amber-100 text-amber-800">Mostly on time</span>;
  return (
    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase bg-red-100 text-red-700">
      Often late{avgDelayDays ? ` · ~${avgDelayDays}d` : ""}
    </span>
  );
}

export default async function FinanceAdmin({ searchParams }: { searchParams: { ok?: string } }) {
  const f = await getFinance();
  const maxDebt = Math.max(1, ...f.debtors.map((d) => d.debt));
  const withHistory = f.debtors.filter((d) => d.behavior !== "no-data");
  const netThisMonth = f.collectedThisMonthILS - f.expensesThisMonthILS;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Finance</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Live from the Notion Budget Tracker
            {f.syncedAt ? <span className="text-neutral-400"> · synced {timeAgo(f.syncedAt)}</span> : null}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a href={NOTION_TRACKER_URL} target="_blank" rel="noreferrer" className="text-sm font-medium text-neutral-500 hover:text-neutral-900">
            Open in Notion ↗
          </a>
          <form action={syncFinance}>
            <button className="bg-charcoal text-white text-sm font-semibold rounded-md px-4 py-2 hover:bg-ink transition-colors">Sync now</button>
          </form>
        </div>
      </div>

      {searchParams.ok === "synced" && (
        <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-md px-4 py-2.5">Synced fresh numbers from Notion.</p>
      )}

      {!f.available ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center">
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-4 py-3 inline-block">
            {f.error || "Notion isn't connected."}
          </p>
          <p className="text-sm text-neutral-500 mt-4 max-w-md mx-auto">
            Set <code className="font-mono text-xs bg-neutral-100 px-1.5 py-0.5 rounded">NOTION_TOKEN</code> and share the Budget
            Tracker page with the integration — the debt leaderboard, payment behaviour, and bank balances will appear here.
          </p>
        </div>
      ) : (
        <>
          {/* ---- KPI row ---- */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="adm-rise bg-charcoal text-white rounded-xl px-5 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-white/60">In the bank</div>
              <div className="mt-2 text-3xl font-extrabold tracking-tight tabular-nums text-orange">{fmtILS(f.bankTotal)}</div>
              <div className="mt-1 text-xs text-white/60">{f.banks.length} account{f.banks.length === 1 ? "" : "s"}</div>
            </div>
            <div className="adm-rise bg-white border border-neutral-200 rounded-xl px-5 py-4" style={{ animationDelay: "60ms" }}>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Clients owe us</div>
              <div className="mt-2 text-3xl font-extrabold tracking-tight tabular-nums text-orange-deep">{fmtILS(f.totalDebt)}</div>
              <div className="mt-1 text-xs text-neutral-500">{f.debtors.filter((d) => d.debt > 0).length} client{f.debtors.filter((d) => d.debt > 0).length === 1 ? "" : "s"} with a balance</div>
            </div>
            <div className="adm-rise bg-white border border-neutral-200 rounded-xl px-5 py-4" style={{ animationDelay: "120ms" }}>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Overdue payments</div>
              <div className={`mt-2 text-3xl font-extrabold tracking-tight tabular-nums ${f.overdue.length ? "text-red-600" : "text-neutral-900"}`}>{f.overdue.length}</div>
              <div className="mt-1 text-xs text-neutral-500">{f.overdue.length ? `${fmtILS(f.overdueTotal)} past due` : "nothing past due"}</div>
            </div>
            <div className="adm-rise bg-white border border-neutral-200 rounded-xl px-5 py-4" style={{ animationDelay: "180ms" }}>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">This month</div>
              <div className="mt-2 text-3xl font-extrabold tracking-tight tabular-nums text-neutral-900">{fmtILS(f.collectedThisMonthILS)}</div>
              <div className="mt-1 text-xs text-neutral-500">
                in · {fmtILS(f.expensesThisMonthILS)} out · net{" "}
                <span className={netThisMonth >= 0 ? "text-green-700 font-semibold" : "text-red-600 font-semibold"}>{fmtILS(netThisMonth)}</span>
              </div>
            </div>
          </div>

          {/* ---- Debt leaderboard + banks ---- */}
          <div className="grid lg:grid-cols-5 gap-4">
            <div className="adm-rise lg:col-span-3 bg-white border border-neutral-200 rounded-xl p-5" style={{ animationDelay: "240ms" }}>
              <h2 className="font-bold tracking-tight mb-1">Debt leaderboard</h2>
              <p className="text-xs text-neutral-500 mb-4">Combined money left per client — branding + marketing + extras − paid, one number.</p>
              {f.debtors.filter((d) => d.debt > 0).length === 0 ? (
                <p className="text-sm text-neutral-400 py-8 text-center">No one owes you anything. Frame this page.</p>
              ) : (
                <ul className="space-y-3">
                  {f.debtors.filter((d) => d.debt > 0).map((d, i) => (
                    <li key={d.sourceId} className="group">
                      <div className="flex items-center gap-3 text-sm">
                        <span className={`w-5 text-right font-mono text-xs ${i === 0 ? "text-orange-deep font-bold" : "text-neutral-400"}`}>{i + 1}</span>
                        <span className="font-semibold text-neutral-900 truncate">{d.name}</span>
                        <BehaviorBadge behavior={d.behavior} avgDelayDays={d.avgDelayDays} />
                        <span className="flex-1" />
                        <span className="tabular-nums font-bold text-neutral-900">{fmtILS(d.debt)}</span>
                        {d.clientSlug ? (
                          <Link href={`/admin/clients/${d.clientSlug}/edit`} className="text-xs font-semibold text-neutral-400 hover:text-orange whitespace-nowrap">
                            Invoice →
                          </Link>
                        ) : (
                          <a href={d.notionUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-neutral-400 hover:text-orange whitespace-nowrap">
                            Notion ↗
                          </a>
                        )}
                      </div>
                      <div className="ml-8 mt-1.5 h-2 rounded-full bg-neutral-100 overflow-hidden">
                        <div
                          className="adm-bar h-full rounded-full bg-orange"
                          style={{ width: `${Math.max(2, Math.round((d.debt / maxDebt) * 100))}%`, animationDelay: `${300 + i * 60}ms` }}
                        />
                      </div>
                      <div className="ml-8 mt-1 text-[11px] text-neutral-400">
                        {d.paidPct}% paid all-time{d.monthlyFee ? ` · ${fmtILS(d.monthlyFee)}/mo` : ""}
                        {d.lastPaymentDate ? ` · last payment ${d.lastPaymentDate}` : ""}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="adm-rise lg:col-span-2 space-y-4" style={{ animationDelay: "300ms" }}>
              <div className="bg-white border border-neutral-200 rounded-xl p-5">
                <h2 className="font-bold tracking-tight mb-3">Bank accounts</h2>
                {f.banks.length === 0 ? (
                  <p className="text-sm text-neutral-400 py-4 text-center">No accounts in the tracker.</p>
                ) : (
                  <ul className="divide-y divide-neutral-100">
                    {f.banks.map((b) => (
                      <li key={b.name} className="py-2.5 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-neutral-900">{b.name}</div>
                          <div className="text-[11px] text-neutral-400">+{fmtILS(b.totalIncome)} · −{fmtILS(b.totalExpenses)}</div>
                        </div>
                        <span className={`tabular-nums font-bold ${b.balance < 0 ? "text-red-600" : "text-neutral-900"}`}>{fmtILS(b.balance)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="bg-white border border-neutral-200 rounded-xl p-5">
                <h2 className="font-bold tracking-tight mb-3">Overdue payments</h2>
                {f.overdue.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-5 text-center">
                    <span className="w-9 h-9 rounded-full bg-green-100 text-green-700 flex items-center justify-center">✓</span>
                    <p className="text-sm text-neutral-500">Nothing past due.</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-neutral-100">
                    {f.overdue.slice(0, 8).map((o, i) => (
                      <li key={i} className="py-2.5 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-neutral-900 truncate">{o.sourceName || o.name}</div>
                          <div className="text-[11px] text-neutral-500 truncate">{o.name} · due {o.dueDate}</div>
                        </div>
                        <span className="tabular-nums text-sm font-bold text-neutral-900">{o.amountLabel}</span>
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700 whitespace-nowrap">{o.daysOverdue}d late</span>
                        {o.clientSlug && (
                          <Link href={`/admin/clients/${o.clientSlug}/edit`} className="text-xs font-semibold text-neutral-400 hover:text-orange">→</Link>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* ---- Payment discipline ---- */}
          <div className="adm-rise bg-white border border-neutral-200 rounded-xl p-5" style={{ animationDelay: "360ms" }}>
            <h2 className="font-bold tracking-tight mb-1">Who pays on time</h2>
            <p className="text-xs text-neutral-500 mb-4">From the Income database — Pay Date vs Due Date, with a 3-day grace period.</p>
            {withHistory.length === 0 ? (
              <p className="text-sm text-neutral-400 py-6 text-center">No dated payments yet — add Due Date + Pay Date on Income rows in Notion.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-neutral-400 border-b border-neutral-100">
                      <th className="py-2 pr-4 font-semibold">Client</th>
                      <th className="py-2 pr-4 font-semibold">Behaviour</th>
                      <th className="py-2 pr-4 font-semibold text-right">On time</th>
                      <th className="py-2 pr-4 font-semibold text-right">Late</th>
                      <th className="py-2 pr-4 font-semibold text-right">Avg delay</th>
                      <th className="py-2 pr-4 font-semibold text-right">Paid all-time</th>
                      <th className="py-2 font-semibold text-right">Last payment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {[...withHistory]
                      .sort((a, b) => b.late - a.late || b.avgDelayDays - a.avgDelayDays)
                      .map((d) => (
                        <tr key={d.sourceId}>
                          <td className="py-2.5 pr-4 font-semibold text-neutral-900">
                            {d.clientSlug ? (
                              <Link href={`/admin/clients/${d.clientSlug}/edit`} className="hover:text-orange">{d.name}</Link>
                            ) : (
                              d.name
                            )}
                          </td>
                          <td className="py-2.5 pr-4"><BehaviorBadge behavior={d.behavior} avgDelayDays={d.avgDelayDays} /></td>
                          <td className="py-2.5 pr-4 text-right tabular-nums text-green-700 font-semibold">{d.onTime}</td>
                          <td className={`py-2.5 pr-4 text-right tabular-nums font-semibold ${d.late ? "text-red-600" : "text-neutral-400"}`}>{d.late}</td>
                          <td className="py-2.5 pr-4 text-right tabular-nums text-neutral-600">{d.avgDelayDays ? `${d.avgDelayDays}d` : "—"}</td>
                          <td className="py-2.5 pr-4 text-right tabular-nums text-neutral-900">{fmtILS(d.allTimePaid)}</td>
                          <td className="py-2.5 text-right tabular-nums text-neutral-500">{d.lastPaymentDate || "—"}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
