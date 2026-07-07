import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { isDbEnabled } from "@/lib/db";
import { getClients, slugify } from "@/lib/clients";
import { listAllPayments, ramziAmountOf } from "@/lib/payments";
import { STORIES_BACKFILL_2026, ymKey, dedupKey, monthLabel } from "./plan";
import { runStoriesBackfillAction, removeBackfillDuplicatesAction } from "./actions";

export const dynamic = "force-dynamic";

const ils = (n: number) => `${Math.round(n).toLocaleString("en-US")} ILS`;

export default async function BackfillPage({
  searchParams,
}: {
  searchParams: { created?: string; skipped?: string; removed?: string; removedRows?: string };
}) {
  const user = await getSession();
  if (!user) redirect("/login");
  // Sensitive one-off tool — super admin only.
  if (!isSuperAdmin(user) || !isDbEnabled()) redirect("/admin");

  const [clients, payments] = await Promise.all([getClients(), listAllPayments()]);
  const byName = new Map(clients.map((c) => [c.name.toLowerCase(), c]));
  const bySlug = new Map(clients.map((c) => [c.slug, c]));

  // Duplicate clients an earlier run created (real client pinned to a different
  // slug, an empty backfill copy sitting at slugify(name)).
  const dupes = STORIES_BACKFILL_2026.flatMap((e) => {
    if (!e.slug || e.slug === slugify(e.name)) return [];
    const autoSlug = slugify(e.name);
    const c = bySlug.get(autoSlug);
    if (!c) return [];
    const bf = payments.filter((p) => p.client_slug === autoSlug && p.note === "Stories backfill 2026").length;
    return [{ name: e.name, autoSlug, realSlug: e.slug, bf }];
  });

  const rows = STORIES_BACKFILL_2026.map((entry) => {
    const client = (entry.slug && bySlug.get(entry.slug)) || byName.get(entry.name.toLowerCase()) || null;
    const existing = client
      ? payments
          .filter((p) => p.client_slug === client.slug && ramziAmountOf(p) > 0)
          .map((p) => ({ ym: ymKey(p.paid_on), amount: ramziAmountOf(p) }))
      : [];
    const seen = new Set(existing.map((e) => dedupKey(e.ym, e.amount)));
    const cycles = entry.dates.map((date) => ({ date, dup: seen.has(dedupKey(ymKey(date), entry.fee)) }));
    const newCount = cycles.filter((c) => !c.dup).length;
    return {
      entry,
      client,
      existingCount: existing.length,
      cycles,
      newCount,
      newAmount: newCount * entry.fee,
    };
  });

  const totalNew = rows.reduce((s, r) => s + r.newAmount, 0);
  const totalNewCount = rows.reduce((s, r) => s + r.newCount, 0);
  const totalSkip = rows.reduce((s, r) => s + r.cycles.filter((c) => c.dup).length, 0);
  const done = searchParams.created != null;

  return (
    <div className="space-y-5 max-w-3xl">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-display font-bold uppercase tracking-[0.14em] text-charcoal-60">One-off import tool</p>
          <h1 className="font-display font-extrabold text-[28px] tracking-tight text-ink leading-tight mt-1">Stories backfill — 2026</h1>
          <p className="text-sm text-charcoal-60 mt-1">
            One-off import of Ramzi&apos;s received stories payments. Ramzi-only — never Marker income, never synced to Notion.
          </p>
        </div>
        <Link href="/admin/partner" className="lq-btn lq-btn--glass lq-btn--sm no-underline shrink-0">← Ramzi</Link>
      </header>

      {done && (
        <div className="lq-card !border-emerald-300/40 px-4 py-3 text-sm text-emerald-800">
          Done — created <b>{searchParams.created}</b> payment{searchParams.created === "1" ? "" : "s"}, skipped{" "}
          <b>{searchParams.skipped}</b> already-existing. The numbers below now reflect the new state.
        </div>
      )}

      {searchParams.removed != null && (
        <div className="lq-card !border-emerald-300/40 px-4 py-3 text-sm text-emerald-800">
          Removed <b>{searchParams.removed}</b> duplicate client{searchParams.removed === "1" ? "" : "s"} and{" "}
          <b>{searchParams.removedRows}</b> backfilled payment{searchParams.removedRows === "1" ? "" : "s"}.
        </div>
      )}

      {dupes.length > 0 && (
        <div className="lq-card lq-rise !border-rose-300/50 p-5">
          <h2 className="font-display font-bold text-[16px] tracking-tight text-rose-800">Duplicate clients to remove</h2>
          <p className="text-xs text-rose-700/80 mt-1 mb-3">
            An earlier run created empty copies of these clients at the wrong slug. Removing them deletes the copy and its
            backfilled payments only — your real client (and any real data) is never touched.
          </p>
          <ul className="space-y-1.5 mb-4">
            {dupes.map((d) => (
              <li key={d.autoSlug} className="text-sm text-rose-900 flex items-center gap-2 flex-wrap">
                <b>{d.name}</b>
                <span className="text-rose-700/70">delete copy <code>/{d.autoSlug}</code> ({d.bf} payment{d.bf === 1 ? "" : "s"}) · keep <code>/{d.realSlug}</code></span>
              </li>
            ))}
          </ul>
          <form action={removeBackfillDuplicatesAction}>
            <button className="lq-btn lq-btn--danger">
              Remove {dupes.length} duplicate{dupes.length === 1 ? "" : "s"}
            </button>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={r.entry.name} className="lq-card lq-rise p-4" style={{ animationDelay: `${80 + i * 50}ms` }}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-sm font-bold text-ink">{r.entry.name}</div>
                <div className="text-[11px] text-charcoal-60">
                  {ils(r.entry.fee)}/cycle ·{" "}
                  {r.client ? (
                    <>matched <span className="text-charcoal-80">/{r.client.slug}</span></>
                  ) : (
                    <span className="text-amber-700">no portal yet — will be created</span>
                  )}
                  {r.existingCount > 0 ? ` · ${r.existingCount} stories payment(s) already on file` : ""}
                </div>
              </div>
              <div className="text-end">
                <div className="text-sm font-bold tabular-nums text-ink">{ils(r.newAmount)}</div>
                <div className="text-[11px] text-charcoal-40">{r.newCount} to add</div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {r.cycles.map((c) => (
                <span
                  key={c.date}
                  className={`lq-chip !text-[11px] ${c.dup ? "line-through !text-charcoal-40" : "lq-chip--green"}`}
                  title={c.dup ? "Already recorded — will be skipped" : "Will be created"}
                >
                  {monthLabel(c.date)}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="lq-card lq-rise p-5" style={{ animationDelay: "200ms" }}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="text-sm text-charcoal-80">
            Will create <b>{totalNewCount}</b> payment{totalNewCount === 1 ? "" : "s"} totalling{" "}
            <b className="tabular-nums">{ils(totalNew)}</b>
            {totalSkip > 0 ? <> · skipping <b>{totalSkip}</b> already recorded</> : ""}.
          </div>
          <form action={runStoriesBackfillAction}>
            <button disabled={totalNewCount === 0} className="lq-btn lq-btn--dark">
              {totalNewCount === 0 ? "Nothing to add" : `Apply backfill (${ils(totalNew)})`}
            </button>
          </form>
        </div>
        <p className="text-[11px] text-charcoal-40 mt-3">
          Re-running is safe — anything already on file (matched by client + month + amount) is skipped, never duplicated.
        </p>
      </div>
    </div>
  );
}
