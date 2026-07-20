// Payment receipts — each payment recorded against an invoice becomes its own
// row here and gets a numbered receipt voucher (REC-YYYY-NNN) the client can
// view/print. The invoice's cached paid_amount is still the running total; this
// ledger is the itemised history behind it.
import { getSql, isDbEnabled } from "@/lib/db";
import { readSnapshot, isOutageError } from "@/lib/snapshot";

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
  // What this payment is worth in the INVOICE's currency, frozen at the
  // pay-day exchange rate when the currencies differ (e.g. $400 on an ILS
  // invoice → ~1,330). Equal to amount for same-currency payments; null on
  // rows recorded before the column existed (treated as amount).
  applied_amount: number | null;
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
  // Cross-currency support: the payment's value in the invoice's currency,
  // frozen at the pay-day rate (see Payment.applied_amount).
  await sql`ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS applied_amount NUMERIC`;
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

  // Second one-time baseline. The June '26 invoice-history backfill created
  // BACKDATED payments mirroring money that was already hand-tracked in Notion
  // — under slightly different dates/amounts (650 on the 31st vs Notion's 350
  // on the 1st), so the exact-date duplicate check cannot adopt them and a
  // re-sync would double the books. A payment whose pay date is far older than
  // the day it was recorded is that kind of historical mirror, never money the
  // sync lost — mark them "already in Notion" and leave only genuinely-new
  // payments pending. Runs once, guarded by a flag; payments recorded from now
  // on are synced (or errored) at record time, so this never touches them.
  const backfillBaseline = (await sql`
    INSERT INTO app_flags (key, value) VALUES ('payments-backfill-baseline-v1', 'done')
    ON CONFLICT (key) DO NOTHING RETURNING key
  `) as unknown as unknown[];
  if (backfillBaseline.length) {
    await sql`
      UPDATE invoice_payments
      SET notion_synced_at = created_at, notion_error = NULL
      WHERE notion_synced_at IS NULL
        AND paid_on < created_at::date - INTERVAL '7 days'
    `;
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
  // Value in the invoice's currency when it differs from the payment's (frozen
  // at the pay-day rate by the caller). Defaults to amount.
  appliedAmount?: number;
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
  const applied = Number.isFinite(input.appliedAmount) ? (input.appliedAmount as number) : input.amount;
  const rows = (await sql`
    INSERT INTO invoice_payments (number, invoice_id, client_slug, amount, currency, applied_amount, paid_on, method, note, allocation)
    VALUES (${number}, ${input.invoiceId}, ${input.clientSlug}, ${input.amount}, ${input.currency}, ${applied}, ${paidOn}, ${input.method || null}, ${input.note || null}, ${allocation}::jsonb)
    RETURNING id
  `) as unknown as { id: number }[];
  return { id: rows[0].id, number };
}

// Slim rows for computing per-line remainders across many invoices at once
// (the Record-payment picker) — one query instead of one per open invoice.
export type AppliedPayment = {
  invoice_id: number;
  amount: number;
  applied_amount: number | null;
  allocation: AllocationLine[] | null;
};
export async function listPaymentsForInvoices(ids: number[]): Promise<AppliedPayment[]> {
  if (!isDbEnabled() || ids.length === 0) return [];
  try {
    await ensurePaymentsTable();
    const sql = getSql();
    return (await sql`
      SELECT invoice_id, amount, applied_amount, allocation
      FROM invoice_payments WHERE invoice_id = ANY(${ids})
    `) as unknown as AppliedPayment[];
  } catch {
    return [];
  }
}

