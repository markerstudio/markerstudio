import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, canSeeDeliverables } from "@/lib/auth";
import { isDbEnabled } from "@/lib/db";
import { getClients, type Client, type Deliverable } from "@/lib/clients";
import { ensureDeliverableIds, ORDER, LABELS, BADGES, progress } from "@/lib/deliverables";
import PhotographerStatusButton from "@/components/admin/PhotographerStatusButton";
import { setDeliverableStatusById } from "./actions";

export const dynamic = "force-dynamic";

function fmtDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });
}

type Flat = { client: Client; item: Deliverable; idx: number };

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
    (block.items ?? []).forEach((item, idx) => all.push({ client, item, idx }));
  }

  const byDue = (a: Flat, b: Flat) => ((a.item.due || "9999") < (b.item.due || "9999") ? -1 : 1);
  const open = all.filter((f) => f.item.status !== "done");
  const overdue = open.filter((f) => f.item.due && f.item.due < today).sort(byDue);
  const thisWeek = open.filter((f) => f.item.due && f.item.due >= today && f.item.due <= weekEnd).sort(byDue);
  const upcoming = open.filter((f) => f.item.due && f.item.due > weekEnd).sort(byDue);
  const noDate = open.filter((f) => !f.item.due);
  const done = all.filter((f) => f.item.status === "done").sort((a, b) => ((a.item.due || "") > (b.item.due || "") ? -1 : 1));

  const stat = (label: string, value: string | number, sub?: string, dark = false) => (
    <div className={`${dark ? "bg-charcoal text-white" : "bg-white border border-neutral-200"} rounded-xl px-5 py-4`}>
      <div className={`text-[11px] font-semibold uppercase tracking-wider ${dark ? "text-white/60" : "text-neutral-500"}`}>{label}</div>
      <div className={`mt-2 text-3xl font-extrabold tracking-tight tabular-nums ${dark ? "text-orange" : "text-neutral-900"}`}>{value}</div>
      {sub && <div className={`text-[11px] mt-1 ${dark ? "text-white/50" : "text-neutral-400"}`}>{sub}</div>}
    </div>
  );

  const row = ({ client, item, idx }: Flat) => (
    <li key={`${client.slug}-${item.id ?? idx}`} className="py-3 flex items-center gap-3 flex-wrap">
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
          <Link href={`/admin/clients/${client.slug}/edit?tab=deliverables`} className="hover:text-orange font-medium">{client.name || client.slug}</Link>
          {item.detail ? ` · ${item.detail}` : ""}
        </div>
      </div>
      <PhotographerStatusButton
        slug={client.slug}
        id={item.id}
        idx={idx}
        status={item.status}
        order={ORDER}
        labels={LABELS}
        badges={BADGES}
        action={setDeliverableStatusById}
      />
    </li>
  );

  const section = (title: string, items: Flat[], tone = "") =>
    items.length === 0 ? null : (
      <div className="bg-white border border-neutral-200 rounded-xl p-5">
        <h2 className={`font-bold tracking-tight mb-1 ${tone}`}>{title} <span className="text-neutral-400 font-medium">· {items.length}</span></h2>
        <ul className="divide-y divide-neutral-100">{items.map(row)}</ul>
      </div>
    );

  const totalProg = progress(all.map((f) => f.item));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Deliverables</h1>
        <p className="text-sm text-neutral-500 mt-0.5">What you owe across every client, by due date. Tap a status to move it along. Generate items per client under <b>Clients → Deliverables</b>.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stat("Overdue", overdue.length, "past due, not delivered", true)}
        {stat("Due this week", thisWeek.length, "next 7 days")}
        {stat("Open", open.length, "not yet delivered")}
        {stat("Delivered", `${totalProg.pct}%`, `${totalProg.done}/${totalProg.total} all-time`)}
      </div>

      {all.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <p className="text-sm text-neutral-400 py-6 text-center">
            No deliverables tracked yet. Open a client&apos;s <b>Deliverables</b> tab, turn on tracking, and generate them from the plan &amp; timeline.
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
