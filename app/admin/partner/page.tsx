import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, canSeePartner } from "@/lib/auth";
import { isDbEnabled } from "@/lib/db";
import { getClients, hasStories } from "@/lib/clients";
import { clientStoriesFinanceIls } from "@/lib/invoices";
import { listAllPayments, ramziAmountOf, type Payment } from "@/lib/payments";
import { addStoriesTaskAction, setStoriesTaskStatusAction, deleteStoriesTaskAction } from "./actions";

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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ramzi</h1>
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-4 py-3 mt-4">No database configured.</p>
      </div>
    );
  }

  const [clients, payments] = await Promise.all([getClients(), listAllPayments()]);
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

  // Last 6 months, oldest → newest, for the mini bar chart (ILS only).
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const k = ymKey(d);
    return { key: k, label: d.toLocaleDateString("en-US", { month: "short" }), b: byMonth.get(k) || blank() };
  });
  const maxMonth = Math.max(1, ...months.map((m) => m.b.ils));

  // Every client connected to Ramzi for stories (explicit toggle) — shown with
  // their work list so Ramzi knows what to do, even before any money is paid.
  const storiesClients = clients.filter((c) => hasStories(c.data));
  const ramziClients = clients.filter((c) => c.data?.owner === "ramzi");

  // Stories money per connected client (billed vs collected, all in ILS) — the
  // "open" figures roll up into the Outstanding card.
  const storiesFinance = new Map<string, { billedIls: number; collectedIls: number; openIls: number }>();
  await Promise.all(
    storiesClients.map(async (c) => storiesFinance.set(c.slug, await clientStoriesFinanceIls(c.id, c.slug)))
  );
  const outstandingIls = Array.from(storiesFinance.values()).reduce((s, v) => s + v.openIls, 0);

  const thisMonthRows = Array.from(thisMonthByClient.entries())
    .map(([slug, v]) => ({ slug, name: nameBySlug.get(slug) || slug, ...v }))
    .sort((a, b) => b.ils + b.usd - (a.ils + a.usd));

  const recent: { p: Payment; amount: number }[] = collected.slice(0, 12);
  const monthLabel = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ramzi</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Your stories month at a glance — {monthLabel}. Private, visible only to you and the super admin.
        </p>
      </div>

      {/* ---- This month at a glance ---- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-charcoal text-white rounded-xl px-5 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-white/60">Collected this month</div>
          <div className="mt-2 text-3xl font-extrabold tracking-tight tabular-nums text-orange">{money(mNow.ils, "ILS")}</div>
          {mNow.usd > 0 && <div className="mt-1 text-sm text-white/70 tabular-nums">+ {money(mNow.usd, "USD")}</div>}
          <div className="text-[11px] text-white/50 mt-1">{mNow.count} payment{mNow.count === 1 ? "" : "s"}</div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-xl px-5 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Last month</div>
          <div className="mt-2 text-3xl font-extrabold tabular-nums text-neutral-900">{money(mLast.ils, "ILS")}</div>
          {mLast.usd > 0 && <div className="mt-1 text-sm text-neutral-500 tabular-nums">+ {money(mLast.usd, "USD")}</div>}
          <div className="text-[11px] text-neutral-400 mt-1">
            {mLast.ils === 0 ? "—" : mNow.ils >= mLast.ils ? `▲ ${money(mNow.ils - mLast.ils, "ILS")} vs last` : `▼ ${money(mLast.ils - mNow.ils, "ILS")} vs last`}
          </div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-xl px-5 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Outstanding stories</div>
          <div className="mt-2 text-3xl font-extrabold tabular-nums text-neutral-900">{money(outstandingIls, "ILS")}</div>
          <div className="text-[11px] text-neutral-400 mt-1">billed but not yet collected</div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-xl px-5 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Stories clients</div>
          <div className="mt-2 text-3xl font-extrabold tabular-nums text-neutral-900">{storiesClients.length}</div>
          <div className="text-[11px] text-neutral-400 mt-1">{ramziClients.length} own client{ramziClients.length === 1 ? "" : "s"} · {money(allTime.ils, "ILS")} all-time</div>
        </div>
      </div>

      {/* ---- 6-month trend ---- */}
      <div className="bg-white border border-neutral-200 rounded-xl p-5">
        <h2 className="font-bold tracking-tight mb-4">Collected — last 6 months</h2>
        <div className="flex items-end gap-3">
          {months.map((m) => (
            <div key={m.key} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="h-4 text-[11px] font-semibold tabular-nums text-neutral-500">{m.b.ils > 0 ? Math.round(m.b.ils).toLocaleString("en-US") : ""}</div>
              {/* Fixed-height track so the inner bar's % has something to fill. */}
              <div className="w-full bg-neutral-100 rounded-md overflow-hidden flex items-end" style={{ height: 96 }}>
                <div
                  className={`w-full rounded-md ${m.key === ymNow ? "bg-orange" : "bg-charcoal/70"}`}
                  style={{ height: `${m.b.ils > 0 ? Math.max(6, (m.b.ils / maxMonth) * 100) : 0}%` }}
                />
              </div>
              <div className={`text-[11px] ${m.key === ymNow ? "font-bold text-orange-deep" : "text-neutral-400"}`}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ---- This month — by client ---- */}
      <div className="bg-white border border-neutral-200 rounded-xl p-5">
        <h2 className="font-bold tracking-tight mb-3">This month — by client</h2>
        {thisMonthRows.length === 0 ? (
          <p className="text-sm text-neutral-400 py-6 text-center">Nothing collected yet this month.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {thisMonthRows.map((r) => (
              <li key={r.slug} className="py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-neutral-900 truncate">{r.name}</div>
                  <div className="text-[11px] text-neutral-500">{r.count} payment{r.count === 1 ? "" : "s"}</div>
                </div>
                <span className="tabular-nums text-sm font-bold text-neutral-900">
                  {r.ils > 0 ? money(r.ils, "ILS") : ""}
                  {r.ils > 0 && r.usd > 0 ? " · " : ""}
                  {r.usd > 0 ? money(r.usd, "USD") : ""}
                </span>
                <Link href={`/admin/clients/${r.slug}/edit`} className="text-xs font-semibold text-neutral-400 hover:text-orange">→</Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Stories — connected clients & Ramzi's work list */}
      <div className="bg-white border border-neutral-200 rounded-xl p-5">
        <h2 className="font-bold tracking-tight mb-1">Stories — clients &amp; work</h2>
        <p className="text-xs text-neutral-500 mb-4">
          Every client connected to you for stories. Track what to produce and see what&apos;s billed vs collected. Connect
          a client by turning on <b>“This client has stories”</b> in their setup.
        </p>
        {storiesClients.length === 0 ? (
          <p className="text-sm text-neutral-400 py-6 text-center">
            No clients connected for stories yet. Turn on “This client has stories” in a client&apos;s setup.
          </p>
        ) : (
          <div className="space-y-5">
            {storiesClients.map((c) => {
              const sf = storiesFinance.get(c.slug) || { billedIls: 0, collectedIls: 0, openIls: 0 };
              const tasks = c.data.storiesTasks || [];
              const fee = c.data.finance?.storiesFee || "";
              return (
                <div key={c.slug} className="rounded-lg border border-neutral-200 p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-neutral-900 truncate">{c.name || c.slug}</div>
                      <div className="text-[11px] text-neutral-500">
                        {fee ? `Fee ${fee} · ` : ""}
                        Collected {money(sf.collectedIls, "ILS")} of {money(sf.billedIls, "ILS")}
                        {sf.openIls > 0 ? ` · ${money(sf.openIls, "ILS")} open` : ""}
                      </div>
                    </div>
                    <Link href={`/admin/clients/${c.slug}/edit`} className="text-xs font-semibold text-neutral-400 hover:text-orange shrink-0">
                      Open client →
                    </Link>
                  </div>

                  {/* Work list */}
                  {tasks.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {tasks.map((t) => (
                        <li key={t.id} className="flex items-center gap-2 flex-wrap">
                          <span className={`flex-1 min-w-0 text-sm ${t.status === "done" ? "text-neutral-400 line-through" : "text-neutral-800"}`}>
                            {t.title}
                            {t.due ? <span className="text-[11px] text-neutral-400"> · due {t.due}</span> : null}
                          </span>
                          <form action={setStoriesTaskStatusAction} className="inline-flex rounded-md border border-neutral-200 overflow-hidden">
                            <input type="hidden" name="slug" value={c.slug} />
                            <input type="hidden" name="id" value={t.id} />
                            {(["todo", "doing", "done"] as const).map((s) => (
                              <button
                                key={s}
                                name="status"
                                value={s}
                                className={`px-2 py-1 text-[11px] font-semibold capitalize ${
                                  t.status === s ? "bg-charcoal text-white" : "bg-white text-neutral-500 hover:text-orange"
                                }`}
                              >
                                {s === "todo" ? "To do" : s}
                              </button>
                            ))}
                          </form>
                          <form action={deleteStoriesTaskAction}>
                            <input type="hidden" name="slug" value={c.slug} />
                            <input type="hidden" name="id" value={t.id} />
                            <button className="px-1.5 text-xs text-neutral-300 hover:text-red-500" title="Remove">✕</button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Add a task */}
                  <form action={addStoriesTaskAction} className="mt-3 flex items-center gap-2 flex-wrap">
                    <input type="hidden" name="slug" value={c.slug} />
                    <input
                      name="title"
                      required
                      placeholder="Add stories work — e.g. 5 daily stories this week"
                      className="flex-1 min-w-[12rem] rounded-md border border-neutral-200 px-3 py-1.5 text-sm focus:border-orange focus:outline-none"
                    />
                    <input
                      name="due"
                      type="date"
                      className="rounded-md border border-neutral-200 px-2 py-1.5 text-sm text-neutral-600 focus:border-orange focus:outline-none"
                    />
                    <button className="rounded-md bg-orange px-3 py-1.5 text-sm font-semibold text-white hover:bg-orange-deep">Add</button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Ramzi's own clients */}
      <div className="bg-white border border-neutral-200 rounded-xl p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="font-bold tracking-tight">Ramzi&apos;s clients</h2>
          <Link href="/admin/clients/new" className="text-xs font-semibold text-neutral-500 hover:text-orange">+ New client</Link>
        </div>
        {ramziClients.length === 0 ? (
          <p className="text-sm text-neutral-400 py-6 text-center">No clients owned by Ramzi yet. Create one, or set a client&apos;s Owner to “Ramzi (partner)”.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {ramziClients.map((c) => (
              <li key={c.slug} className="py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-neutral-900 truncate">{c.name || c.slug}</div>
                  <div className="text-[11px] text-neutral-500">/{c.slug}</div>
                </div>
                <Link href={`/admin/clients/${c.slug}/edit`} className="text-xs font-semibold text-neutral-400 hover:text-orange">Edit →</Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Recent receipts that included Ramzi's stories */}
      {recent.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <h2 className="font-bold tracking-tight mb-3">Recent stories receipts</h2>
          <ul className="divide-y divide-neutral-100">
            {recent.map(({ p, amount }) => (
              <li key={p.id} className="py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-neutral-900 truncate">{nameBySlug.get(p.client_slug) || p.client_slug}</div>
                  <div className="text-[11px] text-neutral-500">{new Date(p.paid_on).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} · {p.number}</div>
                </div>
                <span className="tabular-nums text-sm font-bold text-orange-deep">{money(amount, p.currency)}</span>
                <Link href={`/portal/${p.client_slug}/receipt/${p.id}`} className="text-xs font-semibold text-neutral-400 hover:text-orange">↗</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
