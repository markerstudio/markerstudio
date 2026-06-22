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
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stories backfill — 2026</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            One-off import of Ramzi&apos;s received stories payments. Ramzi-only — never Marker income, never synced to Notion.
          </p>
        </div>
        <Link href="/admin/partner" className="text-sm font-medium text-neutral-500 hover:text-orange">← Ramzi</Link>
      </div>

      {done && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Done — created <b>{searchParams.created}</b> payment{searchParams.created === "1" ? "" : "s"}, skipped{" "}
          <b>{searchParams.skipped}</b> already-existing. The numbers below now reflect the new state.
        </div>
      )}

      {searchParams.removed != null && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Removed <b>{searchParams.removed}</b> duplicate client{searchParams.removed === "1" ? "" : "s"} and{" "}
          <b>{searchParams.removedRows}</b> backfilled payment{searchParams.removedRows === "1" ? "" : "s"}.
        </div>
      )}

      {dupes.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <h2 className="font-bold tracking-tight text-red-800">Duplicate clients to remove</h2>
          <p className="text-xs text-red-700/80 mt-1 mb-3">
            An earlier run created empty copies of these clients at the wrong slug. Removing them deletes the copy and its
            backfilled payments only — your real client (and any real data) is never touched.
          </p>
          <ul className="space-y-1.5 mb-4">
            {dupes.map((d) => (
              <li key={d.autoSlug} className="text-sm text-red-900 flex items-center gap-2 flex-wrap">
                <b>{d.name}</b>
                <span className="text-red-700/70">delete copy <code>/{d.autoSlug}</code> ({d.bf} payment{d.bf === 1 ? "" : "s"}) · keep <code>/{d.realSlug}</code></span>
              </li>
            ))}
          </ul>
          <form action={removeBackfillDuplicatesAction}>
            <button className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
              Remove {dupes.length} duplicate{dupes.length === 1 ? "" : "s"}
            </button>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.entry.name} className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-sm font-bold text-neutral-900">{r.entry.name}</div>
                <div className="text-[11px] text-neutral-500">
                  {ils(r.entry.fee)}/cycle ·{" "}
                  {r.client ? (
                    <>matched <span className="text-neutral-700">/{r.client.slug}</span></>
                  ) : (
                    <span className="text-amber-700">no portal yet — will be created</span>
                  )}
                  {r.existingCount > 0 ? ` · ${r.existingCount} stories payment(s) already on file` : ""}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold tabular-nums text-neutral-900">{ils(r.newAmount)}</div>
                <div className="text-[11px] text-neutral-400">{r.newCount} to add</div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {r.cycles.map((c) => (
                <span
                  key={c.date}
                  className={`text-[11px] font-semibold rounded-full border px-2.5 py-0.5 ${
                    c.dup ? "text-neutral-400 bg-neutral-50 border-neutral-200 line-through" : "text-emerald-700 bg-emerald-50 border-emerald-200"
                  }`}
                  title={c.dup ? "Already recorded — will be skipped" : "Will be created"}
                >
                  {monthLabel(c.date)}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="text-sm text-neutral-600">
            Will create <b>{totalNewCount}</b> payment{totalNewCount === 1 ? "" : "s"} totalling{" "}
            <b className="tabular-nums">{ils(totalNew)}</b>
            {totalSkip > 0 ? <> · skipping <b>{totalSkip}</b> already recorded</> : ""}.
          </div>
          <form action={runStoriesBackfillAction}>
            <button
              disabled={totalNewCount === 0}
              className="rounded-md bg-charcoal px-5 py-2.5 text-sm font-semibold text-white hover:bg-black transition-colors disabled:opacity-40"
            >
              {totalNewCount === 0 ? "Nothing to add" : `Apply backfill (${ils(totalNew)})`}
            </button>
          </form>
        </div>
        <p className="text-[11px] text-neutral-400 mt-3">
          Re-running is safe — anything already on file (matched by client + month + amount) is skipped, never duplicated.
        </p>
      </div>
    </div>
  );
}
