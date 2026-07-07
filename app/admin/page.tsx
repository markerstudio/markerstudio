import Link from "next/link";
import { Suspense } from "react";
import { getSession } from "@/lib/auth";
import { getDashboardData, fmtMoney, timeAgo } from "@/lib/dashboard";
import { getFinance, fmtILS, type FinanceData } from "@/lib/finance";
import { runPaymentHistoryBackfill } from "@/lib/backfill";
import { cleanupReconcilerDuplicates } from "@/lib/notionSync";
import { getBoardData } from "@/lib/taskBoard";
import { getAgenda, type Agenda, type AgendaItem } from "@/lib/agenda";
import TodayTasks from "@/components/admin/tasks/TodayTasks";
import TodayAgenda from "@/components/admin/TodayAgenda";
import type { CSSProperties, ReactNode } from "react";
import { Skeleton } from "@/components/ui/glass";

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

// Async section component — awaited inside <Suspense>, not by the page.
// Renders as a borderless strip inside the Money panel (it brings its own top
// divider so nothing shows when Notion is off or slow).
async function FinanceCard() {
  const fin = await financeSnapshot();
  if (!fin) return null;
  const figures = [
    { label: "In the bank", value: fmtILS(fin.bankTotal), tone: "text-ink" },
    { label: "Clients owe us", value: fmtILS(fin.totalDebt), tone: "text-orange-deep" },
    {
      label: "Overdue",
      value: fin.overdue.length ? `${fin.overdue.length} · ${fmtILS(fin.overdueTotal)}` : "None",
      tone: fin.overdue.length ? "text-rose-600" : "text-ink",
    },
  ];
  const debtors = fin.debtors.filter((x) => x.debt > 0).slice(0, 3);
  return (
    <div className="mt-5 pt-5 border-t border-charcoal/5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-charcoal-60">The books — from Notion</h3>
          <p className="text-xs text-charcoal-60 mt-0.5">
            Live from your Budget Tracker — the source of truth. The figure above tracks what you&apos;ve{" "}
            <b>invoiced in the app</b>, so the two won&apos;t always match.
          </p>
        </div>
        <Link href="/admin/finance" className="text-xs font-semibold text-charcoal-60 hover:text-orange-deep whitespace-nowrap shrink-0 no-underline">Full analysis →</Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-0">
        {figures.map((f, i) => (
          <div key={f.label} className={i > 0 ? "sm:border-s sm:border-charcoal/5 sm:ps-5" : ""}>
            <div className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-charcoal-60">{f.label}</div>
            <div className={`mt-0.5 text-[20px] font-display font-extrabold tabular-nums ${f.tone}`}>{f.value}</div>
          </div>
        ))}
      </div>
      {debtors.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {debtors.map((t) => (
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
  // Agenda is the page's spine now (headline sentence + the Now panel + each
  // client's next need), so it's fetched here — but it must never take the
  // dashboard down.
  let agenda: Agenda | null = null;
  try {
    agenda = await getAgenda(3);
  } catch {
    agenda = null;
  }
  const firstName = (user?.name || "there").split(" ")[0];
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const maxBilled = Math.max(1, ...d.months.map((m) => m.billed));
  const hasMoney = d.months.some((m) => m.billed > 0 || m.collected > 0);

  // ---- The headline sentence — the day's answer, assembled from data we
  // already have. Each segment links to where you act on it.
  const needCount = agenda ? agenda.counts.overdue + agenda.counts.today : 0;
  const inboxCount = d.unreadInquiries + d.unreadApplications;
  const statusBits: { key: string; node: ReactNode }[] = [];
  if (needCount > 0) {
    statusBits.push({
      key: "agenda",
      node: (
        <Link href="/admin/agenda" className="font-semibold text-ink hover:text-orange-deep no-underline">
          {needCount === 1 ? "1 thing needs" : `${needCount} things need`} you today
        </Link>
      ),
    });
  }
  if (d.overdueTotal > 0) {
    statusBits.push({
      key: "overdue",
      node: (
        <Link href="/admin/invoices?f=overdue" className="font-semibold text-rose-600 hover:text-rose-700 no-underline">
          ₪{fmtMoney(d.overdueTotal)} overdue
        </Link>
      ),
    });
  }
  if (inboxCount > 0) {
    statusBits.push({
      key: "inbox",
      node: (
        <Link href="/admin/inquiries" className="font-semibold text-ink hover:text-orange-deep no-underline">
          {inboxCount} waiting in inquiries
        </Link>
      ),
    });
  }

  // ---- Each client's next need — best-effort match from the agenda (by slug)
  // then the attention feed (by name/slug in text or href); plan name is the
  // quiet fallback already on the row.
  const agendaNeed = new Map<string, AgendaItem>();
  if (agenda) {
    for (const it of agenda.all) {
      if (it.clientSlug && !agendaNeed.has(it.clientSlug)) agendaNeed.set(it.clientSlug, it);
    }
  }
  const needFor = (slug: string, name: string): { icon?: string; text: string; urgent: boolean } | null => {
    const a = agendaNeed.get(slug);
    if (a) return { text: a.title, urgent: a.urgency === "overdue" };
    const lower = name.toLowerCase();
    const att = d.attention.find(
      (x) =>
        x.href.includes(`/clients/${slug}/`) ||
        x.text.includes(`(/${slug})`) ||
        (lower.length > 2 && x.text.toLowerCase().includes(lower))
    );
    if (att) return { icon: ATTENTION_ICONS[att.kind], text: att.text, urgent: att.kind === "overdue" };
    return null;
  };

  return (
    <div className="space-y-6">
      {/* ================= ZONE 1 — THE HEADLINE (type on the field) ================= */}
      <header className="flex flex-wrap items-end justify-between gap-4 pt-1">
        <div className="min-w-0">
          <p className="text-[11.5px] font-display font-bold uppercase tracking-[0.16em] text-charcoal-60">{today}</p>
          <h1 className="font-display font-extrabold text-[30px] sm:text-[36px] tracking-tight text-ink leading-tight mt-0.5">
            {greeting()}, <span className="text-orange">{firstName}</span>.
          </h1>
          <p className="text-[15.5px] leading-relaxed text-charcoal-80 mt-2">
            {statusBits.length === 0 ? (
              <>Nothing is on fire — plan the day your way.</>
            ) : (
              statusBits.map((b, i) => (
                <span key={b.key}>
                  {i > 0 && <span className="text-charcoal-40"> · </span>}
                  {b.node}
                </span>
              ))
            )}
          </p>
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

      {/* ================= ZONE 2 — NOW (one dark panel: agenda + tasks) ================= */}
      <section className="lq-dark lq-rise p-5 pb-0 overflow-hidden" style={{ animationDelay: "40ms" }}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="font-display font-bold text-[17px] tracking-tight text-white">Now</h2>
          <div className="flex items-center gap-2">
            {agenda && agenda.counts.overdue > 0 && (
              <span className="text-[10.5px] font-display font-bold uppercase tracking-wide bg-rose-500/25 text-rose-200 rounded-full px-2.5 py-1">
                {agenda.counts.overdue} overdue
              </span>
            )}
            <Link
              href="/admin/agenda"
              className="lq-press inline-flex items-center gap-1.5 text-[12px] font-display font-semibold text-white/80 hover:text-white no-underline bg-white/10 rounded-full px-3 py-1.5"
            >
              Full agenda →
            </Link>
          </div>
        </div>

        {agenda ? (
          <TodayAgenda agenda={agenda} />
        ) : (
          <p className="text-[13px] text-white/60 py-1">
            The agenda couldn&apos;t load — the{" "}
            <Link href="/admin/agenda" className="text-orange-soft font-semibold no-underline">full agenda</Link> has the picture.
          </p>
        )}

        {/* Tasks slice — the panel's light tray: edge-to-edge at the foot, so
            the interactive widget reads as part of the composition rather than
            a card floating inside a card. */}
        <div className="mt-4 -mx-5 [&_.lq-card]:!shadow-none [&_.lq-card]:!border-0 [&_.lq-card]:!rounded-none [&>div>.lq-card]:!bg-none [&_.lq-card]:!bg-[#FAF8F4] [&_.p-5]:px-5">
          <Suspense
            fallback={
              <div aria-busy="true" className="space-y-2.5">
                <Skeleton className="h-4 w-24 opacity-20" />
                <Skeleton className="h-5 opacity-20" />
                <Skeleton className="h-5 opacity-20" />
                <Skeleton className="h-9 opacity-20" />
              </div>
            }
          >
            <TodayTasksCard />
          </Suspense>
        </div>
      </section>

      {/* ================= ZONE 3 — MONEY (one card: lead figure + cashflow + books + invoices) ================= */}
      <section className="lq-card lq-rise p-5" style={{ animationDelay: "120ms" }}>
        <h2 className="font-display font-bold text-[16px] tracking-tight text-ink mb-4">Money</h2>

        {/* Lead row — Outstanding dominates; the 6-month pulse sits at the end. */}
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
          <div className="min-w-0">
            <div className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-charcoal-60">Outstanding</div>
            <Link
              href="/admin/invoices"
              className="block font-display font-extrabold text-[34px] sm:text-[38px] leading-none tracking-tight text-ink tabular-nums no-underline mt-1.5 hover:text-orange-deep transition-colors"
            >
              ₪{fmtMoney(d.outstanding)}
            </Link>
            <div className="mt-3">
              {d.overdueCount > 0 ? (
                <Link href="/admin/invoices?f=overdue" className="lq-chip lq-chip--red lq-press no-underline">
                  ₪{fmtMoney(d.overdueTotal)} across {d.overdueCount} invoice{d.overdueCount === 1 ? "" : "s"} · chase →
                </Link>
              ) : (
                <span className="lq-chip lq-chip--green">All on schedule</span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-start sm:items-end gap-2 ms-0 sm:ms-auto">
            {hasMoney ? (
              <div className="flex items-end gap-2 h-16">
                {d.months.map((m, i) => {
                  const billedH = Math.round((m.billed / maxBilled) * 100);
                  const collectedH = Math.round((m.collected / maxBilled) * 100);
                  return (
                    <div
                      key={m.label}
                      className="flex flex-col items-center gap-1 h-full justify-end"
                      title={`${m.label}: billed ${fmtMoney(m.billed)} · collected ${fmtMoney(m.collected)}`}
                    >
                      <div className="relative w-5 sm:w-6 flex-1 flex items-end justify-center">
                        <div className="adm-bar absolute bottom-0 w-full rounded-t bg-charcoal/10" style={{ height: `${billedH}%`, animationDelay: `${200 + i * 60}ms` }} />
                        <div
                          className="adm-bar absolute bottom-0 w-full rounded-t bg-gradient-to-t from-[#F57F00] to-[#FFA226] shadow-[0_6px_14px_-6px_rgba(255,145,0,.5)]"
                          style={{ height: `${collectedH}%`, animationDelay: `${260 + i * 60}ms` }}
                        />
                      </div>
                      <span className="text-[9.5px] font-medium text-charcoal-40">{m.label}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-16 flex items-center text-xs text-charcoal-40">No invoices in the last six months — totals will chart here.</div>
            )}
            <div className="flex items-center gap-3 text-[10.5px] text-charcoal-60">
              <span className="inline-flex items-center gap-1.5"><i className="w-2 h-2 rounded-sm bg-orange inline-block" /> collected</span>
              <span className="inline-flex items-center gap-1.5"><i className="w-2 h-2 rounded-sm bg-charcoal-20 inline-block" /> billed</span>
            </div>
            <Link href="/admin/finance" className="text-[11.5px] text-charcoal-60 hover:text-orange-deep no-underline">
              This month: <strong className="text-charcoal-80 tabular-nums">₪{fmtMoney(d.thisMonthCollected)}</strong> collected ·{" "}
              <span className="tabular-nums">₪{fmtMoney(d.thisMonthBilled)}</span> billed
            </Link>
            <Link href="/admin/invoices?f=paid" className="text-[11.5px] text-charcoal-60 hover:text-orange-deep no-underline">
              Year: <strong className="text-charcoal-80 tabular-nums">₪{fmtMoney(d.collectedYear)}</strong> collected ·{" "}
              {d.invoiceStatusCounts.paid} paid invoice{d.invoiceStatusCounts.paid === 1 ? "" : "s"}
            </Link>
          </div>
        </div>

        {/* The books — Notion Budget Tracker strip, streams in with its own divider. */}
        <Suspense
          fallback={
            <div className="mt-5 pt-5 border-t border-charcoal/5" aria-busy="true">
              <Skeleton className="h-4 w-32 mb-4" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            </div>
          }
        >
          <FinanceCard />
        </Suspense>

        {/* Latest invoices — three compact rows. */}
        <div className="mt-5 pt-5 border-t border-charcoal/5">
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-charcoal-60">Latest invoices</h3>
            <Link href="/admin/invoices" className="text-xs font-semibold text-charcoal-60 hover:text-orange-deep no-underline">All →</Link>
          </div>
          {d.recentInvoices.length === 0 ? (
            <p className="text-sm text-charcoal-40 py-3">No invoices yet — create one from a client&apos;s page.</p>
          ) : (
            <ul className="divide-y divide-charcoal/5">
              {d.recentInvoices.slice(0, 3).map((inv) => (
                <li key={inv.id} className="flex items-center gap-3 py-2">
                  <span className="text-sm font-mono font-semibold text-ink whitespace-nowrap">{inv.number}</span>
                  <span className="flex-1 min-w-0 text-xs text-charcoal-60 truncate">/{inv.client_slug}</span>
                  <StatusPill status={inv.status} />
                  <Link
                    href={`/portal/${inv.client_slug}/invoice/${inv.id}`}
                    target="_blank"
                    className="text-xs font-medium text-charcoal-40 hover:text-orange-deep whitespace-nowrap no-underline"
                  >
                    PDF ↗
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ================= ZONE 4 — CLIENTS (one card: roster + inbox) ================= */}
      <section className="lq-card lq-rise p-5" style={{ animationDelay: "200ms" }}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display font-bold text-[16px] tracking-tight text-ink">Clients</h2>
          <Link href="/admin/clients" className="text-xs font-semibold text-charcoal-60 hover:text-orange-deep no-underline">All clients →</Link>
        </div>
        {d.clients.length === 0 ? (
          <p className="text-sm text-charcoal-40 py-4 text-center">No client portals yet.</p>
        ) : (
          <ul className="divide-y divide-charcoal/5 lq-stagger">
            {d.clients.map((c, i) => {
              const need = needFor(c.slug, c.name);
              return (
                <li key={c.slug} style={{ "--i": i } as CSSProperties}>
                  <Link href={`/admin/clients/${c.slug}/edit`} className="group flex items-center gap-3 py-2.5 no-underline min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                    <span className="text-sm font-semibold text-ink truncate group-hover:text-orange-deep transition-colors">{c.name}</span>
                    {c.planName && <span className="hidden sm:inline text-xs text-charcoal-60 whitespace-nowrap shrink-0">{c.planName}</span>}
                    {c.pending ? (
                      <span className="lq-chip lq-chip--orange !px-2 !py-0.5 uppercase !text-[9.5px] shrink-0">Pending</span>
                    ) : c.active ? (
                      <span className="lq-chip lq-chip--green !px-2 !py-0.5 uppercase !text-[9.5px] shrink-0">Active</span>
                    ) : null}
                    <span
                      className={`flex-1 min-w-0 truncate text-end text-xs ${
                        need ? (need.urgent ? "text-rose-600 font-semibold" : "text-charcoal-60") : "text-charcoal-40"
                      }`}
                    >
                      {need ? `${need.icon ? `${need.icon} ` : ""}${need.text}` : ""}
                    </span>
                    <span className="text-charcoal-20 group-hover:text-orange transition-colors shrink-0">→</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {/* Inbox — one row per channel; detail lives on its page. */}
        <div className="mt-4 pt-4 border-t border-charcoal/5">
          <h3 className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-charcoal-60 mb-1">Inbox</h3>
          <ul className="divide-y divide-charcoal/5">
            <li>
              <Link href="/admin/inquiries" className="group flex items-center gap-3 py-2.5 text-sm no-underline">
                <span aria-hidden className="shrink-0">✉️</span>
                <span className="flex-1 min-w-0 truncate text-charcoal-80 group-hover:text-ink">
                  Inquiries
                  {d.recentInquiries[0] ? (
                    <span className="text-charcoal-40"> · latest {timeAgo(d.recentInquiries[0].created_at)}</span>
                  ) : (
                    <span className="text-charcoal-40"> · they&apos;ll land here from the contact form</span>
                  )}
                </span>
                {d.unreadInquiries > 0 ? (
                  <span className="lq-chip lq-chip--orange !px-2 !py-0.5 !text-[10px] shrink-0">{d.unreadInquiries} unread</span>
                ) : (
                  <span className="text-[11px] text-charcoal-40 shrink-0">all read</span>
                )}
                <span className="text-charcoal-20 group-hover:text-orange transition-colors shrink-0">→</span>
              </Link>
            </li>
            <li>
              <Link href="/admin/applications" className="group flex items-center gap-3 py-2.5 text-sm no-underline">
                <span aria-hidden className="shrink-0">👋</span>
                <span className="flex-1 min-w-0 truncate text-charcoal-80 group-hover:text-ink">Job applications</span>
                {d.unreadApplications > 0 ? (
                  <span className="lq-chip lq-chip--orange !px-2 !py-0.5 !text-[10px] shrink-0">{d.unreadApplications} unread</span>
                ) : (
                  <span className="text-[11px] text-charcoal-40 shrink-0">all read</span>
                )}
                <span className="text-charcoal-20 group-hover:text-orange transition-colors shrink-0">→</span>
              </Link>
            </li>
          </ul>
        </div>

        <div className="mt-4 pt-4 border-t border-charcoal/5 flex flex-wrap gap-x-6 gap-y-1 text-xs text-charcoal-60">
          <span><strong className="text-charcoal-80">{d.projectCount}</strong> published case stud{d.projectCount === 1 ? "y" : "ies"}</span>
          <span><strong className="text-charcoal-80">{d.invoiceStatusCounts.due + d.invoiceStatusCounts.partial}</strong> open invoice{d.invoiceStatusCounts.due + d.invoiceStatusCounts.partial === 1 ? "" : "s"}</span>
          <span><strong className="text-charcoal-80">{d.invoiceStatusCounts.draft}</strong> draft{d.invoiceStatusCounts.draft === 1 ? "" : "s"}</span>
          <span><strong className="text-charcoal-80">{d.activeClients}</strong> of {d.totalClients} portal{d.totalClients === 1 ? "" : "s"} active</span>
        </div>
      </section>
    </div>
  );
}
