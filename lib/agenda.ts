// The agenda engine — "what do I owe every client, today and this week?"
// A read-only aggregator over data that already exists (clients JSONB,
// invoices table, studio to-dos). It derives the studio's daily rituals:
//
//   · tasks due / overdue (per-client deliverables + studio list)
//   · posts about to go live or still unscheduled, and client approvals
//     that have been sitting too long
//   · invoice chasing with a dunning ladder (due → +7d → +14d → +30d)
//   · shoots coming up
//   · check-in cadence — clients we haven't touched in a while
//   · cycle wrap-up — plans ending soon ("say we're done" prompts)
//   · new onboarding submissions awaiting review
//
// Nothing here writes anywhere. No schema changes.

import { getClients, type Client, type Deliverable } from "@/lib/clients";
import { getStudioDeliverables, getAgendaSnoozes } from "@/lib/studio";
import { listInvoices, invoiceRemaining, invoiceCurrency, type Invoice } from "@/lib/invoices";
import { listNotes, type Note } from "@/lib/notes";
import { isDbEnabled } from "@/lib/db";

export type AgendaKind =
  | "task"
  | "post"
  | "prep"
  | "approval"
  | "invoice"
  | "shoot"
  | "checkin"
  | "wrap"
  | "onboard"
  | "stories"
  | "note";

export type AgendaUrgency = "overdue" | "today" | "soon";

export type AgendaItem = {
  /** Stable identity for the underlying signal — what a snooze attaches to.
   *  Built from the source record (invoice id, post date+title, client slug…)
   *  so it survives re-derivation but changes when the signal itself does. */
  id: string;
  kind: AgendaKind;
  title: string;
  sub?: string;
  href: string;
  /** ISO yyyy-mm-dd the item belongs to (its due/occur date). */
  date: string;
  time?: string;
  urgency: AgendaUrgency;
  clientSlug?: string;
  clientName?: string;
};

export type ClientAgenda = {
  slug: string;
  name: string;
  color: string;
  logo: string;
  items: AgendaItem[];
  overdue: number;
  today: number;
};

export type Agenda = {
  clients: ClientAgenda[];
  studio: AgendaItem[];
  /** Every item, flat, ordered by (urgency, date, time). */
  all: AgendaItem[];
  counts: { overdue: number; today: number; soon: number };
  /** How many derived items are currently snoozed out of view. */
  snoozed: number;
  /** Studio-local yyyy-mm-dd the agenda was computed against — the views
   *  render against this instead of re-deriving "today" in the browser. */
  today: string;
};

const DAY = 24 * 3600 * 1000;

// "Today" means today in Beit Sahour, not wherever the server happens to run.
// Slicing toISOString() gave the UTC date, so every night between studio
// midnight and UTC midnight the agenda lagged a day behind — due items sat in
// "coming up" and yesterday's misses weren't overdue yet.
const STUDIO_TZ = "Asia/Hebron";

function iso(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: STUDIO_TZ }).format(d);
}
function addDays(base: string, n: number): string {
  return iso(new Date(new Date(`${base}T12:00:00Z`).getTime() + n * DAY));
}

/** Today in the studio's timezone — for callers (snooze action) that need to
 *  agree with the engine about what day it is. */
