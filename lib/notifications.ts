// The notification feed — one aggregated, role-aware list of everything that
// deserves a ping: new inquiries and job applications, client task requests,
// tasks due (with their reminder time), overdue invoices, and upcoming shoots.
// Consumed by /api/notifications, polled by the bell in the admin header,
// which decides what's "new" (per-user seen-state lives client-side) and
// relays alerts to the browser / the desktop app's native notifications.
import { getSql, isDbEnabled } from "@/lib/db";
import { getClients, type Deliverable } from "@/lib/clients";
import { getStudioDeliverables } from "@/lib/studio";
import { invoiceRemaining, type Invoice } from "@/lib/invoices";
import {
  isPartnerOnly,
  isPhotographerOnly,
  type SessionUser,
} from "@/lib/auth";

export type NoticeKind = "inquiry" | "application" | "task-request" | "task-due" | "invoice-overdue" | "shoot";

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
};
export function noticeIcon(kind: NoticeKind): string {
  return ICONS[kind];
}

// Deep-link a notice to the exact task on the board (which scrolls to it and
// highlights it), instead of dropping onto the generic Tasks page. The board
// keys every row as `${slug}:${id}` — mirror that here so the two line up. When
// a legacy row still lacks an id we fall back to the plain page.
function taskHref(slug: string, id?: string | null): string {
  return id ? `/admin/deliverables?task=${encodeURIComponent(`${slug}:${id}`)}` : "/admin/deliverables";
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export async function getNotices(user: SessionUser): Promise<Notice[]> {
  if (!isDbEnabled()) return [];
  const sql = getSql();
  const notices: Notice[] = [];
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const clients = await safe(() => getClients(), []);
  const live = clients.filter((c) => !c.data?.archived);

  // Photographer-only accounts (Ameer) get shoot reminders only.
  const photographerOnly = isPhotographerOnly(user);
  // Partner-only accounts (Ramzi) are walled into their own area — no feed.
  if (isPartnerOnly(user)) return [];

  // ---- Upcoming shoots (next 48h) ----
  const in48h = new Date(now.getTime() + 48 * 3600 * 1000).toISOString().slice(0, 10);
  for (const c of live) {
    if (!c.data?.photo?.active) continue;
    for (const s of c.data.photo.sessions ?? []) {
      if (s.status === "delivered" || !s.date) continue;
      if (s.date >= today && s.date <= in48h) {
        notices.push({
          id: `shoot-${c.slug}-${s.id || s.date}-${s.date}`,
          kind: "shoot",
          title: s.date === today ? `Shoot today — ${s.title}` : `Shoot coming up — ${s.title}`,
          body: [c.name || c.slug, s.time, s.location].filter(Boolean).join(" · "),
          href: "/admin/photographer",
          at: `${s.date}T${/^\d{2}:\d{2}/.test(s.time || "") ? s.time : "09:00"}:00`,
        });
      }
    }
  }
  if (photographerOnly) return sortNotices(notices);

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

  // ---- Client task requests + tasks due today / with a reminder time ----
  const taskLists: { slug: string; name: string; items: Deliverable[] }[] = [];
  for (const c of live) {
    const items = c.data?.deliverables?.items;
    if (items?.length) taskLists.push({ slug: c.slug, name: c.name || c.slug, items });
  }
  const studioItems = await safe(() => getStudioDeliverables(), [] as Deliverable[]);
  if (studioItems.length) taskLists.push({ slug: "__studio__", name: "Studio", items: studioItems });

  for (const list of taskLists) {
    for (const t of list.items) {
      if (t.requestedByClient && t.pending) {
        notices.push({
          id: `req-${list.slug}-${t.id || t.title}`,
          kind: "task-request",
          title: `${list.name} requested a task`,
          body: t.title,
          href: taskHref(list.slug, t.id),
          at: now.toISOString(),
        });
        continue;
      }
      if (t.status === "done" || t.pending) continue;
      if (t.due && t.due < today) {
        notices.push({
          id: `due-${list.slug}-${t.id || t.title}-${t.due}`,
          kind: "task-due",
          title: `Overdue: ${t.title}`,
          body: list.name,
          href: taskHref(list.slug, t.id),
          at: `${t.due}T09:00:00`,
        });
      } else if (t.due === today) {
        // With a reminder time, surface it only once the reminder window opens
        // (30 min before). Without one, it shows all day.
        if (t.time) {
          const fire = new Date(`${today}T${t.time}:00`);
          if (now.getTime() < fire.getTime() - 30 * 60 * 1000) continue;
          notices.push({
            id: `due-${list.slug}-${t.id || t.title}-${t.due}-${t.time}`,
            kind: "task-due",
            title: `${t.title} — at ${t.time}`,
            body: list.name,
            href: taskHref(list.slug, t.id),
            at: fire.toISOString(),
          });
        } else {
          notices.push({
            id: `due-${list.slug}-${t.id || t.title}-${t.due}`,
            kind: "task-due",
            title: `Due today: ${t.title}`,
            body: list.name,
            href: taskHref(list.slug, t.id),
            at: `${today}T08:00:00`,
          });
        }
      }
    }
  }

  // ---- Overdue invoices ----
  const invoices = await safe(
    async () =>
      (await sql`
        SELECT id, number, client_slug, due_date, items, vat_rate, paid_amount, status, archived_at
        FROM invoices WHERE status IN ('due','partial') ORDER BY due_date ASC NULLS LAST LIMIT 100
      `) as unknown as Invoice[],
    []
  );
  for (const inv of invoices) {
    if (inv.archived_at || !inv.due_date) continue;
    const due = new Date(inv.due_date);
    if (due >= now) continue;
    const remaining = invoiceRemaining(inv.items, Number(inv.vat_rate) || 0, Number(inv.paid_amount) || 0);
    if (remaining <= 0) continue;
    notices.push({
      id: `inv-${inv.id}`,
      kind: "invoice-overdue",
      title: `${inv.number} is past due`,
      body: `/${inv.client_slug} — ${remaining.toLocaleString("en-US", { maximumFractionDigits: 0 })} outstanding`,
      href: "/admin/invoices?f=overdue",
      at: due.toISOString(),
    });
  }

  return sortNotices(notices);
}

function sortNotices(list: Notice[]): Notice[] {
  return list.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 60);
}
