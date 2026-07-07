import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, isPartnerOnly } from "@/lib/auth";
import { isDbEnabled } from "@/lib/db";
import { getClients } from "@/lib/clients";
import { listInvoices, ensureInvoicesTable, invoiceRemaining, invoiceCurrency } from "@/lib/invoices";
import FinanceTabs from "@/components/admin/FinanceTabs";
import RecordPaymentForm, { type OpenInvoice } from "@/components/admin/RecordPaymentForm";

export const dynamic = "force-dynamic";

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
      open = invoices
        .filter((i) => !i.archived_at && (i.status === "due" || i.status === "partial"))
        .filter((i) => !partnerOnly || ramziSlugs.has(i.client_slug))
        .map((i) => {
          const vat = Number(i.vat_rate) || 0;
          return {
            id: i.id,
            number: i.number,
            clientSlug: i.client_slug,
            clientName: nameBySlug.get(i.client_slug) || i.client_slug,
            currency: invoiceCurrency(i.items),
            remaining: invoiceRemaining(i.items, vat, Number(i.paid_amount) || 0),
            lines: (i.items || []).map((it) => ({ label: it.label, amount: it.amount, kind: it.kind, owner: it.owner })),
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
