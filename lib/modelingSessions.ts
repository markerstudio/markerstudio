// Ramzi's modeling sessions — a private, self-contained ledger for the modeling
// work he does with Marker (he poses for a shoot, gets paid for it). It is
// completely separate from clients, invoices and the Notion books: each row is
// just a named photo session and what he earned. Only Ramzi (and the super
// admin) ever see it, on the partner page, and it counts only toward HIS money —
// nothing here touches Marker's income.
import { getSql } from "@/lib/db";

export type ModelingSession = {
  id: number;
  name: string;
  amount: number;
  currency: "ILS" | "USD";
  session_date: string;
  note: string | null;
  created_at: string;
};

export async function ensureModelingSessionsTable(): Promise<void> {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS modeling_sessions (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      amount NUMERIC NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'ILS',
      session_date DATE NOT NULL DEFAULT CURRENT_DATE,
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

export async function addModelingSession(input: {
  name: string;
  amount: number;
  currency?: "ILS" | "USD";
  sessionDate?: string; // ISO yyyy-mm-dd; defaults to today
  note?: string;
}): Promise<{ id: number }> {
  await ensureModelingSessionsTable();
  const sql = getSql();
  const currency = input.currency === "USD" ? "USD" : "ILS";
  const sessionDate = (input.sessionDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const rows = (await sql`
    INSERT INTO modeling_sessions (name, amount, currency, session_date, note)
    VALUES (${input.name}, ${input.amount}, ${currency}, ${sessionDate}, ${input.note || null})
    RETURNING id
  `) as unknown as { id: number }[];
  return { id: rows[0].id };
}

// Every modeling session, newest first.
export async function listModelingSessions(limit = 500): Promise<ModelingSession[]> {
  try {
    await ensureModelingSessionsTable();
    return (await getSql()`
      SELECT id, name, amount, currency, session_date, note, created_at
      FROM modeling_sessions ORDER BY session_date DESC, id DESC LIMIT ${limit}
    `) as unknown as ModelingSession[];
  } catch {
    return [];
  }
}

export async function deleteModelingSession(id: number): Promise<void> {
  try {
    await ensureModelingSessionsTable();
    await getSql()`DELETE FROM modeling_sessions WHERE id = ${id}`;
  } catch {
    /* best-effort */
  }
}
