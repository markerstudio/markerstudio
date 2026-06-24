// Durable, self-healing mirror of recorded payments into the Notion Income DB.
//
// A payment is the source of truth LOCALLY; this writes a matching set of Income
// rows into Notion and — crucially — remembers whether that succeeded. Failures
// are recorded on the payment row (not swallowed) and retried automatically by
// reconcilePendingNotionPayments, so a transient Notion outage, rate-limit, or
// token hiccup can never silently drop a payment from the studio's books.
import { getSql, isDbEnabled } from "@/lib/db";
import {
  getInvoice, invoiceTotal, lineAmount, isRamziLine, inferKind, notionNameForKind,
  type InvoiceItem, type LineKind,
} from "@/lib/invoices";
import { createIncomePaymentLines, notionArchivePage, incomeAlreadyRecorded, NotionSyncError } from "@/lib/notion";
import {
  ensurePaymentsTable, listUnsyncedPayments, markPaymentSynced, markPaymentSyncFailed,
  type AllocationLine,
} from "@/lib/payments";
import type { ClientData } from "@/lib/clients";

// Turn a payment into the per-category Notion Income rows the budget formula
// expects ("Branding", "Plan Payment", "Extra"). Ramzi/stories lines are dropped
// — they're collected for Ramzi, never Marker income. Prefers the admin's
// explicit split (allocation); otherwise apportions across the invoice's own
// Marker lines by share. Falls back to a single row when nothing else survives.
export function buildIncomeLines(
  amount: number,
  items: InvoiceItem[],
  label: string,
  allocation?: AllocationLine[] | null,
): { name: string; amount: number }[] {
  let lines: { name: string; amount: number }[];
  if (allocation && allocation.length) {
    lines = allocation
      .filter((a) => !(a.owner === "ramzi" || a.kind === "stories"))
      .map((a) => ({
        name: notionNameForKind((a.kind as LineKind) || inferKind({ label: a.label, amount: String(a.amount) })),
        amount: Math.round(a.amount),
      }))
      .filter((l) => l.amount > 0);
  } else {
    const clientTotal = invoiceTotal(items);
    const markerItems = (items || []).filter((it) => !isRamziLine(it));
    const shares = markerItems.map((it) => (clientTotal > 0 ? lineAmount(it.amount) / clientTotal : 0));
    // Exact Marker total for this payment — so per-line rounding can't drop or
    // add a shekel against the books.
    const target = Math.round(amount * shares.reduce((a, b) => a + b, 0));
    lines = markerItems.map((it, i) => ({ name: notionNameForKind(inferKind(it)), amount: Math.round(amount * shares[i]) }));
    const sum = lines.reduce((s, l) => s + l.amount, 0);
    if (lines.length && sum !== target) lines[lines.length - 1].amount += target - sum;
    lines = lines.filter((l) => l.amount > 0);
  }
  return lines.length ? lines : [{ name: label, amount: Math.round(amount) }];
}

// The client's Notion page id, or null when the client isn't linked to Notion.
// Ramzi-owned clients are the partner's own — walled off from Marker's Notion
// books — so they never have a sync target, even if a page was linked.
async function clientNotionPageId(slug: string): Promise<string | null> {
  try {
    const rows = (await getSql()`SELECT data FROM clients WHERE slug = ${slug} LIMIT 1`) as unknown as { data: ClientData }[];
    const d = rows[0]?.data;
    if (!d || d.owner === "ramzi") return null;
    return d.notionPageId || null;
  } catch {
    return null;
  }
}

export type SyncPaymentInput = {
  payId: number;
  slug: string;
  amount: number;
  items: InvoiceItem[];
  label: string;
  currency: "ILS" | "USD";
  dueDate?: string | null;
  allocation?: AllocationLine[] | null;
  paidOn?: string;
  // Receipt number (REC-YYYY-NNN) — stamped on the Notion rows when the Income DB
  // has a Ref property, making the write idempotent by receipt (opt-in).
  ref?: string;
  // Income page ids written by a previous (failed) attempt — archived first so a
  // re-sync never doubles the payment in the books.
  priorPageIds?: string[] | null;
  // Set by the reconciler (re-push path). Before writing, confirm the payment
  // isn't ALREADY in Notion — e.g. the admin added it by hand after the first
  // sync failed. Without this check, re-pushing a hand-entered payment doubles it
  // in the books and drops the client's "Money Left" below the truth. The
  // first-time write (recordPaymentAction) leaves this off: a brand-new payment
  // is never already there, and skipping the extra query keeps that path fast.
  verifyExisting?: boolean;
};

