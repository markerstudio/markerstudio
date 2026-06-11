// Undo for destructive admin actions. Before a delete runs, the affected rows
// are stowed as a JSONB snapshot; the redirect then carries ?undo=<id> so the
// page can offer a one-click Undo that re-inserts them (see UndoBanner).
// Snapshots are pruned after 24 hours.
import { getSql } from "@/lib/db";

export type UndoKind = "client" | "invoice" | "project" | "user" | "inquiry" | "application";

export type UndoSnapshot = {
  id: number;
  kind: UndoKind;
  label: string; // human-readable, shown in the banner ("Dr. Jack Sabat", "invoice INV-2026-003")
  payload: Record<string, unknown>;
  created_at: string;
};

// Append a query param to a path that may or may not already have a query —
// delete actions use it to carry ?undo=<id> on whatever "back" URL they got.
export function withParam(url: string, key: string, value: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(value)}`;
}

export async function ensureUndoTable(): Promise<void> {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS undo_snapshots (
      id SERIAL PRIMARY KEY,
      kind TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

// Stow the rows a delete is about to remove. Returns the snapshot id to carry
// in the redirect (?undo=<id>).
export async function snapshotForUndo(kind: UndoKind, label: string, payload: Record<string, unknown>): Promise<number> {
  await ensureUndoTable();
  const sql = getSql();
  await sql`DELETE FROM undo_snapshots WHERE created_at < now() - interval '24 hours'`;
  const rows = (await sql`
    INSERT INTO undo_snapshots (kind, label, payload) VALUES (${kind}, ${label}, ${JSON.stringify(payload)}::jsonb) RETURNING id
  `) as unknown as { id: number }[];
  return rows[0].id;
}

export async function getUndoSnapshot(id: number): Promise<UndoSnapshot | undefined> {
  if (!id) return undefined;
  try {
    const rows = (await getSql()`
      SELECT id, kind, label, payload, created_at FROM undo_snapshots WHERE id = ${id} LIMIT 1
    `) as unknown as UndoSnapshot[];
    return rows[0];
  } catch {
    return undefined; // table not created yet
  }
}

// After re-inserting rows with their original ids, move the sequence past the
// current max so future inserts don't collide.
async function bumpSequences(kind: UndoKind): Promise<void> {
  const sql = getSql();
  if (kind === "client") {
    await sql`SELECT setval(pg_get_serial_sequence('clients', 'id'), COALESCE((SELECT MAX(id) FROM clients), 0) + 1, false)`;
    await sql`SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 0) + 1, false)`;
  }
  if (kind === "invoice") await sql`SELECT setval(pg_get_serial_sequence('invoices', 'id'), COALESCE((SELECT MAX(id) FROM invoices), 0) + 1, false)`;
  if (kind === "project") await sql`SELECT setval(pg_get_serial_sequence('projects', 'id'), COALESCE((SELECT MAX(id) FROM projects), 0) + 1, false)`;
  if (kind === "user") await sql`SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 0) + 1, false)`;
  if (kind === "inquiry") await sql`SELECT setval(pg_get_serial_sequence('inquiries', 'id'), COALESCE((SELECT MAX(id) FROM inquiries), 0) + 1, false)`;
  if (kind === "application") await sql`SELECT setval(pg_get_serial_sequence('applications', 'id'), COALESCE((SELECT MAX(id) FROM applications), 0) + 1, false)`;
}

type UserRow = { id: number; email: string; name: string; password_hash: string; role: string | null; client_id: number | null; created_at: string };

async function restoreUser(u: UserRow): Promise<boolean> {
  const rows = (await getSql()`
    INSERT INTO users (id, email, name, password_hash, role, client_id, created_at)
    VALUES (${u.id}, ${u.email}, ${u.name}, ${u.password_hash}, ${u.role || "admin"}, ${u.client_id}, ${u.created_at})
    ON CONFLICT DO NOTHING RETURNING id
  `) as unknown as { id: number }[];
  return !!rows[0];
}

export type RestoreResult = { ok: boolean; kind?: UndoKind; label?: string; slug?: string };

// Re-insert the snapshotted rows with their original ids. ON CONFLICT DO
// NOTHING keeps this safe if a row with the same id/slug/email was created in
// the meantime — the undo then reports failure instead of clobbering anything.
export async function restoreSnapshot(id: number): Promise<RestoreResult> {
  const snap = await getUndoSnapshot(id);
  if (!snap) return { ok: false };
  const sql = getSql();
  const p = snap.payload;
  let ok = false;
  let slug: string | undefined;

  if (snap.kind === "client") {
    const c = p.client as { id: number; slug: string; name: string; logo: string; color: string; data: unknown; created_at: string; updated_at: string };
    const ins = (await sql`
      INSERT INTO clients (id, slug, name, logo, color, data, created_at, updated_at)
      VALUES (${c.id}, ${c.slug}, ${c.name}, ${c.logo}, ${c.color}, ${JSON.stringify(c.data || {})}::jsonb, ${c.created_at}, ${c.updated_at})
      ON CONFLICT DO NOTHING RETURNING id
    `) as unknown as { id: number }[];
    ok = !!ins[0];
    slug = c.slug;
    if (ok) for (const u of (p.users as UserRow[]) || []) await restoreUser(u);
  }

  if (snap.kind === "invoice") {
    const v = p.invoice as {
      id: number; number: string; client_id: number; client_slug: string; issued_date: string; due_date: string | null;
      items: unknown; note: string | null; status: string; source: string; vat_rate: number; paid_amount: number;
      archived_at: string | null; created_at: string;
    };
    const ins = (await sql`
      INSERT INTO invoices (id, number, client_id, client_slug, issued_date, due_date, items, note, status, source, vat_rate, paid_amount, archived_at, created_at)
      VALUES (${v.id}, ${v.number}, ${v.client_id}, ${v.client_slug}, ${v.issued_date}, ${v.due_date}, ${JSON.stringify(v.items || [])}::jsonb,
              ${v.note}, ${v.status}, ${v.source}, ${v.vat_rate}, ${v.paid_amount}, ${v.archived_at}, ${v.created_at})
      ON CONFLICT DO NOTHING RETURNING id
    `) as unknown as { id: number }[];
    ok = !!ins[0];
    slug = v.client_slug;
  }

  if (snap.kind === "project") {
    const pr = p.project as { id: number; slug: string; color: string; logo: string; year: string; data: unknown; sort_order: number; created_at: string; updated_at: string };
    const ins = (await sql`
      INSERT INTO projects (id, slug, color, logo, year, data, sort_order, created_at, updated_at)
      VALUES (${pr.id}, ${pr.slug}, ${pr.color}, ${pr.logo}, ${pr.year}, ${JSON.stringify(pr.data || {})}::jsonb, ${pr.sort_order}, ${pr.created_at}, ${pr.updated_at})
      ON CONFLICT DO NOTHING RETURNING id
    `) as unknown as { id: number }[];
    ok = !!ins[0];
    slug = pr.slug;
  }

  if (snap.kind === "user") ok = await restoreUser(p.user as UserRow);

  if (snap.kind === "inquiry") {
    const q = p.inquiry as { id: number; name: string; email: string; phone: string | null; brand: string | null; service: string | null; message: string | null; lang: string | null; created_at: string; read_at: string | null };
    const ins = (await sql`
      INSERT INTO inquiries (id, name, email, phone, brand, service, message, lang, created_at, read_at)
      VALUES (${q.id}, ${q.name}, ${q.email}, ${q.phone}, ${q.brand}, ${q.service}, ${q.message}, ${q.lang}, ${q.created_at}, ${q.read_at})
      ON CONFLICT DO NOTHING RETURNING id
    `) as unknown as { id: number }[];
    ok = !!ins[0];
  }

  if (snap.kind === "application") {
    const a = p.application as {
      id: number; first_name: string; last_name: string; gender: string | null; email: string; phone: string | null; address: string | null;
      talent: string | null; rate_session: string | null; rate: string | null; instagram: string | null; work_url: string | null;
      lang: string | null; created_at: string; read_at: string | null;
    };
    const ins = (await sql`
      INSERT INTO applications (id, first_name, last_name, gender, email, phone, address, talent, rate_session, rate, instagram, work_url, lang, created_at, read_at)
      VALUES (${a.id}, ${a.first_name}, ${a.last_name}, ${a.gender}, ${a.email}, ${a.phone}, ${a.address}, ${a.talent}, ${a.rate_session},
              ${a.rate}, ${a.instagram}, ${a.work_url}, ${a.lang}, ${a.created_at}, ${a.read_at})
      ON CONFLICT DO NOTHING RETURNING id
    `) as unknown as { id: number }[];
    ok = !!ins[0];
  }

  if (!ok) return { ok: false, kind: snap.kind, label: snap.label, slug };

  await bumpSequences(snap.kind);
  await sql`DELETE FROM undo_snapshots WHERE id = ${id}`;
  return { ok: true, kind: snap.kind, label: snap.label, slug };
}
