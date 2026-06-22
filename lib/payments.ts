// Payment receipts — each payment recorded against an invoice becomes its own
// row here and gets a numbered receipt voucher (REC-YYYY-NNN) the client can
// view/print. The invoice's cached paid_amount is still the running total; this
// ledger is the itemised history behind it.
import { getSql } from "@/lib/db";

export type PaymentMethod = "cash" | "bank" | "card" | "other";

// How a payment was split across the invoice's lines (drives the Marker/Ramzi
// split and the per-line Notion sync). Stored so receipts and Ramzi's books can
// show exactly what each payment covered.
export type AllocationLine = { label: string; kind?: string; owner?: string; amount: number };

export type Payment = {
  id: number;
  number: string;
  invoice_id: number;
  client_slug: string;
  amount: number;
  currency: "ILS" | "USD";
  paid_on: string;
  method: PaymentMethod | null;
  note: string | null;
  allocation: AllocationLine[] | null;
  created_at: string;
  // Notion mirror state — when this payment was written to the Income DB, the
  // page ids it created, the last error (if any), and how many tries it took.
  // null synced_at means "not yet in Notion" (pending or never linked).
  notion_synced_at: string | null;
  notion_page_ids: string[] | null;
  notion_error: string | null;
  notion_sync_attempts: number;
};

