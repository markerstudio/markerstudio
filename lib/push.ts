// Web Push — real notifications on phones (and desktops) even with the site
// closed. Devices subscribe via the service worker (public/sw.js) and land in
// the push_subscriptions table with who they belong to; the admin Notify panel
// (and future server events) fan out through sendPushTo. Requires VAPID keys:
//   npx web-push generate-vapid-keys
//   → VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (+ optional VAPID_SUBJECT mailto:)
// Without them everything degrades gracefully — subscribe endpoints report
// "unconfigured" and the panel explains what to set.
import webpush from "web-push";
import { getSql, isDbEnabled } from "@/lib/db";

export type PushPayload = { title: string; body?: string; url?: string; tag?: string };

export type PushTarget =
  | { kind: "me"; userId: number }
  | { kind: "admins" } // every non-client subscription
  | { kind: "clients" } // every client subscription
  | { kind: "client"; clientId: number };

export type StoredSubscription = {
  id: number;
  user_id: number | null;
  role: string | null;
  client_id: number | null;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export function isPushConfigured(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

let vapidReady = false;
function ensureVapid(): boolean {
  if (!isPushConfigured()) return false;
  if (!vapidReady) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:hello@marker.ps",
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );
    vapidReady = true;
  }
  return true;
}

async function ensureTable(): Promise<void> {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      role TEXT,
      client_id INTEGER,
      endpoint TEXT UNIQUE NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      ua TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

export async function savePushSubscription(input: {
  userId: number | null;
  role: string | null;
  clientId: number | null;
  endpoint: string;
  p256dh: string;
  auth: string;
  ua?: string;
}): Promise<boolean> {
  if (!isDbEnabled() || !input.endpoint || !input.p256dh || !input.auth) return false;
  await ensureTable();
  const sql = getSql();
  await sql`
    INSERT INTO push_subscriptions (user_id, role, client_id, endpoint, p256dh, auth, ua)
    VALUES (${input.userId}, ${input.role}, ${input.clientId}, ${input.endpoint}, ${input.p256dh}, ${input.auth}, ${input.ua || null})
    ON CONFLICT (endpoint) DO UPDATE
    SET user_id = EXCLUDED.user_id, role = EXCLUDED.role, client_id = EXCLUDED.client_id,
        p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, ua = EXCLUDED.ua
  `;
  return true;
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  if (!isDbEnabled() || !endpoint) return;
  try {
    const sql = getSql();
    await sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`;
  } catch {
    /* table may not exist yet — nothing to remove */
  }
}

export async function listPushSubscriptions(target: PushTarget): Promise<StoredSubscription[]> {
  if (!isDbEnabled()) return [];
  const sql = getSql();
  try {
    switch (target.kind) {
      case "me":
        return (await sql`SELECT id, user_id, role, client_id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ${target.userId}`) as unknown as StoredSubscription[];
      case "admins":
        return (await sql`SELECT id, user_id, role, client_id, endpoint, p256dh, auth FROM push_subscriptions WHERE role IS DISTINCT FROM 'client'`) as unknown as StoredSubscription[];
      case "clients":
        return (await sql`SELECT id, user_id, role, client_id, endpoint, p256dh, auth FROM push_subscriptions WHERE role = 'client'`) as unknown as StoredSubscription[];
      case "client":
        return (await sql`SELECT id, user_id, role, client_id, endpoint, p256dh, auth FROM push_subscriptions WHERE role = 'client' AND client_id = ${target.clientId}`) as unknown as StoredSubscription[];
    }
  } catch {
    return []; // table not created yet
  }
}

// Device counts for the Notify panel's audience picker.
export async function countPushSubscriptions(): Promise<{ admins: number; clients: number; byClient: Map<number, number> }> {
  const out = { admins: 0, clients: 0, byClient: new Map<number, number>() };
  if (!isDbEnabled()) return out;
  try {
    const sql = getSql();
    const rows = (await sql`SELECT role, client_id, count(*)::int AS n FROM push_subscriptions GROUP BY role, client_id`) as unknown as {
      role: string | null; client_id: number | null; n: number;
    }[];
    for (const r of rows) {
      if (r.role === "client") {
        out.clients += r.n;
        if (r.client_id != null) out.byClient.set(r.client_id, (out.byClient.get(r.client_id) || 0) + r.n);
      } else {
        out.admins += r.n;
      }
    }
  } catch {
    /* table not created yet */
  }
  return out;
}

// Fan a payload out to a target. Dead subscriptions (endpoint gone — app
// uninstalled, permission revoked) are pruned as we hit them.
export async function sendPushTo(target: PushTarget, payload: PushPayload): Promise<{ sent: number; failed: number; devices: number }> {
  if (!ensureVapid()) return { sent: 0, failed: 0, devices: 0 };
  const subs = await listPushSubscriptions(target);
  let sent = 0;
  let failed = 0;
  const body = JSON.stringify({
    title: payload.title.slice(0, 120),
    body: (payload.body || "").slice(0, 400),
    url: payload.url || "/",
    tag: payload.tag,
  });
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        body,
        { TTL: 3600 }
      );
      sent++;
    } catch (e) {
      failed++;
      const status = (e as { statusCode?: number })?.statusCode;
      if (status === 404 || status === 410) await removePushSubscription(sub.endpoint);
    }
  }
  return { sent, failed, devices: subs.length };
}
