import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, canSeeDeliverables } from "@/lib/auth";
import { isDbEnabled } from "@/lib/db";
import { getClients, type Deliverable } from "@/lib/clients";
import { ensureDeliverableIds, ORDER, LABELS, BADGES, progress } from "@/lib/deliverables";
import { getStudioDeliverables, STUDIO_SLUG } from "@/lib/studio";
import PhotographerStatusButton from "@/components/admin/PhotographerStatusButton";
import { setDeliverableStatusById, addDeliverableAction, removeDeliverableAction, approveRequestAction, rejectRequestAction } from "./actions";

export const dynamic = "force-dynamic";

const inputCls = "w-full border border-neutral-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange/40 focus:border-orange";

function fmtDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });
}

type Flat = { slug: string; clientName: string; isClient: boolean; item: Deliverable; idx: number };

export default async function DeliverablesPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (!canSeeDeliverables(user)) redirect("/admin");

  if (!isDbEnabled()) {
    return (
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Deliverables</h1>
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-4 py-3 mt-4">No database configured.</p>
      </div>
    );
  }

  const clients = await getClients();
  const tracked = clients
    .filter((c) => c.data.deliverables?.active)
    .map((c) => ({ client: c, block: ensureDeliverableIds(c.data.deliverables) }));

  const today = new Date().toISOString().slice(0, 10);
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const all: Flat[] = [];
  for (const { client, block } of tracked) {
    (block.items ?? []).forEach((item, idx) => all.push({ slug: client.slug, clientName: client.name || client.slug, isClient: true, item, idx }));
  }
  const studioItems = ensureDeliverableIds({ items: await getStudioDeliverables() }).items ?? [];
  studioItems.forEach((item, idx) => all.push({ slug: STUDIO_SLUG, clientName: "Studio · internal", isClient: false, item, idx }));

  const byDue = (a: Flat, b: Flat) => ((a.item.due || "9999") < (b.item.due || "9999") ? -1 : 1);
  const isPending = (f: Flat) => !!(f.item.requestedByClient && f.item.pending);
  const pending = all.filter(isPending).sort(byDue);
  const open = all.filter((f) => f.item.status !== "done" && !isPending(f));
  const overdue = open.filter((f) => f.item.due && f.item.due < today).sort(byDue);
  const thisWeek = open.filter((f) => f.item.due && f.item.due >= today && f.item.due <= weekEnd).sort(byDue);
  const upcoming = open.filter((f) => f.item.due && f.item.due > weekEnd).sort(byDue);
  const noDate = open.filter((f) => !f.item.due);
  const done = all.filter((f) => f.item.status === "done").sort((a, b) => ((a.item.due || "") > (b.item.due || "") ? -1 : 1));
  const totalProg = progress(all.filter((f) => !isPending(f)).map((f) => f.item));

  const stat = (label: string, value: string | number, sub?: string, dark = false) => (
    <div className={`${dark ? "bg-charcoal text-white" : "bg-white border border-neutral-200"} rounded-xl px-5 py-4`}>
      <div className={`text-[11px] font-semibold uppercase tracking-wider ${dark ? "text-white/60" : "text-neutral-500"}`}>{label}</div>
      <div className={`mt-2 text-3xl font-extrabold tracking-tight tabular-nums ${dark ? "text-orange" : "text-neutral-900"}`}>{value}</div>
      {sub && <div className={`text-[11px] mt-1 ${dark ? "text-white/50" : "text-neutral-400"}`}>{sub}</div>}
    </div>
  );

  const row = ({ slug, clientName, isClient, item, idx }: Flat) => (
    <li key={`${slug}-${item.id ?? idx}`} className="py-3 flex items-center gap-3 flex-wrap">
      <div className="w-20 shrink-0 text-center rounded-lg bg-neutral-50 border border-neutral-100 py-1.5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-orange-deep">{fmtDate(item.due).split(" ")[0]}</div>
        <div className="text-sm font-bold tabular-nums text-neutral-900">{item.due ? fmtDate(item.due).replace(/^\S+\s/, "") : "—"}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-neutral-900 truncate">
          {item.title || "Deliverable"}
          {item.kind === "recurring" && <span className="ml-2 text-[10px] font-semibold rounded-full px-1.5 py-0.5 bg-neutral-100 text-neutral-500 align-middle">recurring</span>}
        </div>
        <div className="text-[11px] text-neutral-500 truncate">
          {isClient ? (
            <Link href={`/admin/clients/${slug}/edit?tab=deliverables`} className="hover:text-orange font-medium">{clientName}</Link>
          ) : (
            <span className="font-medium text-neutral-400">{clientName}</span>
          )}
          {item.detail ? ` · ${item.detail}` : ""}
        </div>
      </div>
      <PhotographerStatusButton slug={slug} id={item.id} idx={idx} status={item.status} order={ORDER} labels={LABELS} badges={BADGES} action={setDeliverableStatusById} />
      <form action={removeDeliverableAction}>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="id" value={item.id || ""} />
        <button className="text-xs font-medium text-neutral-300 hover:text-red-600" title="Remove">✕</button>
      </form>
    </li>
  );

  const section = (title: string, items: Flat[], tone = "") =>
    items.length === 0 ? null : (
      <div className="bg-white border border-neutral-200 rounded-xl p-5">
        <h2 className={`font-bold tracking-tight mb-1 ${tone}`}>{title} <span className="text-neutral-400 font-medium">· {items.length}</span></h2>
        <ul className="divide-y divide-neutral-100">{items.map(row)}</ul>
      </div>
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Deliverables</h1>
        <p className="text-sm text-neutral-500 mt-0.5">What you owe across every client, by due date. Tap a status to move it along. Per-client items generate under <b>Clients → Deliverables</b>.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stat("Overdue", overdue.length, "past due, not delivered", true)}
        {stat("Due this week", thisWeek.length, "next 7 days")}
        {stat("Open", open.length, "not yet delivered")}
        {stat("Delivered", `${totalProg.pct}%`, `${totalProg.done}/${totalProg.total} all-time`)}
      </div>

      {/* Quick-add a task to any client, or to the studio (no client). */}
      <details className="bg-white border border-neutral-200 rounded-xl p-5">
        <summary className="font-bold tracking-tight cursor-pointer select-none">+ Add a task</summary>
        <form action={addDeliverableAction} className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_150px_140px_150px_auto] gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Task</label>
            <input name="title" required className={inputCls} placeholder="Send Q2 brand guidelines" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Due</label>
            <input type="date" name="due" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Type</label>
            <select name="kind" className={inputCls}><option value="milestone">Milestone</option><option value="recurring">Recurring</option></select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">For</label>
            <select name="slug" className={inputCls} defaultValue="">
              <option value="">No client · studio</option>
              {clients.map((c) => <option key={c.slug} value={c.slug}>{c.name || c.slug}</option>)}
            </select>
          </div>
          <button className="bg-orange text-white font-semibold rounded-md px-5 py-2 text-sm hover:bg-orange-deep transition-colors h-[38px]">Add</button>
        </form>
        <p className="text-[11px] text-neutral-400 mt-2">Adding to a client turns on deliverables tracking for them. Studio tasks are internal — never shown to any client.</p>
      </details>

      {/* Client requests awaiting approval. */}
      {pending.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <h2 className="font-bold tracking-tight text-amber-800 mb-1">Client requests <span className="text-amber-600 font-medium">· {pending.length} pending</span></h2>
          <p className="text-xs text-amber-700/80 mb-3">Tasks your clients asked for. Approve to add them to the client&apos;s deliverables, or reject to remove.</p>
          <ul className="divide-y divide-amber-200/60">
            {pending.map(({ slug, clientName, item, idx }) => (
              <li key={`${slug}-${item.id ?? idx}`} className="py-3 flex items-center gap-3 flex-wrap">
                <div className="w-20 shrink-0 text-center rounded-lg bg-white/70 border border-amber-200 py-1.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">{fmtDate(item.due).split(" ")[0]}</div>
                  <div className="text-sm font-bold tabular-nums text-neutral-900">{item.due ? fmtDate(item.due).replace(/^\S+\s/, "") : "—"}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-neutral-900 truncate">{item.title}</div>
                  <div className="text-[11px] text-neutral-500 truncate">
                    <Link href={`/admin/clients/${slug}/edit?tab=deliverables`} className="hover:text-orange font-medium">{clientName}</Link>
                    {item.detail ? ` · ${item.detail}` : ""}
                  </div>
                </div>
                <form action={approveRequestAction}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="id" value={item.id || ""} />
                  <button className="text-xs font-semibold rounded-full border border-emerald-300 text-emerald-700 bg-emerald-50 px-3 py-1 hover:bg-emerald-100">Approve</button>
                </form>
                <form action={rejectRequestAction}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="id" value={item.id || ""} />
                  <button className="text-xs font-semibold rounded-full border border-neutral-300 text-neutral-500 px-3 py-1 hover:border-red-300 hover:text-red-600">Reject</button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}

      {all.filter((f) => !isPending(f)).length === 0 && pending.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <p className="text-sm text-neutral-400 py-6 text-center">
            No deliverables yet. Add one above, or open a client&apos;s <b>Deliverables</b> tab and generate them from the plan &amp; timeline.
          </p>
        </div>
      ) : (
        <>
          {section("Overdue", overdue, "text-red-700")}
          {section("Due this week", thisWeek, "text-amber-700")}
          {section("Upcoming", upcoming)}
          {section("No date", noDate)}
          {section("Delivered", done, "text-emerald-700")}
        </>
      )}
    </div>
  );
}
