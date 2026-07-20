// The studio's outage armor: an encrypted snapshot of all core data, written
// to Vercel Blob on a schedule (see /api/snapshot + vercel.json crons) and
// read back whenever the live database is unreachable. The read libs
// (clients, invoices, payments, studio) fall back to it automatically, so a
// database cutoff — like the July 2026 Neon network-transfer suspension —
// degrades the app to read-only-on-yesterday's-data instead of an outage.
//
// Deliberately self-contained: only lib/db + node crypto + @vercel/blob.
// The data libs import from here, never the other way around (no cycles).
//
// Encrypted (AES-256-GCM, key derived from AUTH_SECRET) because Blob URLs
// are public-if-known and the snapshot holds client and finance data. The
// users table is intentionally NOT snapshotted — no password hashes at rest
// outside Postgres, which also means sign-in still requires the live DB
// (already-signed-in sessions are JWTs and keep working through an outage).
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { getSql, isDbEnabled } from "@/lib/db";

export type StudioSnapshot = {
  at: string; // ISO timestamp of the write
  clients: unknown[];
  invoices: unknown[];
  payments: unknown[];
  studio: { deliverables?: unknown[]; agendaSnoozes?: Record<string, string> };
};

const BLOB_PATH = "snapshots/studio-snapshot.enc";

/* ---- crypto ------------------------------------------------------------- */

function key(): Buffer | null {
  const s = process.env.AUTH_SECRET;
  if (!s) return null;
  return createHash("sha256").update(`${s}:studio-snapshot`).digest();
}

function encrypt(json: string): Buffer | null {
  const k = key();
  if (!k) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  const body = Buffer.concat([cipher.update(json, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

function decrypt(buf: Buffer): string | null {
  const k = key();
  if (!k || buf.length < 29) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", k, buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/* ---- storage (Vercel Blob in production, a plain file in local dev) ------ */

async function store(buf: Buffer): Promise<boolean> {
  if (process.env.SNAPSHOT_FILE) {
    const { writeFile } = await import("fs/promises");
    await writeFile(process.env.SNAPSHOT_FILE, buf);
    return true;
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) return false;
  const { put } = await import("@vercel/blob");
  await put(BLOB_PATH, buf, {
    access: "public", // content is encrypted; the URL alone reveals nothing
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/octet-stream",
  });
  return true;
}

async function load(): Promise<Buffer | null> {
  if (process.env.SNAPSHOT_FILE) {
    try {
      const { readFile } = await import("fs/promises");
      return await readFile(process.env.SNAPSHOT_FILE);
    } catch {
      return null;
    }
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  try {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: BLOB_PATH, limit: 1 });
    if (!blobs[0]?.url) return null;
    const res = await fetch(blobs[0].url, { cache: "no-store" });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/* ---- write -------------------------------------------------------------- */

// Queries duplicated (not imported from the data libs) on purpose: the libs
// fall back to THIS module when their own queries fail — importing them here
// would be a cycle, and a snapshot writer that itself falls back to the
// snapshot would be an ouroboros.
export async function writeSnapshot(): Promise<{ ok: boolean; at?: string; counts?: Record<string, number>; error?: string }> {
  if (!isDbEnabled()) return { ok: false, error: "no database configured" };
  const sql = getSql();
  try {
    const [clients, invoices, payments, studioRows] = await Promise.all([
      sql`SELECT id, slug, name, logo, color, data FROM clients ORDER BY created_at ASC`,
      sql`
        SELECT id, number, client_id, client_slug, issued_date::text AS issued_date, due_date::text AS due_date, items, note, status, source, vat_rate, paid_amount, archived_at, created_at
        FROM invoices ORDER BY created_at DESC LIMIT 500
      `,
      sql`
        SELECT id, number, invoice_id, client_slug, amount, currency, applied_amount, paid_on::text AS paid_on, method, note, allocation, created_at::text AS created_at,
               notion_synced_at::text AS notion_synced_at, notion_page_ids, notion_error, notion_sync_attempts
        FROM invoice_payments ORDER BY paid_on DESC, id DESC LIMIT 500
      `.catch(() => [] as unknown[]), // table may not exist yet on fresh installs
      sql`SELECT data FROM studio_state WHERE id = 1 LIMIT 1`.catch(() => [] as unknown[]),
    ]);
    const studio = ((studioRows as { data?: StudioSnapshot["studio"] }[])[0]?.data ?? {}) as StudioSnapshot["studio"];
    const snap: StudioSnapshot = {
      at: new Date().toISOString(),
      clients: clients as unknown[],
      invoices: invoices as unknown[],
      payments: payments as unknown[],
      studio: { deliverables: studio.deliverables ?? [], agendaSnoozes: studio.agendaSnoozes ?? {} },
    };
    const buf = encrypt(JSON.stringify(snap));
    if (!buf) return { ok: false, error: "AUTH_SECRET is not set — cannot encrypt" };
    if (!(await store(buf))) return { ok: false, error: "no snapshot storage (BLOB_READ_WRITE_TOKEN unset)" };
    cached = { snap, loadedAt: Date.now() }; // fresh write refreshes the read cache
    return {
      ok: true,
      at: snap.at,
      counts: {
        clients: snap.clients.length,
        invoices: snap.invoices.length,
        payments: snap.payments.length,
        studioTasks: snap.studio.deliverables?.length ?? 0,
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/* ---- read --------------------------------------------------------------- */

// Warm-instance memo so an outage doesn't turn every request into a Blob
// round-trip. 60s is fresh enough for a copy that only changes every 6 hours.
let cached: { snap: StudioSnapshot | null; loadedAt: number } | null = null;

export async function readSnapshot(): Promise<StudioSnapshot | null> {
  if (cached && Date.now() - cached.loadedAt < 60_000) return cached.snap;
  const buf = await load();
  const json = buf ? decrypt(buf) : null;
  let snap: StudioSnapshot | null = null;
  if (json) {
    try {
      snap = JSON.parse(json) as StudioSnapshot;
    } catch {
      snap = null;
    }
  }
  cached = { snap, loadedAt: Date.now() };
  return snap;
}

export async function snapshotStatus(): Promise<{ available: boolean; at?: string }> {
  const snap = await readSnapshot();
  return snap ? { available: true, at: snap.at } : { available: false };
}

/* ---- shared fallback helper --------------------------------------------- */

// True for errors that smell like "the database is unreachable" (connection
// refused, fetch failed, compute suspended) as opposed to SQL-level errors
// (missing table on a fresh install, bad query) — only the former should
// switch a read over to the snapshot.
export function isOutageError(err: unknown): boolean {
  const code = (err as { code?: unknown })?.code;
  if (typeof code === "string" && /^(42|23|22|3F|2B)/.test(code)) return false; // SQL/schema errors
  return true;
}
