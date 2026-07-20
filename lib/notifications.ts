// The notification feed — one aggregated, role-aware list of everything that
// deserves a ping. The "what needs doing" half (tasks due, invoice chasing,
// posts, approvals, shoots, check-ins, wrap-ups, onboardings, flagged notes)
// derives from lib/agenda — the single "what now" engine — so the bell, the
// agenda page, and the dashboard can never disagree, and snoozing an agenda
// item quiets its notification too. Inbox events (inquiries, applications,
// client task requests) are queried here; they're pings, not agenda work.
// Consumed by /api/notifications, polled by the bell in the admin header,
// which decides what's "new" (per-user seen-state lives client-side) and
// relays alerts to the browser / the desktop app's native notifications +
// Dock badge.
import { getSql, isDbEnabled } from "@/lib/db";
import { getClients, type Deliverable } from "@/lib/clients";
import { getStudioDeliverables } from "@/lib/studio";
import { getAgenda, type AgendaItem, type AgendaKind } from "@/lib/agenda";
import {
  isPartnerOnly,
  isPhotographerOnly,
  type SessionUser,
} from "@/lib/auth";

export type NoticeKind =
  | "inquiry"
  | "application"
  | "task-request"
  | "task-due"
  | "invoice-overdue"
  | "shoot"
  | "prep"
  | "post"
  | "approval"
  | "stories"
  | "checkin"
  | "wrap"
  | "onboard"
  | "note";

export type Notice = {
  id: string; // stable — the client dedupes on this
  kind: NoticeKind;
  title: string;
  body?: string;
  href: string;
  at: string; // ISO — for ordering/timeago only
};

const ICONS: Record<NoticeKind, string> = {
  inquiry: "✉️",
  application: "👋",
  "task-request": "🙋",
  "task-due": "⏰",
  "invoice-overdue": "💸",
  shoot: "📸",
  prep: "📝",
  post: "📣",
  approval: "🕒",
  stories: "✨",
  checkin: "💬",
  wrap: "🏁",
  onboard: "🆕",
  note: "📌",
};
export function noticeIcon(kind: NoticeKind): string {
  return ICONS[kind];
}

const AGENDA_KIND_TO_NOTICE: Record<AgendaKind, NoticeKind> = {
  task: "task-due",
  invoice: "invoice-overdue",
  shoot: "shoot",
  prep: "prep",
  post: "post",
  approval: "approval",
  stories: "stories",
  checkin: "checkin",
  wrap: "wrap",
  onboard: "onboard",
  note: "note",
};

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

// Which agenda items ping, and when. Overdue and due-today items always do;
// "soon" is only worth a heads-up for shoots (pack the gear the day before).
// A due-today item with a reminder time stays quiet until 30 minutes before.
function agendaNotice(it: AgendaItem, today: string, now: Date): Notice | null {
  if (it.urgency === "soon" && it.kind !== "shoot") return null;
  let at: string;
  if (it.date === today && it.time) {
    const fire = new Date(`${today}T${it.time}:00`);
    if (now.getTime() < fire.getTime() - 30 * 60 * 1000) return null;
    at = fire.toISOString();
  } else if (it.urgency === "overdue") {
    at = `${it.date}T09:00:00`;
  } else {
    at = `${it.date}T08:00:00`;
  }
  return {
    id: `ag-${it.id}`,
    kind: AGENDA_KIND_TO_NOTICE[it.kind],
    title: it.title,
    body: [it.clientName, it.sub].filter(Boolean).join(" · ") || undefined,
    href: it.href,
    at,
  };
}

/** The feed plus the Dock-badge number: how many agenda items need action
 *  (overdue + today, snoozes respected) — NOT unread count, so the badge is
 *  the same truth the agenda page shows. */
export async function getNotices(user: SessionUser): Promise<{ notices: Notice[]; badge: number }> {
  if (!isDbEnabled()) return { notices: [], badge: 0 };
  const sql = getSql();
  const notices: Notice[] = [];
  const now = new Date();

  // Partner-only accounts (Ramzi) are walled into their own area — no feed.
  if (isPartnerOnly(user)) return { notices: [], badge: 0 };

  // ---- The agenda's rituals, as pings (2-day horizon ≈ shoots in 48h) ----
  // One clients pull for the whole feed: this function runs on every
  // notification-bell poll, and it used to fetch every client's full data
  // blob twice (once here via the agenda engine, once below for task
  // requests) — the single biggest driver of database network transfer.
  const allClients = await safe(() => getClients(), []);
  const agenda = await safe(() => getAgenda(2, { clients: allClients }), null);
  let badge = 0;
  if (agenda) {
    // Photographer-only accounts (Ameer) get shoot reminders only.
    const items = isPhotographerOnly(user) ? agenda.all.filter((i) => i.kind === "shoot") : agenda.all;
    for (const it of items) {
      const n = agendaNotice(it, agenda.today, now);
      if (n) notices.push(n);
    }
    badge = isPhotographerOnly(user)
      ? items.filter((i) => i.urgency !== "soon").length
      : agenda.counts.overdue + agenda.counts.today;
  }
  if (isPhotographerOnly(user)) return { notices: sortNotices(notices), badge };

  // ---- Unread inquiries + applications ----
  const inquiries = await safe(
    async () =>
      (await sql`SELECT id, name, brand, service, created_at FROM inquiries WHERE read_at IS NULL ORDER BY created_at DESC LIMIT 20`) as unknown as {
        id: number; name: string; brand?: string; service?: string; created_at: string;
      }[],
    []
  );
  for (const q of inquiries) {
    notices.push({
      id: `inq-${q.id}`,
      kind: "inquiry",
      title: `New inquiry from ${q.name}`,
      body: [q.brand, q.service].filter(Boolean).join(" · ") || undefined,
      href: "/admin/inquiries",
      at: new Date(q.created_at).toISOString(),
    });
  }
  const apps = await safe(
    async () =>
      (await sql`SELECT id, first_name, last_name, talent, created_at FROM applications WHERE read_at IS NULL ORDER BY created_at DESC LIMIT 20`) as unknown as {
        id: number; first_name: string; last_name: string; talent?: string; created_at: string;
      }[],
    []
  );
  for (const a of apps) {
    notices.push({
      id: `app-${a.id}`,
      kind: "application",
      title: `Job application — ${[a.first_name, a.last_name].filter(Boolean).join(" ")}`,
      body: a.talent || undefined,
      href: "/admin/applications",
      at: new Date(a.created_at).toISOString(),
    });
  }

  // ---- Client task requests (pending approval — the agenda skips these on
  // purpose, so they're queried here as inbox events) ----
  const live = allClients.filter((c) => !c.data?.archived);
  const taskLists: { slug: string; name: string; items: Deliverable[] }[] = [];
  for (const c of live) {
    const items = c.data?.deliverables?.items;
    if (items?.length) taskLists.push({ slug: c.slug, name: c.name || c.slug, items });
  }
  const studioItems = await safe(() => getStudioDeliverables(), [] as Deliverable[]);
  if (studioItems.length) taskLists.push({ slug: "__studio__", name: "Studio", items: studioItems });
  for (const list of taskLists) {
    for (const t of list.items) {
      if (!t.requestedByClient || !t.pending) continue;
      notices.push({
        id: `req-${list.slug}-${t.id || t.title}`,
        kind: "task-request",
        title: `${list.name} requested a task`,
        body: t.title,
        href: "/admin/deliverables",
        at: t.createdAt || now.toISOString(),
      });
    }
  }

  return { notices: sortNotices(notices), badge };
}

function sortNotices(list: Notice[]): Notice[] {
  return list.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 60);
}