// Mirror one payment into Notion and persist the outcome on the payment row.
// Never throws and never blocks the caller: the local receipt is the source of
// truth. A success marks the payment synced; a failure is recorded and left for
// reconcilePendingNotionPayments to retry.
export async function syncPaymentToNotion(input: SyncPaymentInput): Promise<void> {
  if (!(input.amount > 0)) return;
  if (!process.env.NOTION_TOKEN) return; // no Notion configured — nothing to mirror
  const pageId = await clientNotionPageId(input.slug);
  if (!pageId) return; // client isn't linked to Notion — not a pending sync

  // Clean up any rows a previous partial attempt left behind, so retries are
  // idempotent (archive is best-effort and never throws).
  for (const id of input.priorPageIds || []) await notionArchivePage(id);

  const lines = buildIncomeLines(input.amount, input.items, input.label, input.allocation);

  // Re-push path: if the money is already booked in Notion for this client and
  // date (most often a row the admin added by hand when the first sync failed),
  // don't write it again — that's exactly how a payment gets duplicated and the
  // client's "Money Left" reads low. Adopt the existing rows and mark synced.
  if (input.verifyExisting) {
    const expected = lines.reduce((s, l) => s + l.amount, 0);
    const existing = await incomeAlreadyRecorded({
      clientPageId: pageId,
      payDate: input.paidOn || new Date().toISOString().slice(0, 10),
      currency: input.currency,
      expected,
      ignorePageIds: input.priorPageIds || [],
    });
    if (existing.present) {
      await markPaymentSynced(input.payId, existing.pageIds);
      return;
    }
  }

  try {
    const created = await createIncomePaymentLines({
      clientPageId: pageId,
      lines,
      currency: input.currency,
      payDate: input.paidOn || undefined,
      dueDate: input.dueDate || undefined,
      ref: input.ref || undefined,
    });
    await markPaymentSynced(input.payId, created);
  } catch (e) {
    const created = e instanceof NotionSyncError ? e.created : [];
    await markPaymentSyncFailed(input.payId, created, (e as Error)?.message || String(e));
  }
}

// One-time cleanup of the duplicate Income rows the first version of the
// reconciler created. That version treated every pre-existing payment as
// "never synced" and re-pushed it, even though it had already been mirrored
// (untracked) under the old code — so any payment whose TRACKED rows were
// written markedly later than the payment was recorded is a duplicate. We
// archive those rows (recoverable from Notion's trash) and baseline the
// payment so nothing touches it again. Guarded by a flag so it runs once.
export async function cleanupReconcilerDuplicates(): Promise<number> {
  if (!isDbEnabled() || !process.env.NOTION_TOKEN) return 0;
  const sql = getSql();
  let archived = 0;
  try {
    await ensurePaymentsTable(); // also creates app_flags + baselines the backlog
    const claimed = (await sql`
      INSERT INTO app_flags (key, value) VALUES ('payments-notion-dedupe-v1', 'running')
      ON CONFLICT (key) DO NOTHING RETURNING key
    `) as unknown as unknown[];
    if (!claimed.length) return 0; // already done (or running elsewhere)

    const dupes = (await sql`
      SELECT id, notion_page_ids FROM invoice_payments
      WHERE notion_page_ids IS NOT NULL
        AND notion_synced_at IS NOT NULL
        AND notion_synced_at > created_at + INTERVAL '10 minutes'
    `) as unknown as { id: number; notion_page_ids: string[] | null }[];

    for (const row of dupes) {
      for (const pid of row.notion_page_ids || []) {
        await notionArchivePage(pid); // best-effort; no-op if already deleted
        archived++;
      }
      // Baseline the payment back to "originally synced" so it's left alone.
      await sql`
        UPDATE invoice_payments
        SET notion_page_ids = NULL, notion_synced_at = created_at, notion_error = NULL
        WHERE id = ${row.id}
      `;
    }
    await sql`UPDATE app_flags SET value = ${"done:" + archived} WHERE key = 'payments-notion-dedupe-v1'`;
  } catch {
    // Don't get stuck half-done — let it retry on the next load.
    try {
      await sql`DELETE FROM app_flags WHERE key = 'payments-notion-dedupe-v1' AND value = 'running'`;
    } catch {
      /* ignore */
    }
  }
  return archived;
}

// Re-push every payment that should be in Notion but isn't yet (failed write,
// recorded while Notion was down, or recorded before the client was linked).
// Bounded per run and safe to call on a hot path — in steady state it's a single
// cheap SELECT that returns nothing. Returns how many payments it processed.
export async function reconcilePendingNotionPayments(limit = 20): Promise<number> {
  if (!isDbEnabled() || !process.env.NOTION_TOKEN) return 0;
  let processed = 0;
  try {
    const pending = await listUnsyncedPayments(limit);
    for (const p of pending) {
      const inv = await getInvoice(p.invoice_id);
      await syncPaymentToNotion({
        payId: p.id,
        slug: p.client_slug,
        amount: Number(p.amount) || 0,
        items: inv?.items || [],
        label: inv ? `${inv.number} payment` : (p.number || "Payment"),
        currency: (p.currency as "ILS" | "USD") || "ILS",
        dueDate: inv?.due_date || null,
        allocation: p.allocation,
        paidOn: typeof p.paid_on === "string" ? p.paid_on.slice(0, 10) : undefined,
        ref: p.number || undefined,
        priorPageIds: p.notion_page_ids,
        // This is the re-push path — check Notion for a hand-entered (or
        // otherwise untracked) copy before writing, so we never double a payment.
        verifyExisting: true,
      });
      processed++;
    }
  } catch {
    /* best-effort — the reconciler runs again on the next admin load */
  }
  return processed;
}
