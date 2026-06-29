// Studio-level state — for deliverables that belong to the studio rather than a
// client ("no client" / internal to-dos). Kept in a single-row JSONB table so it's
// trivial to extend with other studio-wide settings later. Mirrors the best-effort,
// ensure-on-write pattern used elsewhere (lib/clients ensureClientSchema).
import { getSql, isDbEnabled } from "@/lib/db";
import type { Deliverable } from "@/lib/clients";

export const STUDIO_SLUG = "__studio__"; // sentinel used by actions to target this store

type StudioState = { deliverables?: Deliverable[] };

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
  } catch {
    return []; // table not created yet — first write will create it
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
