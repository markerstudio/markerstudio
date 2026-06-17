// Payment receipts — each payment recorded against an invoice becomes its own
// row here and gets a numbered receipt voucher (REC-YYYY-NNN) the client can
// view/print. The invoice's cached paid_amount is still the running total; this
// ledger is the itemised history behind it.
import { getSql } from "@/lib/db";

export type PaymentMethod = "cash" | "bank" | "card" | "other";

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
  created_at: string;
};

export async function ensurePaymentsTable(): Promise<void> {
  await getSql()`
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
}): Promise<{ id: number; number: string }> {
  await ensurePaymentsTable();
  const sql = getSql();
  const paidOn = (input.paidOn || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const year = parseInt(paidOn.slice(0, 4), 10) || new Date().getFullYear();
  const number = await nextReceiptNumber(year);
  const rows = (await sql`
    INSERT INTO invoice_payments (number, invoice_id, client_slug, amount, currency, paid_on, method, note)
    VALUES (${number}, ${input.invoiceId}, ${input.clientSlug}, ${input.amount}, ${input.currency}, ${paidOn}, ${input.method || null}, ${input.note || null})
    RETURNING id
  `) as unknown as { id: number }[];
  return { id: rows[0].id, number };
}

export async function listInvoicePayments(invoiceId: number): Promise<Payment[]> {
  try {
    await ensurePaymentsTable();
    return (await getSql()`
      SELECT id, number, invoice_id, client_slug, amount, currency, paid_on, method, note, created_at
      FROM invoice_payments WHERE invoice_id = ${invoiceId} ORDER BY paid_on DESC, id DESC
    `) as unknown as Payment[];
  } catch {
    return [];
  }
}

export async function getPayment(id: number): Promise<Payment | undefined> {
  try {
    await ensurePaymentsTable();
    const rows = (await getSql()`
      SELECT id, number, invoice_id, client_slug, amount, currency, paid_on, method, note, created_at
      FROM invoice_payments WHERE id = ${id} LIMIT 1
    `) as unknown as Payment[];
    return rows[0];
  } catch {
    return undefined;
  }
}
