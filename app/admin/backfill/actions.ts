"use server";

// Apply the one-off 2026 stories backfill. Super-admin only. Idempotent: it
// re-checks existing stories payments per client and skips any cycle already
// recorded (same client + month + amount), so running it twice is safe and it
// won't duplicate the ones you registered earlier.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { getSql, isDbEnabled } from "@/lib/db";
import { blankClientData, slugify, type ClientData } from "@/lib/clients";
import { createInvoice, setInvoicePaid } from "@/lib/invoices";
import { recordInvoicePayment, listClientPayments, ramziAmountOf } from "@/lib/payments";
import { STORIES_BACKFILL_2026, ymKey, dedupKey, monthLabel } from "./plan";

type ClientRow = { id: number; slug: string; name: string; data: ClientData };

// Find an existing client by pinned slug or case-insensitive name; create a
// minimal stories client (no Notion) when missing so the payment has a home.
async function resolveClient(name: string, slug: string | undefined, fee: number): Promise<ClientRow> {
  const sql = getSql();
  if (slug) {
    const r = (await sql`SELECT id, slug, name, data FROM clients WHERE slug = ${slug} LIMIT 1`) as unknown as ClientRow[];
    if (r[0]) return r[0];
  }
  const byName = (await sql`SELECT id, slug, name, data FROM clients WHERE lower(name) = ${name.toLowerCase()} LIMIT 1`) as unknown as ClientRow[];
  if (byName[0]) return byName[0];

  // Create a minimal client. Ensure a unique slug.
  let s = slug || slugify(name);
  for (let i = 2; ; i++) {
    const exists = (await sql`SELECT 1 FROM clients WHERE slug = ${s} LIMIT 1`) as unknown as unknown[];
    if (exists.length === 0) break;
    s = `${slug || slugify(name)}-${i}`;
  }
  const data = blankClientData();
  data.finance.storiesActive = true;
  data.finance.storiesFee = `${fee} ILS`;
  const ins = (await sql`
    INSERT INTO clients (slug, name, color, data) VALUES (${s}, ${name}, '#303030', ${JSON.stringify(data)}::jsonb)
    RETURNING id, slug, name, data
  `) as unknown as ClientRow[];
  return ins[0];
}

// Turn on stories (and set the fee) on an existing client without disturbing the
// rest of its finance block.
async function ensureStoriesActive(row: ClientRow, fee: number) {
  const d = (row.data || {}) as ClientData;
  const f = d.finance || { monthlyFee: "", progress: 0 };
  if (f.storiesActive && f.storiesFee) return;
  d.finance = { ...f, monthlyFee: f.monthlyFee ?? "", progress: f.progress ?? 0, storiesActive: true, storiesFee: f.storiesFee || `${fee} ILS` };
  await getSql()`UPDATE clients SET data = ${JSON.stringify(d)}::jsonb, updated_at = now() WHERE id = ${row.id}`;
}

export async function runStoriesBackfillAction() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (!isSuperAdmin(user) || !isDbEnabled()) redirect("/admin");

  let created = 0;
  let skipped = 0;
  for (const entry of STORIES_BACKFILL_2026) {
    const client = await resolveClient(entry.name, entry.slug, entry.fee);
    await ensureStoriesActive(client, entry.fee);

    // Existing stories payments for this client → dedup set (month + amount).
    const existing = await listClientPayments(client.slug);
    const seen = new Set<string>();
    for (const p of existing) {
      const r = ramziAmountOf(p);
      if (r > 0) seen.add(dedupKey(ymKey(p.paid_on), r));
    }

    for (const date of entry.dates) {
      const key = dedupKey(ymKey(date), entry.fee);
      if (seen.has(key)) {
        skipped++;
        continue;
      }
      // Paid stories invoice (one line, Ramzi-owned) + its receipt. No Notion sync.
      const { id: invoiceId } = await createInvoice({
        clientId: client.id,
        clientSlug: client.slug,
        items: [{ label: `Stories — ${monthLabel(date)}`, amount: `${entry.fee} ILS`, kind: "stories", owner: "ramzi" }],
        issuedDate: date,
        dueDate: date,
        source: "custom",
        paidAmount: entry.fee,
      });
      await recordInvoicePayment({
        invoiceId,
        clientSlug: client.slug,
        amount: entry.fee,
        currency: "ILS",
        paidOn: date,
        method: "cash",
        note: "Stories backfill 2026",
        allocation: [{ label: "Stories", kind: "stories", owner: "ramzi", amount: entry.fee }],
      });
      await setInvoicePaid(invoiceId, entry.fee);
      seen.add(key); // guard against duplicate dates within the same run
      created++;
    }
  }

  revalidatePath("/admin/partner");
  revalidatePath("/admin/backfill");
  redirect(`/admin/backfill?created=${created}&skipped=${skipped}`);
}
