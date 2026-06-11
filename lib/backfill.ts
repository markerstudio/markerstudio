// One-time backfill — turns every client's payment history (the portal's
// cycle/amount/status rows, synced from Notion) into real, backdated invoices.
// Runs automatically on the first /admin visit after deploy, claims a flag row
// first so it can never run twice (or concurrently), and dedupes per client by
// line label as a second guard. Paid entries are created paid in full on their
// real pay date; open ones keep their due date.
import { getSql, isDbEnabled } from "@/lib/db";
import { createInvoice, listClientInvoices } from "@/lib/invoices";
import type { ClientData } from "@/lib/clients";

const FLAG = "payment-history-invoiced-v1";

export async function runPaymentHistoryBackfill(): Promise<void> {
  if (!isDbEnabled()) return;
  const sql = getSql();
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS app_flags (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    // Fast path: already done (one cheap SELECT on every admin load).
    const done = (await sql`SELECT 1 FROM app_flags WHERE key = ${FLAG} LIMIT 1`) as unknown as unknown[];
    if (done.length) return;
    // Claim the flag before working so two concurrent loads can't both run.
    const claimed = (await sql`
      INSERT INTO app_flags (key, value) VALUES (${FLAG}, 'running')
      ON CONFLICT (key) DO NOTHING RETURNING key
    `) as unknown as unknown[];
    if (claimed.length === 0) return;

    const clients = (await sql`SELECT id, slug, data FROM clients ORDER BY id ASC`) as unknown as {
      id: number;
      slug: string;
      data: ClientData;
    }[];

    let created = 0;
    for (const c of clients) {
      const history = (c.data?.invoices || []).filter((h) => h.cycle || h.desc || h.amount);
      if (!history.length) continue;

      let existing: { items: { label: string }[] }[] = [];
      try {
        existing = await listClientInvoices(c.id);
      } catch {
        existing = [];
      }
      const have = new Set(existing.map((inv) => (inv.items?.[0]?.label || "").trim().toLowerCase()).filter(Boolean));

      for (const h of history) {
        const label = [h.cycle, h.desc].filter(Boolean).join(" — ").trim() || "Payment";
        if (have.has(label.toLowerCase())) continue;
        const amountNum = parseFloat((h.amount || "").replace(/[^0-9.]/g, "")) || 0;
        const paid = h.status === "paid" ? amountNum : 0;
        // Notion-synced entries carry their real dates in the text
        // ("Due 2026-03-01 · Paid 2026-03-14") — backdate the invoice to them.
        const text = `${h.cycle || ""} ${h.desc || ""}`;
        const payDate = text.match(/Paid\s+(\d{4}-\d{2}-\d{2})/i)?.[1];
        const dueParsed = text.match(/Due\s+(\d{4}-\d{2}-\d{2})/i)?.[1];
        await createInvoice({
          clientId: c.id,
          clientSlug: c.slug,
          items: [{ label, amount: h.amount || "" }],
          source: payDate || dueParsed ? "notion" : "custom",
          paidAmount: paid,
          status: h.status === "paid" ? "paid" : "due",
          issuedDate: payDate || dueParsed || undefined,
          dueDate:
            dueParsed ||
            (h.status === "overdue" ? new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10) : undefined),
        });
        have.add(label.toLowerCase());
        created++;
      }
    }

    await sql`UPDATE app_flags SET value = ${"done:" + created} WHERE key = ${FLAG}`;
    console.log(`[backfill] payment history → ${created} invoices created across ${clients.length} clients`);
  } catch (e) {
    console.error("[backfill] payment history → invoices failed:", e);
    // Release a half-finished claim so the next admin visit retries; the
    // per-client label dedupe makes the retry safe.
    try {
      await sql`DELETE FROM app_flags WHERE key = ${FLAG} AND value = 'running'`;
    } catch {
      /* leave it */
    }
  }
}
