import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, isPartnerOnly } from "@/lib/auth";
import { isDbEnabled } from "@/lib/db";
import { getClients } from "@/lib/clients";
import { listInvoices, ensureInvoicesTable, invoiceRemaining, invoiceCurrency, type InvoiceItem } from "@/lib/invoices";
import { listPaymentsForInvoices, type AppliedPayment } from "@/lib/payments";
import FinanceTabs from "@/components/admin/FinanceTabs";
import RecordPaymentForm, { type OpenInvoice } from "@/components/admin/RecordPaymentForm";

export const dynamic = "force-dynamic";

function toNum(s: unknown): number {
  const n = parseFloat(String(s ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

// What's still owed on EACH line (VAT-inclusive), after every earlier payment.
// Prior payments carry per-line allocations; they're pooled by line identity
// (label+kind+owner) and consumed in line order, so duplicate labels behave.
// Payments recorded before allocations existed leave a slack, spread
// proportionally over what the allocations didn't cover — the lefts always
// sum to the invoice's true remaining.
function perLineLeft(items: InvoiceItem[], vatRate: number, pays: AppliedPayment[]): number[] {
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

export default async function NewPaymentPage({ searchParams }: { searchParams: { invoice?: string } }) {
  const user = await getSession();
  if (!user) redirect("/login");
  const partnerOnly = isPartnerOnly(user);
  const presetId = Number(searchParams.invoice);
  const initialId = Number.isFinite(presetId) && presetId > 0 ? presetId : undefined;

  let open: OpenInvoice[] = [];
  if (isDbEnabled()) {
    try {
      await ensureInvoicesTable();
      const [invoices, clients] = await Promise.all([listInvoices(), getClients()]);
      const nameBySlug = new Map(clients.map((c) => [c.slug, c.name || c.slug]));
      // Ramzi may only record against his own clients' invoices.
      const ramziSlugs = new Set(clients.filter((c) => c.data?.owner === "ramzi").map((c) => c.slug));
      const candidates = invoices
        .filter((i) => !i.archived_at && (i.status === "due" || i.status === "partial"))
        .filter((i) => !partnerOnly || ramziSlugs.has(i.client_slug));
      // Every open invoice's payments in one query — per-line "left" derives
      // from the recorded allocations.
      const pays = await listPaymentsForInvoices(candidates.map((i) => i.id));
      const paysByInvoice = new Map<number, AppliedPayment[]>();
      for (const p of pays) {
        if (!paysByInvoice.has(p.invoice_id)) paysByInvoice.set(p.invoice_id, []);
        paysByInvoice.get(p.invoice_id)!.push(p);
      }
      open = candidates
        .map((i) => {
          const vat = Number(i.vat_rate) || 0;
          const left = perLineLeft(i.items || [], vat, paysByInvoice.get(i.id) || []);
          return {
            id: i.id,
            number: i.number,
            clientSlug: i.client_slug,
            clientName: nameBySlug.get(i.client_slug) || i.client_slug,
            currency: invoiceCurrency(i.items),
            remaining: invoiceRemaining(i.items, vat, Number(i.paid_amount) || 0),
            lines: (i.items || []).map((it, idx) => ({
              label: it.label,
              amount: it.amount,
              kind: it.kind,
              owner: it.owner,
              left: left[idx] ?? 0,
            })),
          };
        })
        .filter((i) => i.remaining > 0);
    } catch {
      open = [];
    }
  }

  return (
    <div className="space-y-5">
      {!partnerOnly && <FinanceTabs />}
      <header className="lq-rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-display font-bold uppercase tracking-[0.14em] text-charcoal-60">Billing</p>
          <h1 className="font-display font-extrabold text-[28px] tracking-tight text-ink leading-tight mt-1">Record a payment</h1>
          <p className="text-sm text-charcoal-60 mt-1">Pick any open invoice, choose how the payment splits across its lines, and a receipt is created.</p>
        </div>
        <Link href={partnerOnly ? "/admin/partner" : "/admin/invoices"} className="lq-btn lq-btn--glass lq-btn--sm no-underline">
          {partnerOnly ? "← Back" : "← Invoices"}
        </Link>
      </header>
      <div className="max-w-2xl">
        <RecordPaymentForm invoices={open} initialId={initialId} />
      </div>
    </div>
  );
}
