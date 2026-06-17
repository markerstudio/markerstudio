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
      SELECT id, number, invoice_id, client_slug, amount, currency, paid_on, method, note, allocation, created_at
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
      SELECT id, number, invoice_id, client_slug, amount, currency, paid_on, method, note, allocation, created_at
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
      SELECT id, number, invoice_id, client_slug, amount, currency, paid_on, method, note, allocation, created_at
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
