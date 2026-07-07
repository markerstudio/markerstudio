import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, canSeePartner, isSuperAdmin } from "@/lib/auth";
import { isDbEnabled } from "@/lib/db";
import { getClients, hasStories } from "@/lib/clients";
import { listInvoices, isRamziLine, amountLabelToIls } from "@/lib/invoices";
import { APPROX_USD_ILS } from "@/lib/money";
import { listAllPayments, ramziAmountOf, type Payment } from "@/lib/payments";
import { listModelingSessions } from "@/lib/modelingSessions";
import ModelingSessionForm from "@/components/admin/ModelingSessionForm";
import { EmptyState } from "@/components/ui/glass";
import { deleteModelingSessionAction } from "./modeling-actions";

export const dynamic = "force-dynamic";

function money(n: number, currency: string) {
  const v = Math.round(n).toLocaleString("en-US");
  return currency === "USD" ? `$${v}` : `${v} ILS`;
}

type Bucket = { ils: number; usd: number; count: number };
const blank = (): Bucket => ({ ils: 0, usd: 0, count: 0 });
function addTo(b: Bucket, currency: string, amount: number) {
  if (currency === "USD") b.usd += amount;
  else b.ils += amount;
  b.count++;
}

export default async function PartnerPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  // Walled off: only Ramzi and the super admin. Regular admins (Maram) can't.
  if (!canSeePartner(user)) redirect("/admin");

  if (!isDbEnabled()) {
    return (
      <div className="space-y-5">
        <header>
          <p className="text-[11px] font-display font-bold uppercase tracking-[0.14em] text-charcoal-60">Partner</p>
          <h1 className="font-display font-extrabold text-[28px] tracking-tight text-ink leading-tight mt-1">Ramzi</h1>
        </header>
        <p className="lq-card text-sm text-amber-800 px-4 py-3 !border-amber-300/40">No database configured.</p>
      </div>
    );
  }

  const [clients, payments, invoices, modeling] = await Promise.all([
    getClients(),
    listAllPayments(),
    listInvoices(),
    listModelingSessions(),
  ]);
  const nameBySlug = new Map(clients.map((c) => [c.slug, c.name || c.slug]));

  // Stories collected for Ramzi across every client, by payment.
  const collected = payments
    .map((p) => ({ p, amount: ramziAmountOf(p) }))
    .filter((x) => x.amount > 0);

  // ---- Month buckets -------------------------------------------------------
  // Build month keys ("YYYY-MM") from LOCAL date parts. `paid_on` can come back
  // from the driver as a Date object (not a string), and toISOString() shifts a
  // local-midnight date into the previous month for east-of-UTC zones — both of
  // which silently mis-bucketed every payment, leaving the chart empty.
  const now = new Date();
  const ymKey = (v: unknown): string => {
    if (typeof v === "string" && /^\d{4}-\d{2}/.test(v)) return v.slice(0, 7);
    const d = v instanceof Date ? v : new Date(String(v ?? ""));
    return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  const ymNow = ymKey(now);
  const ymLast = ymKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));

  const byMonth = new Map<string, Bucket>();
  const thisMonthByClient = new Map<string, Bucket>();
  const allTime = blank();
  for (const { p, amount } of collected) {
    const k = ymKey(p.paid_on);
    const b = byMonth.get(k) || blank();
    addTo(b, p.currency, amount);
    byMonth.set(k, b);
    addTo(allTime, p.currency, amount);
    if (k === ymNow) {
      const cb = thisMonthByClient.get(p.client_slug) || blank();
      addTo(cb, p.currency, amount);
      thisMonthByClient.set(p.client_slug, cb);
    }
  }
  const mNow = byMonth.get(ymNow) || blank();
  const mLast = byMonth.get(ymLast) || blank();

  // ---- Modeling sessions (Ramzi's own, kept apart from stories) -------------
  // His private modeling ledger: total earned all-time and this month, split by
  // currency. Counts only toward his money — never Marker's books or Notion.
  const modelAll = blank();
  const modelMonth = blank();
  for (const s of modeling) {
    const amount = Number(s.amount) || 0;
    addTo(modelAll, s.currency, amount);
    if (ymKey(s.session_date) === ymNow) addTo(modelMonth, s.currency, amount);
  }

  // Last 6 months, oldest → newest, for the mini bar chart (ILS only).
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const k = ymKey(d);
    return { key: k, label: d.toLocaleDateString("en-US", { month: "short" }), b: byMonth.get(k) || blank() };
  });
  const maxMonth = Math.max(1, ...months.map((m) => m.b.ils));

  // Every client connected to Ramzi for stories (explicit toggle).
  const storiesClients = clients.filter((c) => hasStories(c.data));
  const ramziClients = clients.filter((c) => c.data?.owner === "ramzi");

  // ---- Per-client stories billing & collection -----------------------------
  // Billed = stories invoice lines (this cycle + all-time) from one invoices
  // query; collected = the stories part of payments (this cycle + all-time).
  // This drives the per-client "due each cycle vs paid" view below.
  type Money2 = { total: number; cycle: number };
  const billedBy = new Map<string, Money2>();
  for (const inv of invoices) {
    if (inv.archived_at || inv.status === "draft") continue;
    const ils = (inv.items || []).filter(isRamziLine).reduce((s, it) => s + amountLabelToIls(it.amount || ""), 0);
    if (ils <= 0) continue;
    const e = billedBy.get(inv.client_slug) || { total: 0, cycle: 0 };
    e.total += ils;
    if (ymKey(inv.issued_date) === ymNow) e.cycle += ils;
    billedBy.set(inv.client_slug, e);
  }
  const collectedBy = new Map<string, Money2>();
  for (const { p, amount } of collected) {
    const ils = amount * (p.currency === "USD" ? APPROX_USD_ILS : 1);
    const e = collectedBy.get(p.client_slug) || { total: 0, cycle: 0 };
    e.total += ils;
    if (ymKey(p.paid_on) === ymNow) e.cycle += ils;
    collectedBy.set(p.client_slug, e);
  }
  const storyOf = (slug: string) => {
    const billed = billedBy.get(slug) || { total: 0, cycle: 0 };
    const coll = collectedBy.get(slug) || { total: 0, cycle: 0 };
    return {
      billedTotal: Math.round(billed.total),
      billedCycle: Math.round(billed.cycle),
      collectedTotal: Math.round(coll.total),
      collectedCycle: Math.round(coll.cycle),
      openTotal: Math.max(0, Math.round(billed.total - coll.total)),
    };
  };
  const outstandingIls = storiesClients.reduce((s, c) => s + storyOf(c.slug).openTotal, 0);
  // Clients with no stories invoice raised yet this cycle — the "to bill" queue.
  const toBillCount = storiesClients.filter((c) => storyOf(c.slug).billedCycle <= 0).length;

  const thisMonthRows = Array.from(thisMonthByClient.entries())
    .map(([slug, v]) => ({ slug, name: nameBySlug.get(slug) || slug, ...v }))
    .sort((a, b) => b.ils + b.usd - (a.ils + a.usd));

  const recent: { p: Payment; amount: number }[] = collected.slice(0, 12);
  const monthLabel = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-display font-bold uppercase tracking-[0.14em] text-charcoal-60">Partner · {monthLabel}</p>
          <h1 className="font-display font-extrabold text-[28px] tracking-tight text-ink leading-tight mt-1">Ramzi</h1>
          <p className="text-sm text-charcoal-60 mt-1">
            Your stories month at a glance — {monthLabel}. Private, visible only to you and the super admin.
          </p>
        </div>
        {isSuperAdmin(user) && (
          <Link href="/admin/backfill" className="lq-btn lq-btn--glass lq-btn--sm no-underline shrink-0">
            Stories backfill →
          </Link>
        )}
      </header>

      {/* ---- This month at a glance ---- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="lq-dark lq-rise px-5 py-4" style={{ animationDelay: "40ms" }}>
          <div className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-white/60">Collected this month</div>
          <div className="mt-2 font-display font-extrabold text-[26px] tracking-tight tabular-nums text-orange">{money(mNow.ils, "ILS")}</div>
          {mNow.usd > 0 && <div className="mt-1 text-sm text-white/70 tabular-nums">+ {money(mNow.usd, "USD")}</div>}
          <div className="text-[11px] text-white/50 mt-1">{mNow.count} payment{mNow.count === 1 ? "" : "s"}</div>
        </div>
        <div className="lq-card lq-rise px-5 py-4" style={{ animationDelay: "90ms" }}>
          <div className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-charcoal-60">Last month</div>
          <div className="mt-2 font-display font-extrabold text-[26px] tracking-tight tabular-nums text-ink">{money(mLast.ils, "ILS")}</div>
          {mLast.usd > 0 && <div className="mt-1 text-sm text-charcoal-60 tabular-nums">+ {money(mLast.usd, "USD")}</div>}
          <div className="text-[11px] text-charcoal-40 mt-1">
            {mLast.ils === 0 ? "—" : mNow.ils >= mLast.ils ? `▲ ${money(mNow.ils - mLast.ils, "ILS")} vs last` : `▼ ${money(mLast.ils - mNow.ils, "ILS")} vs last`}
          </div>
        </div>
        <div className="lq-card lq-rise px-5 py-4" style={{ animationDelay: "140ms" }}>
          <div className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-charcoal-60">Outstanding stories</div>
          <div className="mt-2 font-display font-extrabold text-[26px] tracking-tight tabular-nums text-ink">{money(outstandingIls, "ILS")}</div>
          <div className="text-[11px] text-charcoal-40 mt-1">billed but not yet collected</div>
        </div>
        <div className="lq-card lq-rise px-5 py-4" style={{ animationDelay: "190ms" }}>
          <div className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-charcoal-60">Stories clients</div>
          <div className="mt-2 font-display font-extrabold text-[26px] tracking-tight tabular-nums text-ink">{storiesClients.length}</div>
          <div className="text-[11px] text-charcoal-40 mt-1">{ramziClients.length} own client{ramziClients.length === 1 ? "" : "s"} · {money(allTime.ils, "ILS")} all-time</div>
        </div>
      </div>

      {/* ---- Modeling sessions — Ramzi's own work with Marker ---- */}
      <div className="lq-card lq-rise p-5" style={{ animationDelay: "160ms" }}>
        <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
          <div>
            <h2 className="font-display font-bold text-[16px] tracking-tight text-ink">Modeling sessions</h2>
            <p className="text-xs text-charcoal-60 mt-0.5">
              Your own modeling work — log a session and what you earned. Private to you, counts only toward your money.
            </p>
          </div>
          <div className="text-end">
            <div className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-charcoal-60">Earned this month</div>
            <div className="font-display font-extrabold text-xl tracking-tight tabular-nums text-orange-deep">
              {money(modelMonth.ils, "ILS")}
              {modelMonth.usd > 0 ? ` · ${money(modelMonth.usd, "USD")}` : ""}
            </div>
            <div className="text-[11px] text-charcoal-40 mt-0.5">
              {money(modelAll.ils, "ILS")}
              {modelAll.usd > 0 ? ` · ${money(modelAll.usd, "USD")}` : ""} all-time · {modelAll.count} session{modelAll.count === 1 ? "" : "s"}
            </div>
          </div>
        </div>

        <div className="mt-4 lq-well p-4">
          <ModelingSessionForm />
        </div>

        {modeling.length === 0 ? (
          <p className="text-sm text-charcoal-40 py-6 text-center">No modeling sessions logged yet. Add your first one above.</p>
        ) : (
          <ul className="mt-2 divide-y divide-charcoal/5">
            {modeling.map((s) => (
              <li key={s.id} className="py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-ink truncate">{s.name}</div>
                  <div className="text-[11px] text-charcoal-60">
                    {new Date(s.session_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    {s.note ? ` · ${s.note}` : ""}
                  </div>
                </div>
                <span className="tabular-nums text-sm font-bold text-ink">{money(Number(s.amount) || 0, s.currency)}</span>
                <form action={deleteModelingSessionAction}>
                  <input type="hidden" name="id" value={s.id} />
                  <button
                    type="submit"
                    className="lq-press text-xs font-semibold text-charcoal-40 hover:text-rose-700"
                    aria-label={`Remove ${s.name}`}
                    title="Remove session"
                  >
                    ✕
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ---- 6-month trend ---- */}
      <div className="lq-card lq-rise p-5" style={{ animationDelay: "220ms" }}>
        <h2 className="font-display font-bold text-[16px] tracking-tight text-ink mb-4">Collected — last 6 months</h2>
        <div className="flex items-end gap-3">
          {months.map((m) => (
            <div key={m.key} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="h-4 text-[11px] font-semibold tabular-nums text-charcoal-60">{m.b.ils > 0 ? Math.round(m.b.ils).toLocaleString("en-US") : ""}</div>
              {/* Fixed-height track so the inner bar's % has something to fill. */}
              <div className="w-full bg-charcoal/5 rounded-lg overflow-hidden flex items-end" style={{ height: 96 }}>
                <div
                  className={`w-full rounded-lg ${m.key === ymNow ? "bg-gradient-to-t from-[#F57F00] to-[#FFA226]" : "bg-charcoal/60"}`}
                  style={{ height: `${m.b.ils > 0 ? Math.max(6, (m.b.ils / maxMonth) * 100) : 0}%` }}
                />
              </div>
              <div className={`text-[11px] ${m.key === ymNow ? "font-bold text-orange-deep" : "text-charcoal-40"}`}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ---- This month — by client ---- */}
      <div className="lq-card lq-rise p-5" style={{ animationDelay: "280ms" }}>
        <h2 className="font-display font-bold text-[16px] tracking-tight text-ink mb-3">This month — by client</h2>
        {thisMonthRows.length === 0 ? (
          <p className="text-sm text-charcoal-40 py-6 text-center">Nothing collected yet this month.</p>
        ) : (
          <ul className="divide-y divide-charcoal/5">
            {thisMonthRows.map((r) => (
              <li key={r.slug} className="py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-ink truncate">{r.name}</div>
                  <div className="text-[11px] text-charcoal-60">{r.count} payment{r.count === 1 ? "" : "s"}</div>
                </div>
                <span className="tabular-nums text-sm font-bold text-ink">
                  {r.ils > 0 ? money(r.ils, "ILS") : ""}
                  {r.ils > 0 && r.usd > 0 ? " · " : ""}
                  {r.usd > 0 ? money(r.usd, "USD") : ""}
                </span>
                <Link href={`/admin/clients/${r.slug}/edit`} className="text-xs font-semibold text-charcoal-40 hover:text-orange-deep no-underline">→</Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Stories — per-client dues this cycle vs paid, with billing actions */}
      <div className="lq-card lq-rise p-5" style={{ animationDelay: "340ms" }}>
        <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
          <h2 className="font-display font-bold text-[16px] tracking-tight text-ink">Stories — dues &amp; collection</h2>
          {toBillCount > 0 && (
            <span className="lq-chip lq-chip--orange">
              {toBillCount} to bill for {now.toLocaleDateString("en-US", { month: "long" })}
            </span>
          )}
        </div>
        <p className="text-xs text-charcoal-60 mb-4">
          What each stories client owes this cycle and what they&apos;ve paid. At month end, create the invoice (add the
          stories &amp; marketing lines), then record the payment as it comes in. Connect a client with <b>“This client has
          stories”</b> in their setup.
        </p>
        {storiesClients.length === 0 ? (
          <EmptyState
            icon="📱"
            title="No clients connected for stories yet"
            sub={<>Turn on “This client has stories” in a client&apos;s setup.</>}
          />
        ) : (
          <div className="space-y-3">
            {storiesClients.map((c) => {
              const s = storyOf(c.slug);
              const fee = c.data.finance?.storiesFee || "";
              const status = s.billedCycle <= 0 ? "bill" : s.openTotal > 0 ? "due" : "settled";
              const badge =
                status === "bill"
                  ? { text: "Bill this month", cls: "lq-chip--orange" }
                  : status === "due"
                  ? { text: "Awaiting payment", cls: "lq-chip--blue" }
                  : { text: "Settled", cls: "lq-chip--green" };
              return (
                <div key={c.slug} className="lq-well p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-ink truncate">{c.name || c.slug}</div>
                      <div className="text-[11px] text-charcoal-60">{fee ? `Fee ${fee}` : "No stories fee set"}</div>
                    </div>
                    <span className={`lq-chip ${badge.cls}`}>{badge.text}</span>
                  </div>

                  {/* This cycle vs paid */}
                  <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-xl bg-white/70 border border-charcoal/5 py-2">
                      <div className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-charcoal-40">Billed {now.toLocaleDateString("en-US", { month: "short" })}</div>
                      <div className="text-sm font-bold tabular-nums text-ink">{money(s.billedCycle, "ILS")}</div>
                    </div>
                    <div className="rounded-xl bg-white/70 border border-charcoal/5 py-2">
                      <div className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-charcoal-40">Paid {now.toLocaleDateString("en-US", { month: "short" })}</div>
                      <div className="text-sm font-bold tabular-nums text-ink">{money(s.collectedCycle, "ILS")}</div>
                    </div>
                    <div className="rounded-xl bg-white/70 border border-charcoal/5 py-2">
                      <div className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-charcoal-40">Outstanding</div>
                      <div className={`text-sm font-bold tabular-nums ${s.openTotal > 0 ? "text-orange-deep" : "text-ink"}`}>{money(s.openTotal, "ILS")}</div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <Link href={`/admin/clients/${c.slug}/edit`} className="lq-btn lq-btn--primary lq-btn--sm no-underline">
                      Create invoice →
                    </Link>
                    <Link href="/admin/payments/new" className="lq-btn lq-btn--glass lq-btn--sm no-underline">
                      Record payment
                    </Link>
                    <Link href={`/admin/clients/${c.slug}/edit`} className="ms-auto text-xs font-semibold text-charcoal-40 hover:text-orange-deep no-underline">
                      Open client →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Ramzi's own clients */}
      <div className="lq-card lq-rise p-5" style={{ animationDelay: "400ms" }}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="font-display font-bold text-[16px] tracking-tight text-ink">Ramzi&apos;s clients</h2>
          <Link href="/admin/clients/new" className="text-xs font-semibold text-charcoal-60 hover:text-orange-deep no-underline">+ New client</Link>
        </div>
        {ramziClients.length === 0 ? (
          <p className="text-sm text-charcoal-40 py-6 text-center">No clients owned by Ramzi yet. Create one, or set a client&apos;s Owner to “Ramzi (partner)”.</p>
        ) : (
          <ul className="divide-y divide-charcoal/5">
            {ramziClients.map((c) => (
              <li key={c.slug} className="py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-ink truncate">{c.name || c.slug}</div>
                  <div className="text-[11px] text-charcoal-60">/{c.slug}</div>
                </div>
                <Link href={`/admin/clients/${c.slug}/edit`} className="text-xs font-semibold text-charcoal-40 hover:text-orange-deep no-underline">Edit →</Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Recent receipts that included Ramzi's stories */}
      {recent.length > 0 && (
        <div className="lq-card lq-rise p-5" style={{ animationDelay: "460ms" }}>
          <h2 className="font-display font-bold text-[16px] tracking-tight text-ink mb-3">Recent stories receipts</h2>
          <ul className="divide-y divide-charcoal/5">
            {recent.map(({ p, amount }) => (
              <li key={p.id} className="py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-ink truncate">{nameBySlug.get(p.client_slug) || p.client_slug}</div>
                  <div className="text-[11px] text-charcoal-60">{new Date(p.paid_on).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} · {p.number}</div>
                </div>
                <span className="tabular-nums text-sm font-bold text-orange-deep">{money(amount, p.currency)}</span>
                <Link href={`/portal/${p.client_slug}/receipt/${p.id}`} className="text-xs font-semibold text-charcoal-40 hover:text-orange-deep no-underline">↗</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