export function agendaToday(): string {
  return iso(new Date());
}
export function agendaAddDays(base: string, n: number): string {
  return addDays(base, n);
}
function fmtShort(dateIso: string, today: string): string {
  if (dateIso === today) return "today";
  if (dateIso === addDays(today, 1)) return "tomorrow";
  const d = new Date(`${dateIso}T12:00:00Z`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
function money(n: number, cur: "ILS" | "USD"): string {
  return `${cur === "USD" ? "$" : "₪"}${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function urgencyOf(date: string, today: string, horizon: string): AgendaUrgency | null {
  if (date < today) return "overdue";
  if (date === today) return "today";
  if (date <= horizon) return "soon";
  return null;
}

/* ---- per-signal derivations ------------------------------------------- */

function taskItems(list: Deliverable[], today: string, horizon: string, client?: Client): AgendaItem[] {
  const out: AgendaItem[] = [];
  for (const t of list) {
    if (t.status === "done" || t.pending) continue;
    if (!t.due) continue;
    const u = urgencyOf(t.due, today, horizon);
    if (!u) continue;
    out.push({
      id: `task:${client?.slug ?? "studio"}:${t.id ?? `${t.title}@${t.due}`}`,
      kind: "task",
      title: t.title,
      sub: t.priority === "urgent" || t.priority === "high" ? t.priority : undefined,
      href: "/admin/deliverables",
      date: t.due,
      time: t.time,
      urgency: u,
      clientSlug: client?.slug,
      clientName: client ? client.name || client.slug : undefined,
    });
  }
  return out;
}

function postItems(c: Client, today: string, horizon: string): AgendaItem[] {
  const out: AgendaItem[] = [];
  const posts = c.data?.social?.posts ?? [];
  for (const p of posts) {
    if (!p.date || p.status === "posted") continue;
    const u = urgencyOf(p.date, today, horizon);
    if (!u) continue;
    const base = {
      href: `/admin/clients/${c.slug}/edit?tab=content`,
      date: p.date,
      urgency: u,
      clientSlug: c.slug,
      clientName: c.name || c.slug,
    };
    // A pending approval blocks the post — that's the one line to show, not a
    // "goes live" promise (it won't) plus a separate nudge. It stays on the
    // post's date so a blown date reads as overdue instead of disappearing.
    if (p.approval === "pending") {
      out.push({
        id: `approval:${c.slug}:${p.date}:${p.title || p.type || "post"}`,
        kind: "approval",
        title: `Awaiting approval — ${p.title || p.type || "post"}`,
        sub: u === "overdue" ? "post date passed — chase the client" : "nudge the client",
        ...base,
      });
      continue;
    }
    // Posts still in production (idea / to-shoot / editing) surface as a
    // "Prepare" reminder INSTEAD of a vague "not scheduled" line — planning a
    // month (or laying one out with the scaffold) feeds the agenda by itself,
    // with no duplicate task rows to maintain.
    const stage = p.stage ?? (p.status === "scheduled" ? "scheduled" : "idea");
    const inProduction = stage === "idea" || stage === "shoot" || stage === "edit";
    out.push({
      id: `${inProduction ? "prep" : "post"}:${c.slug}:${p.date}:${p.title || p.type || "post"}`,
      kind: inProduction ? "prep" : "post",
      title: inProduction
        ? `Prepare — ${p.title || `${p.type || "post"}`}${stage === "shoot" ? " (needs shoot)" : stage === "edit" ? " (in edit)" : ""}`
        : `Goes live — ${p.title}`,
      sub: [p.platform, p.type].filter(Boolean).join(" · ") || undefined,
      ...base,
    });
  }
  return out;
}

/** The dunning ladder: due date → +7d → +14d → +30d, one touch per stage. */
function invoiceItems(invoices: Invoice[], clientsBySlug: Map<string, Client>, today: string): AgendaItem[] {
  const out: AgendaItem[] = [];
  for (const inv of invoices) {
    if (inv.archived_at || !inv.due_date) continue;
    if (inv.status !== "due" && inv.status !== "partial") continue;
    const remaining = invoiceRemaining(inv.items, Number(inv.vat_rate) || 0, Number(inv.paid_amount) || 0);
    if (remaining <= 0) continue;
    const due = String(inv.due_date).slice(0, 10);
    const c = clientsBySlug.get(inv.client_slug);
    const name = c?.name || inv.client_slug;
    const cur = invoiceCurrency(inv.items);
    const daysLate = Math.floor((new Date(`${today}T12:00:00Z`).getTime() - new Date(`${due}T12:00:00Z`).getTime()) / DAY);
    let title: string;
    let urgency: AgendaUrgency;
    let stage: string; // dunning rung — part of the id so an escalation resurfaces through a snooze
    let date = due;
    if (daysLate < 0) {
      if (daysLate < -3) continue; // not agenda-worthy yet
      title = `${inv.number} due ${fmtShort(due, today)} — ${money(remaining, cur)}`;
      urgency = daysLate === 0 ? "today" : "soon";
      stage = "upcoming";
    } else if (daysLate === 0) {
      title = `${inv.number} due today — send a friendly reminder`;
      urgency = "today";
      stage = "due";
    } else if (daysLate < 7) {
      title = `${inv.number} is ${daysLate}d late — ${money(remaining, cur)}`;
      urgency = "overdue";
      stage = "late";
    } else if (daysLate < 14) {
      title = `${inv.number} — 2nd follow-up (${daysLate}d late)`;
      urgency = "overdue";
      stage = "second";
    } else if (daysLate < 30) {
      title = `${inv.number} — escalate (${daysLate}d late)`;
      urgency = "overdue";
      stage = "escalate";
    } else {
      title = `${inv.number} — final notice / pause work (${daysLate}d late)`;
      urgency = "overdue";
      stage = "final";
    }
    out.push({
      id: `invoice:${inv.id}:${stage}`,
      kind: "invoice",
      title,
      sub: money(remaining, cur) + " outstanding",
      href: `/admin/invoices/${inv.id}/edit`,
      date,
      urgency,
      clientSlug: inv.client_slug,
      clientName: name,
    });
  }
  return out;
}

function shootItems(c: Client, today: string, horizon: string): AgendaItem[] {
  const out: AgendaItem[] = [];
  if (!c.data?.photo?.active) return out;
  for (const s of c.data.photo.sessions ?? []) {
    if (!s.date || s.status === "delivered") continue;
    const u = urgencyOf(s.date, today, horizon);
    if (!u || u === "overdue") continue; // past shoots are the photographer's ledger, not agenda noise
    out.push({
      id: `shoot:${c.slug}:${s.date}:${s.title}`,
      kind: "shoot",
      title: `Shoot — ${s.title}`,
      sub: [s.time, s.location].filter(Boolean).join(" · ") || undefined,
      href: "/admin/photographer",
      date: s.date,
      time: /^\d{2}:\d{2}/.test(s.time || "") ? s.time : undefined,
      urgency: u,
      clientSlug: c.slug,
      clientName: c.name || c.slug,
    });
  }
  return out;
}

/** Quiet clients — no activity, no posts, nothing due in CHECKIN_DAYS. */
const CHECKIN_DAYS = 14;
function checkinItem(c: Client, today: string): AgendaItem | null {
  if (!c.data?.plan?.active) return null;
  const stamps: number[] = [];
  for (const u of c.data.updates ?? []) if (u.at) stamps.push(new Date(u.at).getTime());
  for (const p of c.data.social?.posts ?? []) if (p.date) stamps.push(new Date(`${p.date}T12:00:00`).getTime());
  for (const t of c.data.deliverables?.items ?? []) {
    if (t.completedAt) stamps.push(new Date(t.completedAt).getTime());
    if (t.createdAt) stamps.push(new Date(t.createdAt).getTime());
  }
  const last = stamps.length ? Math.max(...stamps) : 0;
  const daysQuiet = last ? Math.floor((Date.now() - last) / DAY) : CHECKIN_DAYS + 1;
  if (daysQuiet <= CHECKIN_DAYS) return null;
  return {
    id: `checkin:${c.slug}`,
    kind: "checkin",
    title: last ? `Quiet for ${daysQuiet} days — check in` : "No recent activity — check in",
    sub: "a message goes a long way",
    href: `/admin/clients/${c.slug}/edit`,
    date: today,
    urgency: "today",
    clientSlug: c.slug,
    clientName: c.name || c.slug,
  };
}

/** Plans ending inside a week — prep the report / renewal / "we're done". */
function wrapItem(c: Client, today: string): AgendaItem | null {
  const plan = c.data?.plan;
  if (!plan?.active || !plan.end) return null;
  const end = /^\d{4}-\d{2}-\d{2}/.test(plan.end) ? plan.end.slice(0, 10) : null;
  if (!end) return null;
  const daysLeft = Math.floor((new Date(`${end}T12:00:00Z`).getTime() - new Date(`${today}T12:00:00Z`).getTime()) / DAY);
  if (daysLeft > 7) return null;
  return {
    id: `wrap:${c.slug}:${end}`,
    kind: "wrap",
    title:
      daysLeft < 0
        ? `Cycle ended ${-daysLeft}d ago — close it out or renew`
        : daysLeft === 0
        ? "Cycle ends today — send the wrap-up"
        : `Cycle ends in ${daysLeft}d — prep the report`,
    sub: plan.name || undefined,
    href: `/admin/clients/${c.slug}/edit`,
    date: daysLeft < 0 ? end : today,
    urgency: daysLeft < 0 ? "overdue" : "today",
    clientSlug: c.slug,
    clientName: c.name || c.slug,
  };
}

function onboardItem(c: Client, today: string): AgendaItem | null {
  if (c.data?.status !== "pending") return null;
  return {
    id: `onboard:${c.slug}`,
    kind: "onboard",
    title: "New onboarding — review & activate",
    sub: c.data.onboarding?.brandName || undefined,
    href: `/admin/clients/${c.slug}/edit`,
    date: today,
    urgency: "today",
    clientSlug: c.slug,
    clientName: c.name || c.slug,
  };
}

function storiesItems(c: Client, today: string, horizon: string): AgendaItem[] {
  const out: AgendaItem[] = [];
  for (const t of c.data?.storiesTasks ?? []) {
    if (t.status === "done" || !t.due) continue;
    const u = urgencyOf(t.due, today, horizon);
    if (!u) continue;
    out.push({
      id: `stories:${c.slug}:${t.due}:${t.title}`,
      kind: "stories",
      title: `Stories — ${t.title}`,
      href: "/admin/partner",
      date: t.due,
      urgency: u,
      clientSlug: c.slug,
      clientName: c.name || c.slug,
    });
  }
  return out;
}

/** Flagged (pinned) notes ride on today until unpinned — a standing reminder. */
function noteItems(notes: Note[], bySlug: Map<string, Client>, today: string): AgendaItem[] {
  const out: AgendaItem[] = [];
  for (const n of notes) {
    if (!n.pinned) continue;
    const c = n.client_slug ? bySlug.get(n.client_slug) : undefined;
    const snippet = (n.title || n.body.split("\n")[0] || "Untitled note").slice(0, 80);
    out.push({
      id: `note:${n.id}`,
      kind: "note",
      title: `Flagged — ${snippet}`,
      sub: n.context_label || "unpin it when it's handled",
      href: c ? `/admin/notes?client=${c.slug}` : "/admin/notes",
      date: today,
      urgency: "today",
      clientSlug: c?.slug,
      clientName: c ? c.name || c.slug : undefined,
    });
  }
  return out;
}

/* ---- the aggregate ------------------------------------------------------ */

const URGENCY_ORDER: Record<AgendaUrgency, number> = { overdue: 0, today: 1, soon: 2 };

// `preloaded.clients` lets callers that already hold the client rows (the
// notifications feed, the pet route) share them instead of pulling every
// client's full data blob from the database a second time in the same
// request — the clients table is by far the heaviest read in the app, and
// double-pulling it on every notification poll is what burned through the
// database's monthly network-transfer allowance.
export async function getAgenda(daysAhead = 7, preloaded?: { clients?: Client[] }): Promise<Agenda> {
  const today = iso(new Date());
  const empty: Agenda = { clients: [], studio: [], all: [], counts: { overdue: 0, today: 0, soon: 0 }, snoozed: 0, today };
  if (!isDbEnabled()) return empty;

  const horizon = addDays(today, daysAhead);

  const [clients, invoices, studioTasks, notes, snoozes] = await Promise.all([
    preloaded?.clients ? Promise.resolve(preloaded.clients) : getClients().catch(() => [] as Client[]),
    listInvoices().catch(() => [] as Invoice[]),
    getStudioDeliverables().catch(() => [] as Deliverable[]),
    listNotes().catch(() => [] as Note[]),
    getAgendaSnoozes().catch(() => ({} as Record<string, string>)),
  ]);
  const live = clients.filter((c) => !c.data?.archived);
  const bySlug = new Map(live.map((c) => [c.slug, c]));

  // A snoozed signal is quiet until its wake date, then derives as normal.
  let snoozed = 0;
  const perClient = new Map<string, AgendaItem[]>();
  const push = (items: AgendaItem[]) => {
    for (const it of items) {
      if ((snoozes[it.id] ?? "") > today) {
        snoozed++;
        continue;
      }
      const key = it.clientSlug || "__studio__";
      if (!perClient.has(key)) perClient.set(key, []);
      perClient.get(key)!.push(it);
    }
  };

  for (const c of live) {
    push(taskItems(c.data?.deliverables?.items ?? [], today, horizon, c));
    push(postItems(c, today, horizon));
    push(shootItems(c, today, horizon));
    push(storiesItems(c, today, horizon));
    const ci = checkinItem(c, today);
    if (ci) push([ci]);
    const w = wrapItem(c, today);
    if (w) push([w]);
    const ob = onboardItem(c, today);
    if (ob) push([ob]);
  }
  push(invoiceItems(invoices, bySlug, today));
  push(taskItems(studioTasks, today, horizon));
  push(noteItems(notes, bySlug, today));

  const sortItems = (xs: AgendaItem[]) =>
    xs.sort(
      (a, b) =>
        URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency] ||
        (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) ||
        (a.time || "99").localeCompare(b.time || "99")
    );

  const clientAgendas: ClientAgenda[] = [];
  for (const [slug, items] of Array.from(perClient.entries())) {
    if (slug === "__studio__") continue;
    const c = bySlug.get(slug);
    if (!c) continue;
    sortItems(items);
    clientAgendas.push({
      slug,
      name: c.name || slug,
      color: c.color || "#FF9100",
      logo: c.logo || "",
      items,
      overdue: items.filter((i: AgendaItem) => i.urgency === "overdue").length,
      today: items.filter((i: AgendaItem) => i.urgency === "today").length,
    });
  }
  clientAgendas.sort((a, b) => b.overdue - a.overdue || b.today - a.today || a.name.localeCompare(b.name));

  const studio = sortItems(perClient.get("__studio__") ?? []);
  const all = sortItems([...clientAgendas.flatMap((c) => c.items), ...studio]);

  return {
    clients: clientAgendas,
    studio,
    all,
    counts: {
      overdue: all.filter((i) => i.urgency === "overdue").length,
      today: all.filter((i) => i.urgency === "today").length,
      soon: all.filter((i) => i.urgency === "soon").length,
    },
    snoozed,
    today,
  };
}
