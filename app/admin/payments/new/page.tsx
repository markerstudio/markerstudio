import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isDbEnabled } from "@/lib/db";
import { getClients } from "@/lib/clients";
import { listInvoices, ensureInvoicesTable, invoiceRemaining, invoiceCurrency } from "@/lib/invoices";
import FinanceTabs from "@/components/admin/FinanceTabs";
import RecordPaymentForm, { type OpenInvoice } from "@/components/admin/RecordPaymentForm";

export const dynamic = "force-dynamic";

export default async function NewPaymentPage() {
  if (!(await getSession())) redirect("/login");

  let open: OpenInvoice[] = [];
  if (isDbEnabled()) {
    try {
      await ensureInvoicesTable();
      const [invoices, clients] = await Promise.all([listInvoices(), getClients()]);
      const nameBySlug = new Map(clients.map((c) => [c.slug, c.name || c.slug]));
      open = invoices
        .filter((i) => !i.archived_at && (i.status === "due" || i.status === "partial"))
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
    <div>
      <FinanceTabs />
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Record a payment</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Pick any open invoice, choose how the payment splits across its lines, and a receipt is created.</p>
        </div>
        <Link href="/admin/invoices" className="text-sm font-medium text-neutral-500 hover:text-orange">← Invoices</Link>
      </div>
      <div className="max-w-2xl">
        <RecordPaymentForm invoices={open} />
      </div>
    </div>
  );
}
