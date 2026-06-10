import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getDashboardData, fmtMoney, timeAgo } from "@/lib/dashboard";
import { getFinance, fmtILS, type FinanceData } from "@/lib/finance";

export const dynamic = "force-dynamic";

// Budget Tracker snapshot for the dashboard. Cached ~5 min in lib/finance;
// the race keeps a cold Notion fetch from stalling the whole dashboard.
async function financeSnapshot(): Promise<FinanceData | null> {
  if (!process.env.NOTION_TOKEN) return null;
  try {
    const data = await Promise.race([
      getFinance(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
    ]);
    return data && data.available ? data : null;
  } catch {
    return null;
  }
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "paid"
      ? "bg-green-100 text-green-800"
      : status === "due"
      ? "bg-orange-100 text-orange-deep"
      : status === "partial"
      ? "bg-amber-100 text-amber-800"
      : "bg-neutral-100 text-neutral-600";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${tone}`}>{status}</span>;
}

const ATTENTION_ICONS: Record<string, string> = {
  overdue: "⏰",
  "pending-client": "🆕",
  proposal: "📄",
  agreement: "✍️",
  inquiries: "✉️",
  applications: "👋",
};

export default async function AdminDashboard() {
  const [user, d, fin] = await Promise.all([getSession(), getDashboardData(), financeSnapshot()]);
  const firstName = (user?.name || "there").split(" ")[0];
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const maxBilled = Math.max(1, ...d.months.map((m) => m.billed));
  const hasMoney = d.months.some((m) => m.billed > 0 || m.collected > 0);

  return (
    <div className="space-y-5">
      {/* ---- Hero strip ---- */}
      <div className="adm-rise bg-charcoal text-white rounded-2xl px-6 py-6 sm:px-8 flex flex-wrap items-center justify-between gap-5 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        <div className="relative">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {greeting()}, <span className="text-orange">{firstName}</span>.
          </h1>
          <p className="text-sm text-white/60 mt-1">{today}</p>
        </div>
        <div className="relative flex items-center gap-2.5 flex-wrap">
          <Link href="/admin/projects/new" className="bg-orange text-white text-sm font-semibold rounded-md px-4 py-2 hover:bg-orange-deep transition-colors">
            + New project
          </Link>
          <Link href="/admin/clients/new" className="bg-white/10 text-white text-sm font-semibold rounded-md px-4 py-2 hover:bg-white/20 transition-colors">
            + New client
          </Link>
          <Link href="/" target="_blank" className="text-white/70 text-sm font-medium hover:text-white transition-colors px-1">
            View site ↗
          </Link>
        </div>
      </div>

      {d.dbOff && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-4 py-3">
          No database configured — the dashboard is empty. Connect a database to see studio numbers here.
        </p>
      )}
      {d.needsSetup && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-4 py-3">
          Database connected, but it hasn&apos;t been initialised yet.{" "}
          <Link href="/admin/setup" className="font-semibold underline">Run setup →</Link>
        </p>
      )}

      {/* ---- KPI cards ---- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Outstanding",
            value: fmtMoney(d.outstanding),
            note: d.outstanding > 0 ? "across due & partial invoices" : "nothing owed right now",
            href: "/admin/invoices",
            accent: true,
          },
          {
            label: "Collected this year",
            value: fmtMoney(d.collectedYear),
            note: `${d.invoiceStatusCounts.paid} invoice${d.invoiceStatusCounts.paid === 1 ? "" : "s"} fully paid`,
            href: "/admin/invoices",
          },
          {
            label: "Active clients",
            value: String(d.activeClients),
            note: `of ${d.totalClients} portal${d.totalClients === 1 ? "" : "s"} total`,
            href: "/admin/clients",
          },
          {
            label: "Awaiting reply",
            value: String(d.unreadInquiries + d.unreadApplications),
            note: `${d.unreadInquiries} inquir${d.unreadInquiries === 1 ? "y" : "ies"} · ${d.unreadApplications} application${d.unreadApplications === 1 ? "" : "s"}`,
            href: "/admin/inquiries",
          },
        ].map((kpi, i) => (
          <Link
            key={kpi.label}
            href={kpi.href}
            className="adm-rise group bg-white border border-neutral-200 rounded-xl px-5 py-4 hover:border-orange hover:shadow-md transition-all"
            style={{ animationDelay: `${60 + i * 60}ms` }}
          >
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              <span className={`inline-block w-4 h-[3px] rounded-full ${kpi.accent ? "bg-orange" : "bg-charcoal-20 group-hover:bg-orange transition-colors"}`} />
              {kpi.label}
            </div>
            <div className={`mt-2 text-3xl font-extrabold tracking-tight tabular-nums ${kpi.accent ? "text-orange-deep" : "text-neutral-900"}`}>
              {kpi.value}
            </div>
            <div className="mt-1 text-xs text-neutral-500">{kpi.note}</div>
          </Link>
        ))}
      </div>

      {/* ---- Cashflow + attention ---- */}
      <div className="grid lg:grid-cols-5 gap-4">
        <div className="adm-rise lg:col-span-3 bg-white border border-neutral-200 rounded-xl p-5" style={{ animationDelay: "240ms" }}>
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="font-bold tracking-tight">Cashflow — last 6 months</h2>
            <div className="flex items-center gap-3 text-[11px] text-neutral-500">
              <span className="inline-flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-orange inline-block" /> collected</span>
              <span className="inline-flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-charcoal-20 inline-block" /> billed</span>
            </div>
          </div>
          {hasMoney ? (
            <div className="grid grid-cols-6 gap-3 items-end h-40">
              {d.months.map((m, i) => {
                const billedH = Math.round((m.billed / maxBilled) * 100);
                const collectedH = Math.round((m.collected / maxBilled) * 100);
                return (
                  <div key={m.label} className="flex flex-col items-center gap-2 h-full justify-end" title={`${m.label}: billed ${fmtMoney(m.billed)} · collected ${fmtMoney(m.collected)}`}>
                    <div className="relative w-full max-w-[44px] h-full flex items-end justify-center">
                      <div className="adm-bar absolute bottom-0 w-full rounded-t-md bg-charcoal-10" style={{ height: `${billedH}%`, animationDelay: `${300 + i * 70}ms` }} />
                      <div className="adm-bar absolute bottom-0 w-full rounded-t-md bg-orange" style={{ height: `${collectedH}%`, animationDelay: `${360 + i * 70}ms` }} />
                    </div>
                    <span className="text-[11px] font-medium text-neutral-500">{m.label}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-sm text-neutral-400">
              No invoices in the last six months — totals will chart here.
            </div>
          )}
        </div>

        <div className="adm-rise lg:col-span-2 bg-white border border-neutral-200 rounded-xl p-5" style={{ animationDelay: "300ms" }}>
          <h2 className="font-bold tracking-tight mb-4">Needs attention</h2>
          {d.attention.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <span className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-lg">✓</span>
              <p className="text-sm text-neutral-500">All clear — nothing waiting on you.</p>
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100 -my-1.5">
              {d.attention.map((a, i) => (
                <li key={`${a.kind}-${i}`}>
                  <Link href={a.href} className="group flex items-center gap-3 py-2.5 text-sm">
                    <span aria-hidden className="shrink-0">{ATTENTION_ICONS[a.kind] || "•"}</span>
                    <span className="flex-1 text-neutral-700 group-hover:text-neutral-900">{a.text}</span>
                    <span className="text-neutral-300 group-hover:text-orange transition-colors">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ---- Finance snapshot (Notion Budget Tracker) ---- */}
      {fin && (
        <div className="adm-rise bg-white border border-neutral-200 rounded-xl p-5" style={{ animationDelay: "330ms" }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold tracking-tight">Money &amp; debts</h2>
            <Link href="/admin/finance" className="text-xs font-semibold text-neutral-500 hover:text-orange">Full analysis →</Link>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="rounded-lg bg-neutral-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">In the bank</div>
              <div className="mt-1 text-2xl font-extrabold tabular-nums text-neutral-900">{fmtILS(fin.bankTotal)}</div>
            </div>
            <div className="rounded-lg bg-neutral-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Clients owe us</div>
              <div className="mt-1 text-2xl font-extrabold tabular-nums text-orange-deep">{fmtILS(fin.totalDebt)}</div>
            </div>
            <div className="rounded-lg bg-neutral-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Overdue</div>
              <div className={`mt-1 text-2xl font-extrabold tabular-nums ${fin.overdue.length ? "text-red-600" : "text-neutral-900"}`}>
                {fin.overdue.length ? `${fin.overdue.length} · ${fmtILS(fin.overdueTotal)}` : "None"}
              </div>
            </div>
          </div>
          {fin.debtors.filter((x) => x.debt > 0).length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {fin.debtors.filter((x) => x.debt > 0).slice(0, 3).map((t) => (
                <li key={t.sourceId} className="flex items-center gap-3 text-sm">
                  <span className="text-neutral-700 font-medium truncate">{t.name}</span>
                  <span className="flex-1 h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                    <span
                      className="block h-full rounded-full bg-orange"
                      style={{ width: `${Math.max(3, Math.round((t.debt / Math.max(1, fin.debtors[0]?.debt || 1)) * 100))}%` }}
                    />
                  </span>
                  <span className="tabular-nums font-semibold text-neutral-900 whitespace-nowrap">{fmtILS(t.debt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ---- Latest inquiries + recent invoices ---- */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="adm-rise bg-white border border-neutral-200 rounded-xl p-5" style={{ animationDelay: "360ms" }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold tracking-tight">Latest inquiries</h2>
            <Link href="/admin/inquiries" className="text-xs font-semibold text-neutral-500 hover:text-orange">All →</Link>
          </div>
          {d.recentInquiries.length === 0 ? (
            <p className="text-sm text-neutral-400 py-6 text-center">No inquiries yet — they&apos;ll land here from the contact form.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {d.recentInquiries.map((q) => (
                <li key={q.id} className="flex items-center gap-3 py-2.5">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${q.read_at ? "bg-neutral-200" : "bg-orange"}`} title={q.read_at ? "Read" : "Unread"} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-neutral-900 truncate">
                      {q.name}
                      {q.brand ? <span className="font-normal text-neutral-500"> · {q.brand}</span> : null}
                    </div>
                    <div className="text-xs text-neutral-500 truncate">{q.service || q.email}</div>
                  </div>
                  <span className="text-[11px] text-neutral-400 whitespace-nowrap">{timeAgo(q.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="adm-rise bg-white border border-neutral-200 rounded-xl p-5" style={{ animationDelay: "420ms" }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold tracking-tight">Recent invoices</h2>
            <Link href="/admin/invoices" className="text-xs font-semibold text-neutral-500 hover:text-orange">All →</Link>
          </div>
          {d.recentInvoices.length === 0 ? (
            <p className="text-sm text-neutral-400 py-6 text-center">No invoices yet — create one from a client&apos;s page.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {d.recentInvoices.map((inv) => (
                <li key={inv.id} className="flex items-center gap-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-mono font-semibold text-neutral-900 truncate">{inv.number}</div>
                    <div className="text-xs text-neutral-500 truncate">/{inv.client_slug}</div>
                  </div>
                  <StatusPill status={inv.status} />
                  <Link href={`/portal/${inv.client_slug}/invoice/${inv.id}`} target="_blank" className="text-xs font-medium text-neutral-400 hover:text-orange whitespace-nowrap">
                    PDF ↗
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ---- Client pulse ---- */}
      <div className="adm-rise bg-white border border-neutral-200 rounded-xl p-5" style={{ animationDelay: "480ms" }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold tracking-tight">Client pulse</h2>
          <Link href="/admin/clients" className="text-xs font-semibold text-neutral-500 hover:text-orange">All clients →</Link>
        </div>
        {d.clients.length === 0 ? (
          <p className="text-sm text-neutral-400 py-4 text-center">No client portals yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2.5">
            {d.clients.map((c) => (
              <Link
                key={c.slug}
                href={`/admin/clients/${c.slug}/edit`}
                className="inline-flex items-center gap-2.5 border border-neutral-200 rounded-full pl-2 pr-3.5 py-1.5 text-sm hover:border-orange hover:shadow-sm transition-all"
              >
                <span className="w-6 h-6 rounded-full shrink-0" style={{ background: c.color }} />
                <span className="font-semibold text-neutral-800">{c.name}</span>
                {c.pending ? (
                  <span className="text-[10px] font-semibold uppercase tracking-wide bg-amber-100 text-amber-800 rounded-full px-2 py-0.5">Pending</span>
                ) : c.active ? (
                  <span className="text-[10px] font-semibold uppercase tracking-wide bg-green-100 text-green-800 rounded-full px-2 py-0.5">Active</span>
                ) : null}
                {c.planName && <span className="text-xs text-neutral-500">{c.planName}</span>}
              </Link>
            ))}
          </div>
        )}
        <div className="mt-4 pt-4 border-t border-neutral-100 flex flex-wrap gap-x-6 gap-y-1 text-xs text-neutral-500">
          <span><strong className="text-neutral-800">{d.projectCount}</strong> published case stud{d.projectCount === 1 ? "y" : "ies"}</span>
          <span><strong className="text-neutral-800">{d.invoiceStatusCounts.due + d.invoiceStatusCounts.partial}</strong> open invoice{d.invoiceStatusCounts.due + d.invoiceStatusCounts.partial === 1 ? "" : "s"}</span>
          <span><strong className="text-neutral-800">{d.invoiceStatusCounts.draft}</strong> draft{d.invoiceStatusCounts.draft === 1 ? "" : "s"}</span>
        </div>
      </div>
    </div>
  );
}