// What's still owed on EACH line of an invoice (VAT-inclusive), after every
// recorded payment. Allocations pool by line identity (label+kind+owner,
// consumed in line order so duplicate labels behave); payments recorded
// before allocations existed leave a slack spread proportionally — the lefts
// always sum to the invoice's true remaining. Shared by the Record-payment
// form and the invoice page's admin strip.
export function perLineLeft(
  items: { label: string; amount: string; kind?: string; owner?: string }[],
  vatRate: number,
  pays: { amount: number; applied_amount: number | null; allocation: AllocationLine[] | null }[]
): number[] {
  const toNum = (s: unknown) => {
    const n = parseFloat(String(s ?? "").replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };
  const factor = 1 + (Number(vatRate) || 0) / 100;
  const left = (items || []).map((it) => toNum(it.amount) * factor);
  const pool = new Map<string, number>();
  let allocated = 0;
  let appliedTotal = 0;
  for (const p of pays) {
    appliedTotal += Number(p.applied_amount ?? p.amount) || 0;
    for (const a of p.allocation ?? []) {
      const key = `${a.label || ""}|${a.kind || ""}|${a.owner || ""}`;
      const amt = Number(a.amount) || 0;
      pool.set(key, (pool.get(key) || 0) + amt);
      allocated += amt;
    }
  }
  (items || []).forEach((it, i) => {
    const key = `${it.label || ""}|${it.kind || ""}|${it.owner || ""}`;
    const take = Math.min(pool.get(key) || 0, left[i]);
    left[i] -= take;
    pool.set(key, (pool.get(key) || 0) - take);
  });
  const slack = Math.max(0, appliedTotal - allocated);
  const capacity = left.reduce((s, x) => s + x, 0);
  if (slack > 0 && capacity > 0) {
    const ratio = Math.min(1, slack / capacity);
    for (let i = 0; i < left.length; i++) left[i] -= left[i] * ratio;
  }
  return left.map((x) => Math.max(0, x));
}

export async function listInvoicePayments(invoiceId: number): Promise<Payment[]> {
  try {
    await ensurePaymentsTable();
    return (await getSql()`
      SELECT id, number, invoice_id, client_slug, amount, currency, applied_amount, paid_on::text AS paid_on, method, note, allocation, created_at::text AS created_at,
             notion_synced_at::text AS notion_synced_at, notion_page_ids, notion_error, notion_sync_attempts
      FROM invoice_payments WHERE invoice_id = ${invoiceId} ORDER BY paid_on DESC, id DESC
    `) as unknown as Payment[];
  } catch {
    return [];
  }
}

// Every payment recorded for one client, newest first.
export async function listClientPayments(slug: string, limit = 1000): Promise<Payment[]> {
  try {
    await ensurePaymentsTable();
    return (await getSql()`
      SELECT id, number, invoice_id, client_slug, amount, currency, applied_amount, paid_on::text AS paid_on, method, note, allocation, created_at::text AS created_at,
             notion_synced_at::text AS notion_synced_at, notion_page_ids, notion_error, notion_sync_attempts
      FROM invoice_payments WHERE client_slug = ${slug} ORDER BY paid_on DESC, id DESC LIMIT ${limit}
    `) as unknown as Payment[];
  } catch (e) {
    // Database unreachable → serve the last studio snapshot (read-only mode)
    // so the client portal's payment history stays visible through an outage.
    if (isOutageError(e)) {
      const snap = await readSnapshot();
      if (snap) return (snap.payments as Payment[]).filter((p) => p.client_slug === slug).slice(0, limit);
    }
    return [];
  }
}

// Every recorded payment, newest first — for the partner (Ramzi) roll-up.
export async function listAllPayments(limit = 1000): Promise<Payment[]> {
  try {
    await ensurePaymentsTable();
    return (await getSql()`
      SELECT id, number, invoice_id, client_slug, amount, currency, applied_amount, paid_on::text AS paid_on, method, note, allocation, created_at::text AS created_at,
             notion_synced_at::text AS notion_synced_at, notion_page_ids, notion_error, notion_sync_attempts
      FROM invoice_payments ORDER BY paid_on DESC, id DESC LIMIT ${limit}
    `) as unknown as Payment[];
  } catch (e) {
    // Database unreachable → serve the last studio snapshot (read-only mode).
    if (isOutageError(e)) {
      const snap = await readSnapshot();
      if (snap) return (snap.payments as Payment[]).slice(0, limit);
    }
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
      SELECT id, number, invoice_id, client_slug, amount, currency, applied_amount, paid_on::text AS paid_on, method, note, allocation, created_at::text AS created_at,
             notion_synced_at::text AS notion_synced_at, notion_page_ids, notion_error, notion_sync_attempts
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

// Health of the payment→Notion mirror, for the admin to SEE (instead of a
// silent failure). Every payment that should be in Notion but isn't: client is
// linked to a Notion page, not Ramzi's, recorded in the last year. Unlike
// listUnsyncedPayments this ignores the attempt cap and the 90-day window —
// once a payment has silently failed we want it visible until it's fixed, not
// hidden after ten tries. Returns a count, the money at stake, the most recent
// Notion error (the actual reason the write failed), and a short sample list.
export type NotionSyncHealth = {
  pending: number; // how many payments haven't reached Notion
  ils: number; // ILS at stake across those payments
  usd: number; // USD at stake
  lastError: string | null; // the most recent Notion error recorded (the real cause)
  oldestPaidOn: string | null; // earliest affected payment date
  sample: { number: string; client_slug: string; amount: number; currency: string; paid_on: string; error: string | null }[];
};

export async function notionSyncHealth(sampleLimit = 8): Promise<NotionSyncHealth> {
  const empty: NotionSyncHealth = { pending: 0, ils: 0, usd: 0, lastError: null, oldestPaidOn: null, sample: [] };
  try {
    await ensurePaymentsTable();
    const rows = (await getSql()`
      SELECT p.number, p.client_slug, p.amount, p.currency, p.paid_on::text AS paid_on, p.notion_error, p.created_at::text AS created_at
      FROM invoice_payments p
      JOIN clients c ON c.slug = p.client_slug
      WHERE p.notion_synced_at IS NULL
        AND p.amount > 0
        AND COALESCE(c.data->>'notionPageId', '') <> ''
        AND COALESCE(c.data->>'owner', '') <> 'ramzi'
        AND p.paid_on > CURRENT_DATE - INTERVAL '365 days'
      ORDER BY p.paid_on DESC, p.id DESC
    `) as unknown as { number: string; client_slug: string; amount: number; currency: string; paid_on: string; notion_error: string | null; created_at: string }[];
    if (!rows.length) return empty;

    let ils = 0;
    let usd = 0;
    let lastError: string | null = null;
    for (const r of rows) {
      const amt = Number(r.amount) || 0;
      if (r.currency === "USD") usd += amt;
      else ils += amt;
      // The rows are newest-first; keep the first non-empty error we see.
      if (!lastError && r.notion_error) lastError = r.notion_error;
    }
    return {
      pending: rows.length,
      ils,
      usd,
      lastError,
      oldestPaidOn: rows[rows.length - 1]?.paid_on?.slice(0, 10) || null,
      sample: rows.slice(0, sampleLimit).map((r) => ({
        number: r.number,
        client_slug: r.client_slug,
        amount: Number(r.amount) || 0,
        currency: r.currency,
        paid_on: (r.paid_on || "").slice(0, 10),
        error: r.notion_error,
      })),
    };
  } catch {
    return empty;
  }
}

// Payments that still aren't in Notion but should be: client is linked to a
// Notion page, recorded within the recent window. The attempt cap and the
// short 90-day window keep the AUTOMATIC path cheap and non-spammy; the
// admin's explicit "Re-sync payments" click passes ignoreAttemptCap, which
// also widens the window to a year — a manual retry must never silently skip
// a payment because it failed too often or is a backdated backfill.
export async function listUnsyncedPayments(limit = 20, opts?: { ignoreAttemptCap?: boolean }): Promise<Payment[]> {
  const manual = !!opts?.ignoreAttemptCap;
  const windowDays = manual ? 365 : 90;
  try {
    await ensurePaymentsTable();
    return (await getSql()`
      SELECT p.id, p.number, p.invoice_id, p.client_slug, p.amount, p.currency, p.applied_amount, p.paid_on::text AS paid_on, p.method, p.note,
             p.allocation, p.created_at::text AS created_at, p.notion_synced_at::text AS notion_synced_at, p.notion_page_ids, p.notion_error, p.notion_sync_attempts
      FROM invoice_payments p
      JOIN clients c ON c.slug = p.client_slug
      WHERE p.notion_synced_at IS NULL
        AND COALESCE(c.data->>'notionPageId', '') <> ''
        AND COALESCE(c.data->>'owner', '') <> 'ramzi'
        AND p.paid_on > CURRENT_DATE - (${windowDays} * INTERVAL '1 day')
        AND (${manual} OR COALESCE(p.notion_sync_attempts, 0) < 10)
      ORDER BY p.paid_on ASC, p.id ASC
      LIMIT ${limit}
    `) as unknown as Payment[];
  } catch {
    return [];
  }
}

// Every Notion Income page id already claimed by a payment OTHER than payId.
// The reconciler's "is this already booked?" check must never adopt rows that
// belong to a different payment — that's how one deposit could swallow
// another's Notion rows and leave a real payment unwritten forever.
export async function listClaimedNotionPageIds(excludePayId: number): Promise<string[]> {
  try {
    await ensurePaymentsTable();
    const rows = (await getSql()`
      SELECT notion_page_ids FROM invoice_payments
      WHERE notion_page_ids IS NOT NULL AND id <> ${excludePayId}
    `) as unknown as { notion_page_ids: string[] | null }[];
    const out = new Set<string>();
    for (const r of rows) for (const id of r.notion_page_ids || []) if (id) out.add(id);
    return Array.from(out);
  } catch {
    return [];
  }
}
