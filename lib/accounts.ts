// Client account management — listing client logins and the password-reset
// flow. Resets are short-lived tokens (like invites): since the studio has no
// outbound mail, the admin generates a reset link and shares it, and the client
// can also start the flow from /forgot. Tolerates a missing table pre-migration.
import { getSql, isDbEnabled } from "@/lib/db";

export type ClientAccount = { id: number; email: string; name: string; client_slug: string; client_name: string };
export type ResetRow = { id: number; token: string; user_id: number; email: string; name: string; expires_at: string };

const RESET_TTL_MINUTES = 60;

export async function ensureResetsTable(): Promise<void> {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS password_resets (
      id SERIAL PRIMARY KEY,
      token TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ
    )
  `;
}

// Create a reset token for a user. Returns the token (caller builds the URL).
export async function createReset(userId: number, token: string): Promise<void> {
  await ensureResetsTable();
  await getSql()`
    INSERT INTO password_resets (token, user_id, expires_at)
    VALUES (${token}, ${userId}, now() + (${RESET_TTL_MINUTES} || ' minutes')::interval)
  `;
}

// Look up a user id by email (used to start a reset). Returns null if absent.
export async function findUserIdByEmail(email: string): Promise<number | null> {
  const rows = (await getSql()`SELECT id FROM users WHERE email = ${email} LIMIT 1`) as unknown as { id: number }[];
  return rows[0]?.id ?? null;
}

// Resolve a reset token to its target, with validity flags for the reset page.
export async function getReset(token: string): Promise<{ id: number; userId: number; email: string; name: string; valid: boolean } | null> {
  await ensureResetsTable();
  const rows = (await getSql()`
    SELECT pr.id, pr.user_id, pr.used_at, pr.expires_at, u.email, u.name
    FROM password_resets pr JOIN users u ON u.id = pr.user_id
    WHERE pr.token = ${token} LIMIT 1
  `) as unknown as { id: number; user_id: number; used_at: string | null; expires_at: string; email: string; name: string }[];
  const r = rows[0];
  if (!r) return null;
  const valid = !r.used_at && new Date(r.expires_at).getTime() > Date.now();
  return { id: r.id, userId: r.user_id, email: r.email, name: r.name, valid };
}

export async function consumeReset(id: number): Promise<void> {
  await getSql()`UPDATE password_resets SET used_at = now() WHERE id = ${id}`;
}

// Every client login, with its portal — for the admin accounts overview.
export async function listClientAccounts(): Promise<ClientAccount[]> {
  if (!isDbEnabled()) return [];
  try {
    return (await getSql()`
      SELECT u.id, u.email, u.name, c.slug AS client_slug, c.name AS client_name
      FROM users u JOIN clients c ON c.id = u.client_id
      WHERE u.role = 'client'
      ORDER BY c.name ASC, u.created_at ASC
    `) as unknown as ClientAccount[];
  } catch {
    return [];
  }
}

// Outstanding (unused, unexpired) reset links — shown so the admin can copy and
// share them, or revoke.
export async function listActiveResets(): Promise<ResetRow[]> {
  if (!isDbEnabled()) return [];
  try {
    await ensureResetsTable();
    return (await getSql()`
      SELECT pr.id, pr.token, pr.user_id, pr.expires_at, u.email, u.name
      FROM password_resets pr JOIN users u ON u.id = pr.user_id
      WHERE pr.used_at IS NULL AND pr.expires_at > now()
      ORDER BY pr.created_at DESC
    `) as unknown as ResetRow[];
  } catch {
    return [];
  }
}
