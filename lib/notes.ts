// Notes — the studio's scratchpad. A note attaches to an existing client
// (client_slug), carries a freeform context label (a prospect / "new client"
// not yet in the system, or anything extra), or stands alone as a studio note.
// Its own Neon table; additive only — touches nothing else.
import { getSql, isDbEnabled } from "@/lib/db";

export type Note = {
  id: number;
  title: string;
  body: string;
  client_slug: string | null;
  context_label: string | null;
  pinned: boolean;
  created_at: string;
  updated_at: string;
};

export async function ensureNotesTable(): Promise<void> {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS notes (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      client_slug TEXT,
      context_label TEXT,
      pinned BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      archived_at TIMESTAMPTZ
    )
  `;
}

// Unarchived notes, pinned first, freshest first within each group.
export async function listNotes(): Promise<Note[]> {
  if (!isDbEnabled()) return [];
  try {
    await ensureNotesTable();
    const sql = getSql();
    return (await sql`
      SELECT id, title, body, client_slug, context_label, pinned, created_at::text AS created_at, updated_at::text AS updated_at
      FROM notes WHERE archived_at IS NULL
      ORDER BY pinned DESC, updated_at DESC
      LIMIT 500
    `) as unknown as Note[];
  } catch {
    return [];
  }
}

export async function createNote(input: {
  title?: string;
  body?: string;
  clientSlug?: string | null;
  contextLabel?: string | null;
  pinned?: boolean;
}): Promise<Note | null> {
  if (!isDbEnabled()) return null;
  await ensureNotesTable();
  const sql = getSql();
  const rows = (await sql`
    INSERT INTO notes (title, body, client_slug, context_label, pinned)
    VALUES (${input.title || ""}, ${input.body || ""}, ${input.clientSlug || null}, ${input.contextLabel || null}, ${!!input.pinned})
    RETURNING id, title, body, client_slug, context_label, pinned, created_at::text AS created_at, updated_at::text AS updated_at
  `) as unknown as Note[];
  return rows[0] ?? null;
}

export async function getNote(id: number): Promise<Note | undefined> {
  if (!isDbEnabled()) return undefined;
  const sql = getSql();
  const rows = (await sql`
    SELECT id, title, body, client_slug, context_label, pinned, created_at::text AS created_at, updated_at::text AS updated_at
    FROM notes WHERE id = ${id} LIMIT 1
  `) as unknown as Note[];
  return rows[0];
}

// Patch a note's text / link fields. Undefined leaves a field alone; the link
// fields take explicit null to clear (moving a note back to "Studio"). Stamps
// updated_at so the wall keeps freshest-first order.
export async function updateNote(
  id: number,
  patch: { title?: string; body?: string; clientSlug?: string | null; contextLabel?: string | null }
): Promise<boolean> {
  if (!isDbEnabled()) return false;
  const cur = await getNote(id);
  if (!cur) return false;
  const title = patch.title !== undefined ? patch.title : cur.title;
  const body = patch.body !== undefined ? patch.body : cur.body;
  const clientSlug = patch.clientSlug !== undefined ? patch.clientSlug : cur.client_slug;
  const contextLabel = patch.contextLabel !== undefined ? patch.contextLabel : cur.context_label;
  await getSql()`
    UPDATE notes
    SET title = ${title}, body = ${body}, client_slug = ${clientSlug},
        context_label = ${contextLabel}, updated_at = now()
    WHERE id = ${id}
  `;
  return true;
}

// Pin/unpin on its own — deliberately does NOT stamp updated_at, so pinning an
// old note doesn't pretend it was just edited.
export async function setNotePinned(id: number, pinned: boolean): Promise<boolean> {
  if (!isDbEnabled()) return false;
  await getSql()`UPDATE notes SET pinned = ${pinned} WHERE id = ${id}`;
  return true;
}

// Soft delete — the note vanishes from the wall but stays in the table.
export async function archiveNote(id: number): Promise<boolean> {
  if (!isDbEnabled()) return false;
  await getSql()`UPDATE notes SET archived_at = now() WHERE id = ${id}`;
  return true;
}

export async function deleteNote(id: number): Promise<boolean> {
  if (!isDbEnabled()) return false;
  await getSql()`DELETE FROM notes WHERE id = ${id}`;
  return true;
}