export async function ensurePaymentsTable(): Promise<void> {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS invoice_payments (
      id SERIAL PRIMARY KEY,
      number TEXT NOT NULL,
      invoice_id INTEGER NOT NULL,
      client_slug TEXT NOT NULL,
      amount NUMERIC NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'ILS',
      paid_on DATE NOT NULL DEFAULT CURRENT_DATE,
      method TEXT,
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS allocation JSONB`;
  // Notion sync bookkeeping — so a payment is never silently lost when the
  // Notion write fails. A null notion_synced_at marks it as still pending.
  await sql`ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS notion_synced_at TIMESTAMPTZ`;
  await sql`ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS notion_page_ids JSONB`;
  await sql`ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS notion_error TEXT`;
  await sql`ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS notion_sync_attempts INTEGER NOT NULL DEFAULT 0`;

  // One-time baseline. The notion_* columns above are brand new, so every
  // payment recorded before this release reads as notion_synced_at = NULL
  // ("never synced"). But those were ALREADY mirrored to Notion at record time
  // under the old code — so claim a flag and mark the whole existing backlog as
  // synced. Without this, the reconciler re-creates a duplicate Income row for
  // every historical payment. Guarded by a flag so it runs exactly once.
  await sql`
    CREATE TABLE IF NOT EXISTS app_flags (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  const baseline = (await sql`
    INSERT INTO app_flags (key, value) VALUES ('payments-notion-sync-baseline-v1', 'done')
    ON CONFLICT (key) DO NOTHING RETURNING key
  `) as unknown as unknown[];
  if (baseline.length) {
    await sql`UPDATE invoice_payments SET notion_synced_at = COALESCE(created_at, now()) WHERE notion_synced_at IS NULL`;
  }
}

// REC-YYYY-NNN, sequential within the receipt's year.
async function nextReceiptNumber(year: number): Promise<string> {
  const sql = getSql();
  const prefix = `REC-${year}-`;
  const rows = (await sql`
    SELECT number FROM invoice_payments WHERE number LIKE ${prefix + "%"} ORDER BY id DESC LIMIT 1
  `) as unknown as { number: string }[];
  let n = 1;
  if (rows[0]) {
    const last = parseInt(rows[0].number.slice(prefix.length), 10);
    if (Number.isFinite(last)) n = last + 1;
  }
  return `${prefix}${String(n).padStart(3, "0")}`;
}

export async function recordInvoicePayment(input: {
  invoiceId: number;
  clientSlug: string;
  amount: number;
  currency: "ILS" | "USD";
  paidOn?: string; // ISO yyyy-mm-dd; defaults to today
  method?: PaymentMethod;
  note?: string;
  allocation?: AllocationLine[];
}): Promise<{ id: number; number: string }> {
  await ensurePaymentsTable();
  const sql = getSql();
  const paidOn = (input.paidOn || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const year = parseInt(paidOn.slice(0, 4), 10) || new Date().getFullYear();
  const number = await nextReceiptNumber(year);
  const allocation = input.allocation && input.allocation.length ? JSON.stringify(input.allocation) : null;
  const rows = (await sql`
    INSERT INTO invoice_payments (number, invoice_id, client_slug, amount, currency, paid_on, method, note, allocation)
    VALUES (${number}, ${input.invoiceId}, ${input.clientSlug}, ${input.amount}, ${input.currency}, ${paidOn}, ${input.method || null}, ${input.note || null}, ${allocation}::jsonb)
    RETURNING id
  `) as unknown as { id: number }[];
  return { id: rows[0].id, number };
}

export async function listInvoicePayments(invoiceId: number): Promise<Payment[]> {
  try {
    await ensurePaymentsTable();
    return (await getSql()`
      SELECT id, number, invoice_id, client_slug, amount, currency, paid_on, method, note, allocation, created_at,
             notion_synced_at, notion_page_ids, notion_error, notion_sync_attempts
      FROM invoice_payments WHERE invoice_id = ${invoiceId} ORDER BY paid_on DESC, id DESC
    `) as unknown as Payment[];
  } catch {
    return [];
  }
}

// Every recorded payment, newest first — for the partner (Ramzi) roll-up.
export async function listAllPayments(limit = 1000): Promise<Payment[]> {
  try {
    await ensurePaymentsTable();
    return (await getSql()`
      SELECT id, number, invoice_id, client_slug, amount, currency, paid_on, method, note, allocation, created_at,
             notion_synced_at, notion_page_ids, notion_error, notion_sync_attempts
      FROM invoice_payments ORDER BY paid_on DESC, id DESC LIMIT ${limit}
    `) as unknown as Payment[];
  } catch {
    return [];
  }
}

// How much of a payment was Ramzi's (stories / owner=ramzi lines), in the
// payment's currency. Falls back to 0 when the payment carried no allocation.
export function ramziAmountOf(p: Payment): number {
  return (p.allocation || [])
    .filter((a) => a.owner === "ramzi" || a.kind === "stories")
    .reduce((s, a) => s + (Number(a.amount) || 0), 0);
}

export async function getPayment(id: number): Promise<Payment | undefined> {
  try {
    await ensurePaymentsTable();
    const rows = (await getSql()`
      SELECT id, number, invoice_id, client_slug, amount, currency, paid_on, method, note, allocation, created_at,
             notion_synced_at, notion_page_ids, notion_error, notion_sync_attempts
      FROM invoice_payments WHERE id = ${id} LIMIT 1
    `) as unknown as Payment[];
    return rows[0];
  } catch {
    return undefined;
  }
}

// Void a payment (deletes the receipt row). The caller re-derives the invoice's
// paid total/status. Past Notion income rows are not removed automatically.
export async function deletePayment(id: number): Promise<void> {
  try {
    await ensurePaymentsTable();
    await getSql()`DELETE FROM invoice_payments WHERE id = ${id}`;
  } catch {
    /* best-effort */
  }
}

// Mark a payment as successfully mirrored to Notion, recording the Income page
// ids it created (so a later void/re-sync can find them) and clearing any error.
export async function markPaymentSynced(id: number, pageIds: string[]): Promise<void> {
  try {
    await ensurePaymentsTable();
    await getSql()`
      UPDATE invoice_payments
      SET notion_synced_at = now(),
          notion_page_ids = ${JSON.stringify(pageIds)}::jsonb,
          notion_error = NULL,
          notion_sync_attempts = COALESCE(notion_sync_attempts, 0) + 1
      WHERE id = ${id}
    `;
  } catch {
    /* best-effort — failing to record success just means we re-check later */
  }
}

// Record a failed Notion sync: keep any partially-written page ids (so the next
// retry archives them and avoids duplicates), store the error, bump the attempt
// count, and leave notion_synced_at NULL so the reconciler picks it up again.
export async function markPaymentSyncFailed(id: number, pageIds: string[], error: string): Promise<void> {
  try {
    await ensurePaymentsTable();
    await getSql()`
      UPDATE invoice_payments
      SET notion_page_ids = ${JSON.stringify(pageIds)}::jsonb,
          notion_error = ${error.slice(0, 500)},
          notion_sync_attempts = COALESCE(notion_sync_attempts, 0) + 1
      WHERE id = ${id}
    `;
  } catch {
    /* best-effort */
  }
}

// Payments that still aren't in Notion but should be: client is linked to a
// Notion page, recorded within the last 90 days, and we haven't already given up
// after many tries. Oldest first so the books fill in chronologically.
export async function listUnsyncedPayments(limit = 20): Promise<Payment[]> {
  try {
    await ensurePaymentsTable();
    return (await getSql()`
      SELECT p.id, p.number, p.invoice_id, p.client_slug, p.amount, p.currency, p.paid_on, p.method, p.note,
             p.allocation, p.created_at, p.notion_synced_at, p.notion_page_ids, p.notion_error, p.notion_sync_attempts
      FROM invoice_payments p
      JOIN clients c ON c.slug = p.client_slug
      WHERE p.notion_synced_at IS NULL
        AND COALESCE(c.data->>'notionPageId', '') <> ''
        AND COALESCE(c.data->>'owner', '') <> 'ramzi'
        AND p.paid_on > CURRENT_DATE - INTERVAL '90 days'
        AND COALESCE(p.notion_sync_attempts, 0) < 10
      ORDER BY p.paid_on ASC, p.id ASC
      LIMIT ${limit}
    `) as unknown as Payment[];
  } catch {
    return [];
  }
}
