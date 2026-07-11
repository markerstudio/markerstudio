// Proactive reminders — the piece that makes the app actually *reach* you when
// something's due, even with the site closed. A scheduled job (Vercel Cron →
// /api/cron/reminders) rebuilds the studio feed and pushes anything we haven't
// pushed before as a real Web Push to every admin device. Each notice id is
// remembered so a task pings once, not on every cron tick.
import { getSql, isDbEnabled } from "@/lib/db";
import { getNotices, noticeIcon } from "@/lib/notifications";
import { sendPushTo } from "@/lib/push";
import { SUPERADMIN_EMAIL, type SessionUser } from "@/lib/auth";

// The feed is role-aware and keyed off a signed-in user; a cron has none, so we
// synthesise the studio owner — the account that sees the whole studio feed.
function studioUser(): SessionUser {
  return { id: 0, email: SUPERADMIN_EMAIL, name: "Studio", role: "admin", clientId: null };
}

async function ensureSentTable(): Promise<void> {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS reminder_sends (
      notice_id TEXT PRIMARY KEY,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

async function markSent(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const sql = getSql();
  for (const id of ids) {
    await sql`INSERT INTO reminder_sends (notice_id) VALUES (${id}) ON CONFLICT (notice_id) DO NOTHING`;
  }
}

export type ReminderRun = { pushed: number; skipped: number; devices: number; seeded?: boolean };

export async function runReminders(): Promise<ReminderRun> {
  if (!isDbEnabled()) return { pushed: 0, skipped: 0, devices: 0 };
  await ensureSentTable();
  const sql = getSql();

  const notices = await getNotices(studioUser());
  if (!notices.length) return { pushed: 0, skipped: 0, devices: 0 };

  // Which of these have we already pinged? Dedupe so each notice fires once.
  const ids = notices.map((n) => n.id);
  const seenRows = (await sql`SELECT notice_id FROM reminder_sends WHERE notice_id = ANY(${ids})`) as unknown as { notice_id: string }[];
  const seen = new Set(seenRows.map((r) => r.notice_id));
  const fresh = notices.filter((n) => !seen.has(n.id));
  if (!fresh.length) return { pushed: 0, skipped: notices.length, devices: 0 };

  // First-ever run (empty ledger): record what's already on the board WITHOUT
  // pushing, so standing reminders up doesn't blast the whole backlog at once.
  const totalRows = (await sql`SELECT count(*)::int AS n FROM reminder_sends`) as unknown as { n: number }[];
  if ((totalRows[0]?.n ?? 0) === 0) {
    await markSent(fresh.map((n) => n.id));
    return { pushed: 0, skipped: fresh.length, devices: 0, seeded: true };
  }

  let devices = 0;
  for (const n of fresh) {
    const res = await sendPushTo(
      { kind: "admins" },
      { title: `${noticeIcon(n.kind)} ${n.title}`, body: n.body, url: n.href, tag: n.id }
    );
    devices = Math.max(devices, res.devices);
  }
  await markSent(fresh.map((n) => n.id));

  // Keep the ledger from growing forever — a notice id we haven't touched in
  // ~60 days won't recur, so its record can go.
  await sql`DELETE FROM reminder_sends WHERE sent_at < now() - INTERVAL '60 days'`.catch(() => undefined);

  return { pushed: fresh.length, skipped: seen.size, devices };
}
