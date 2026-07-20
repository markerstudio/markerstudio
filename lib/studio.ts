// Studio-level state — for deliverables that belong to the studio rather than a
// client ("no client" / internal to-dos). Kept in a single-row JSONB table so it's
// trivial to extend with other studio-wide settings later. Mirrors the best-effort,
// ensure-on-write pattern used elsewhere (lib/clients ensureClientSchema).
import { getSql, isDbEnabled } from "@/lib/db";
import { readSnapshot, isOutageError } from "@/lib/snapshot";
import type { Deliverable } from "@/lib/clients";

export const STUDIO_SLUG = "__studio__"; // sentinel used by actions to target this store

type StudioState = {
  deliverables?: Deliverable[];
  /** Agenda snoozes: stable item id → ISO yyyy-mm-dd the item reappears on.
   *  The agenda stays fully derived — this only quiets a row for a while. */
  agendaSnoozes?: Record<string, string>;
};

async function ensureStudioState() {
  const sql = getSql();
  await sql`CREATE TABLE IF NOT EXISTS studio_state (id INTEGER PRIMARY KEY DEFAULT 1, data JSONB NOT NULL DEFAULT '{}'::jsonb, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
  await sql`INSERT INTO studio_state (id, data) VALUES (1, '{}'::jsonb) ON CONFLICT (id) DO NOTHING`;
}

export async function getStudioDeliverables(): Promise<Deliverable[]> {
  if (!isDbEnabled()) return [];
  const sql = getSql();
  try {
    const rows = (await sql`SELECT data FROM studio_state WHERE id = 1 LIMIT 1`) as unknown as { data: StudioState }[];
    return rows[0]?.data?.deliverables ?? [];
  } catch (e) {
    // Missing table (fresh install) stays a quiet empty list; an unreachable
    // database falls back to the last studio snapshot (read-only mode).
    if (isOutageError(e)) {
      const snap = await readSnapshot();
      if (snap) return (snap.studio.deliverables ?? []) as Deliverable[];
    }
    return [];
  }
}

export async function saveStudioDeliverables(items: Deliverable[]): Promise<boolean> {
  if (!isDbEnabled()) return false;
  await ensureStudioState();
  const sql = getSql();
  await sql`
    UPDATE studio_state
    SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{deliverables}', ${JSON.stringify(items)}::jsonb, true), updated_at = now()
    WHERE id = 1
  `;
  return true;
}

export async function updateStudioDeliverables(mutate: (items: Deliverable[]) => void): Promise<boolean> {
  if (!isDbEnabled()) return false;
  await ensureStudioState();
  const items = await getStudioDeliverables();
  mutate(items);
  return saveStudioDeliverables(items);
}

export async function getAgendaSnoozes(): Promise<Record<string, string>> {
  if (!isDbEnabled()) return {};
  const sql = getSql();
  try {
    const rows = (await sql`SELECT data FROM studio_state WHERE id = 1 LIMIT 1`) as unknown as { data: StudioState }[];
    return rows[0]?.data?.agendaSnoozes ?? {};
  } catch (e) {
    if (isOutageError(e)) {
      const snap = await readSnapshot();
      if (snap) return snap.studio.agendaSnoozes ?? {};
    }
    return {}; // table not created yet — first write will create it
  }
}

/** Set (until > today) or clear (until <= today) one snooze. Expired entries
 *  are pruned on every write so the map never accumulates. `today` comes from
 *  the caller so the studio-timezone logic stays in lib/agenda. */
export async function saveAgendaSnooze(id: string, until: string, today: string): Promise<boolean> {
  if (!isDbEnabled()) return false;
  await ensureStudioState();
  const current = await getAgendaSnoozes();
  const next: Record<string, string> = {};
  for (const [k, v] of Object.entries(current)) if (v > today) next[k] = v;
  if (until > today) next[id] = until;
  else delete next[id];
  const sql = getSql();
  await sql`
    UPDATE studio_state
    SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{agendaSnoozes}', ${JSON.stringify(next)}::jsonb, true), updated_at = now()
    WHERE id = 1
  `;
  return true;
}
