import Link from "next/link";
import { Suspense } from "react";
import { getSession } from "@/lib/auth";
import { getDashboardData, fmtMoney, timeAgo } from "@/lib/dashboard";
import { getFinance, fmtILS, type FinanceData } from "@/lib/finance";
import { runPaymentHistoryBackfill } from "@/lib/backfill";
import { cleanupReconcilerDuplicates } from "@/lib/notionSync";
import { getBoardData } from "@/lib/taskBoard";
import { getAgenda } from "@/lib/agenda";
import TodayTasks from "@/components/admin/tasks/TodayTasks";
import TodayAgenda from "@/components/admin/TodayAgenda";
import { StatTile, Skeleton } from "@/components/ui/glass";

export const dynamic = "force-dynamic";

// Budget Tracker snapshot for the dashboard. Cached ~5 min in lib/finance;
// rendered inside <Suspense> so a cold Notion fetch streams in after first
// paint instead of stalling the whole dashboard. The race is a last resort
// so the stream itself can't hang on a slow Notion response.
async function financeSnapshot(): Promise<FinanceData | null> {
  if (!process.env.NOTION_TOKEN) return null;
  try {
    const data = await Promise.race([
      getFinance(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
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
      ? "lq-chip--green"
      : status === "due"
      ? "lq-chip--orange"
      : status === "partial"
      ? "lq-chip--orange"
      : "";
  return <span className={`lq-chip ${tone} uppercase !text-[10px]`}>{status}</span>;
}

const ATTENTION_ICONS: Record<string, string> = {
  overdue: "⏰",
  "due-soon": "📅",
  "pending-client": "🆕",
  proposal: "📄",
  agreement: "✍️",
  inquiries: "✉️",
  applications: "👋",
};

// Today's tasks — streams in behind <Suspense> because the first load may hit
// Notion (cached ~60s after that). A slice of the full Tasks board.
async function TodayTasksCard() {
  try {
    const { tasks, projects } = await getBoardData();
    return <TodayTasks initial={tasks} projects={projects} />;
  } catch {
    return null; // tasks must never take the dashboard down
  }
}

// The "today by client" ritual strip — the agenda engine's daily slice.
async function TodayAgendaCard() {
  try {
    const agenda = await getAgenda(3);
    return <TodayAgenda agenda={agenda} />;
  } catch {
    return null;
  }
}

// Async section component — awaited inside <Suspense>, not by the page.
async function FinanceCard() {
  const fin = await financeSnapshot();
  if (!fin) return null;
  return (
    <div className="lq-card lq-rise p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="font-display font-bold text-[16px] tracking-tight text-ink">The books — from Notion</h2>
          <p className="text-xs text-charcoal-60 mt-0.5">
            Live from your Budget Tracker — the source of truth. The tiles up top track what you&apos;ve{" "}
            <b>invoiced in the app</b>, so the two won&apos;t always match.
          </p>
        </div>
        <Link href="/admin/finance" className="text-xs font-semibold text-charcoal-60 hover:text-orange-deep whitespace-nowrap shrink-0 no-underline">Full analysis →</Link>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="lq-well px-4 py-3">
          <div className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-charcoal-60">In the bank</div>
          <div className="mt-1 text-[22px] font-display font-extrabold tabular-nums text-ink">{fmtILS(fin.bankTotal)}</div>
        </div>
        <div className="lq-well px-4 py-3">
          <div className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-charcoal-60">Clients owe us</div>
          <div className="mt-1 text-[22px] font-display font-extrabold tabular-nums text-orange-deep">{fmtILS(fin.totalDebt)}</div>
        </div>
        <div className="lq-well px-4 py-3">
          <div className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-charcoal-60">Overdue</div>
          <div className={`mt-1 text-[22px] font-display font-extrabold tabular-nums ${fin.overdue.length ? "text-rose-600" : "text-ink"}`}>
            {fin.overdue.length ? `${fin.overdue.length} · ${fmtILS(fin.overdueTotal)}` : "None"}
          </div>
        </div>
      </div>
      {fin.debtors.filter((x) => x.debt > 0).length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {fin.debtors.filter((x) => x.debt > 0).slice(0, 3).map((t) => (
            <li key={t.sourceId} className="flex items-center gap-3 text-sm">
              <span className="text-charcoal-80 font-medium truncate">{t.name}</span>
              <span className="flex-1 h-1.5 rounded-full bg-charcoal/5 overflow-hidden">
                <span
                  className="block h-full rounded-full bg-orange"
                  style={{ width: `${Math.max(3, Math.round((t.debt / Math.max(1, fin.debtors[0]?.debt || 1)) * 100))}%` }}
                />
              </span>
              <span className="tabular-nums font-semibold text-ink whitespace-nowrap">{fmtILS(t.debt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function AdminDashboard() {
  // One-time: invoice every client's payment history (backdated). Self-guarded
  // by a flag row — after the first run this is a single cheap SELECT.
  await runPaymentHistoryBackfill();
  // One-time: archive the duplicate Income rows an earlier, too-aggressive
  // reconciler created for already-synced historical payments. Self-guarded by
  // a flag. Payment→Notion healing is now MANUAL only (the Finance page's
  // "Re-sync payments" button) so nothing pushes to Notion on its own.
  await cleanupReconcilerDuplicates();
  const [user, d] = await Promise.all([getSession(), getDashboardData()]);
  const firstName = (user?.name || "there").split(" ")[0];
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const maxBilled = Math.max(1, ...d.months.map((m) => m.billed));
  const hasMoney = d.months.some((m) => m.billed > 0 || m.collected > 0);

  return (
    <div className="space-y-5">
      {/* ---- Greeting — type on the field, no box ---- */}
      <header className="flex flex-wrap items-end justify-between gap-4 pt-1">
        <div>
          <p className="text-[11.5px] font-display font-bold uppercase tracking-[0.16em] text-charcoal-60">{today}</p>
          <h1 className="font-display font-extrabold text-[30px] sm:text-[36px] tracking-tight text-ink leading-tight mt-0.5">
            {greeting()}, <span className="text-orange">{firstName}</span>.
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/admin/invoices" className="lq-btn lq-btn--primary no-underline">+ Invoice</Link>
          <Link href="/admin/payments/new" className="lq-btn lq-btn--glass no-underline">+ Payment</Link>
          <Link href="/admin/proposals" className="lq-btn lq-btn--glass no-underline">+ Proposal</Link>
          <Link href="/admin/clients/new" className="lq-btn lq-btn--glass no-underline">+ Client</Link>
        </div>
      </header>

      {d.dbOff && (
        <p className="lq-card text-sm text-amber-800 px-4 py-3 !border-amber-300/40">
          No database configured — the dashboard is empty. Connect a database to see studio numbers here.
        </p>
      )}
      {d.needsSetup && (
        <p className="lq-card text-sm text-amber-800 px-4 py-3 !border-amber-300/40">
          Database connected, but it hasn&apos;t been initialised yet.{" "}
          <Link href="/admin/setup" className="font-semibold underline">Run setup →</Link>
        </p>
      )}

      {/* ---- Today by client — the ritual strip ---- */}
      <Suspense
        fallback={
          <div className="lq-dark p-5" aria-busy="true">
            <Skeleton className="h-4 w-40 mb-4 opacity-30" />
            <div className="space-y-2.5">
              <Skeleton className="h-9 opacity-20" />
              <Skeleton className="h-9 opacity-20" />
              <Skeleton className="h-9 opacity-20" />
            </div>
          </div>
        }
      >
        <TodayAgendaCard />
      </Suspense>

      {/* ---- KPI tiles ---- */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5">
        <StatTile label="Outstanding" value={fmtMoney(d.outstanding)} sub={d.outstanding > 0 ? "across due & partial invoices" : "nothing owed right now"} href="/admin/invoices" tone="accent" delay={40} />
        <StatTile label="Overdue" value={d.overdueCount ? fmtMoney(d.overdueTotal) : "None"} sub={d.overdueCount ? `${d.overdueCount} invoice${d.overdueCount === 1 ? "" : "s"} past due` : "all on schedule"} href="/admin/invoices?f=overdue" tone={d.overdueCount ? "bad" : "good"} delay={90} />
        <StatTile label="This month" value={fmtMoney(d.thisMonthCollected)} sub={`collected · ${fmtMoney(d.thisMonthBilled)} billed`} href="/admin/finance" delay={140} />
        <StatTile label="Collected this year" value={fmtMoney(d.collectedYear)} sub={`${d.invoiceStatusCounts.paid} invoice${d.invoiceStatusCounts.paid === 1 ? "" : "s"} fully paid`} href="/admin/invoices?f=paid" delay={190} />
        <StatTile label="Active clients" value={String(d.activeClients)} sub={`of ${d.totalClients} portal${d.totalClients === 1 ? "" : "s"} total`} href="/admin/clients" delay={240} />
        <StatTile label="Awaiting reply" value={String(d.unreadInquiries + d.unreadApplications)} sub={`${d.unreadInquiries} inquir${d.unreadInquiries === 1 ? "y" : "ies"} · ${d.unreadApplications} application${d.unreadApplications === 1 ? "" : "s"}`} href="/admin/inquiries" tone={d.unreadInquiries + d.unreadApplications > 0 ? "warn" : "neutral"} delay={290} />
      </div>

      {/* ---- Today's tasks + attention ---- */}
      <div className="grid lg:grid-cols-5 gap-4 items-stretch">
        <div className="lg:col-span-2 flex flex-col [&>*]:flex-1">
          <Suspense
            fallback={
              <div className="lq-card p-5" aria-busy="true">
                <Skeleton className="h-4 w-24 mb-4" />
                <div className="space-y-2.5">
                  <Skeleton className="h-5" />
                  <Skeleton className="h-5" />
                  <Skeleton className="h-5" />
                  <Skeleton className="h-9 mt-4" />
                </div>
              </div>
            }
          >
            <TodayTasksCard />
          </Suspense>
        </div>

        <div className="lq-card lq-rise lg:col-span-3 p-5" style={{ animationDelay: "300ms" }}>
          <h2 className="font-display font-bold text-[16px] tracking-tight text-ink mb-3">Needs attention</h2>
          {d.attention.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <span className="w-10 h-10 rounded-full bg-emerald-500/15 text-emerald-700 flex items-center justify-center text-lg">✓</span>
              <p className="text-sm text-charcoal-60">All clear — nothing waiting on you.</p>
            </div>
          ) : (
            <ul className="divide-y divide-charcoal/5 -my-1">
              {d.attention.map((a, i) => (
                <li key={`${a.kind}-${i}`}>
                  <Link href={a.href} className="group flex items-center gap-3 py-2.5 text-sm no-underline">
                    <span aria-hidden className="shrink-0">{ATTENTION_ICONS[a.kind] || "•"}</span>
                    <span className="flex-1 text-charcoal-80 group-hover:text-ink">{a.text}</span>
                    <span className="text-charcoal-20 group-hover:text-orange transition-colors">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ---- Cashflow ---- */}
      <div className="lq-card lq-rise p-5" style={{ animationDelay: "240ms" }}>
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="font-display font-bold text-[16px] tracking-tight text-ink">Cashflow — last 6 months</h2>
          <div className="flex items-center gap-3 text-[11px] text-charcoal-60">
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
                    <div className="adm-bar absolute bottom-0 w-full rounded-t-lg bg-charcoal/10" style={{ height: `${billedH}%`, animationDelay: `${300 + i * 70}ms` }} />
                    <div className="adm-bar absolute bottom-0 w-full rounded-t-lg bg-gradient-to-t from-[#F57F00] to-[#FFA226] shadow-[0_6px_14px_-6px_rgba(255,145,0,.5)]" style={{ height: `${collectedH}%`, animationDelay: `${360 + i * 70}ms` }} />
                  </div>
                  <span className="text-[11px] font-medium text-charcoal-60">{m.label}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-40 flex items-center justify-center text-sm text-charcoal-40">
            No invoices in the last six months — totals will chart here.
          </div>
        )}
      </div>

      {/* ---- Finance snapshot (Notion Budget Tracker) — streams in ---- */}
      <Suspense
        fallback={
          <div className="lq-card p-5" aria-busy="true">
            <Skeleton className="h-4 w-32 mb-4" />
            <div className="grid sm:grid-cols-3 gap-3">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          </div>
        }
      >
        <FinanceCard />
      </Suspense>

      {/* ---- Latest inquiries + recent invoices ---- */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="lq-card lq-rise p-5" style={{ animationDelay: "360ms" }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-[16px] tracking-tight text-ink">Latest inquiries</h2>
            <Link href="/admin/inquiries" className="text-xs font-semibold text-charcoal-60 hover:text-orange-deep no-underline">All →</Link>
          </div>
          {d.recentInquiries.length === 0 ? (
            <p className="text-sm text-charcoal-40 py-6 text-center">No inquiries yet — they&apos;ll land here from the contact form.</p>
          ) : (
            <ul className="divide-y divide-charcoal/5">
              {d.recentInquiries.map((q) => (
                <li key={q.id} className="flex items-center gap-3 py-2.5">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${q.read_at ? "bg-charcoal-20" : "bg-orange"}`} title={q.read_at ? "Read" : "Unread"} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-ink truncate">
                      {q.name}
                      {q.brand ? <span className="font-normal text-charcoal-60"> · {q.brand}</span> : null}
                    </div>
                    <div className="text-xs text-charcoal-60 truncate">{q.service || q.email}</div>
                  </div>
                  <span className="text-[11px] text-charcoal-40 whitespace-nowrap">{timeAgo(q.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="lq-card lq-rise p-5" style={{ animationDelay: "420ms" }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-[16px] tracking-tight text-ink">Recent invoices</h2>
            <Link href="/admin/invoices" className="text-xs font-semibold text-charcoal-60 hover:text-orange-deep no-underline">All →</Link>
          </div>
          {d.recentInvoices.length === 0 ? (
            <p className="text-sm text-charcoal-40 py-6 text-center">No invoices yet — create one from a client&apos;s page.</p>
          ) : (
            <ul className="divide-y divide-charcoal/5">
              {d.recentInvoices.map((inv) => (
                <li key={inv.id} className="flex items-center gap-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-mono font-semibold text-ink truncate">{inv.number}</div>
                    <div className="text-xs text-charcoal-60 truncate">/{inv.client_slug}</div>
                  </div>
                  <StatusPill status={inv.status} />
                  <Link href={`/portal/${inv.client_slug}/invoice/${inv.id}`} target="_blank" className="text-xs font-medium text-charcoal-40 hover:text-orange-deep whitespace-nowrap no-underline">
                    PDF ↗
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ---- Client pulse ---- */}
      <div className="lq-card lq-rise p-5" style={{ animationDelay: "480ms" }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-bold text-[16px] tracking-tight text-ink">Client pulse</h2>
          <Link href="/admin/clients" className="text-xs font-semibold text-charcoal-60 hover:text-orange-deep no-underline">All clients →</Link>
        </div>
        {d.clients.length === 0 ? (
          <p className="text-sm text-charcoal-40 py-4 text-center">No client portals yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2.5">
            {d.clients.map((c) => (
              <Link
                key={c.slug}
                href={`/admin/clients/${c.slug}/edit`}
                className="lq-press inline-flex items-center gap-2.5 bg-white/60 border border-charcoal/5 rounded-full ps-1.5 pe-3.5 py-1.5 text-sm no-underline hover:bg-white shadow-[inset_0_1px_0_rgba(255,255,255,.8)]"
              >
                <span className="w-6 h-6 rounded-full shrink-0" style={{ background: c.color }} />
                <span className="font-semibold text-charcoal-80">{c.name}</span>
                {c.pending ? (
                  <span className="lq-chip lq-chip--orange !px-2 !py-0.5 uppercase !text-[9.5px]">Pending</span>
                ) : c.active ? (
                  <span className="lq-chip lq-chip--green !px-2 !py-0.5 uppercase !text-[9.5px]">Active</span>
                ) : null}
                {c.planName && <span className="text-xs text-charcoal-60">{c.planName}</span>}
              </Link>
            ))}
          </div>
        )}
        <div className="mt-4 pt-4 border-t border-charcoal/5 flex flex-wrap gap-x-6 gap-y-1 text-xs text-charcoal-60">
          <span><strong className="text-charcoal-80">{d.projectCount}</strong> published case stud{d.projectCount === 1 ? "y" : "ies"}</span>
          <span><strong className="text-charcoal-80">{d.invoiceStatusCounts.due + d.invoiceStatusCounts.partial}</strong> open invoice{d.invoiceStatusCounts.due + d.invoiceStatusCounts.partial === 1 ? "" : "s"}</span>
          <span><strong className="text-charcoal-80">{d.invoiceStatusCounts.draft}</strong> draft{d.invoiceStatusCounts.draft === 1 ? "" : "s"}</span>
        </div>
      </div>
    </div>
  );
}
