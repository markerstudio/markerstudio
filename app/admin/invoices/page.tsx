import Link from "next/link";
import { isDbEnabled } from "@/lib/db";
import { listInvoices, ensureInvoicesTable, invoiceGrandTotal, type Invoice } from "@/lib/invoices";

export const dynamic = "force-dynamic";

export default async function InvoicesAdmin() {
  const dbOff = !isDbEnabled();
  let invoices: Invoice[] = [];
  let failed = false;
  if (!dbOff) {
    try {
      await ensureInvoicesTable();
      invoices = await listInvoices();
    } catch {
      failed = true;
    }
  }

  const tone = (s: string) =>
    s === "paid" ? "bg-green-100 text-green-800" : s === "sent" ? "bg-orange-100 text-orange-deep" : "bg-neutral-100 text-neutral-600";

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-6">Invoices</h1>

      {dbOff && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-4 py-3 mb-6">No database configured.</p>}
      {failed && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-4 py-3 mb-6">Database connected, but not initialised yet.</p>}

      <div className="bg-white border border-neutral-200 rounded-xl divide-y divide-neutral-100">
        {invoices.map((inv) => {
          const total = invoiceGrandTotal(inv.items, Number(inv.vat_rate) || 0);
          return (
            <div key={inv.id} className="flex items-center gap-4 px-4 py-3 flex-wrap">
              <div className="flex-1 min-w-[160px]">
                <div className="font-mono text-sm font-semibold text-neutral-900">{inv.number}</div>
                <div className="text-xs text-neutral-500">
                  <Link href={`/admin/clients/${inv.client_slug}/edit`} className="hover:text-orange">/{inv.client_slug}</Link>
                  {" · "}{new Date(inv.issued_date).toLocaleDateString("en-GB")}
                  {Number(inv.vat_rate) > 0 ? ` · +${inv.vat_rate}% VAT` : ""}
                  {inv.source === "notion" ? " · from Notion" : ""}
                </div>
              </div>
              <span className="tabular-nums font-semibold text-neutral-900">{total.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${tone(inv.status)}`}>{inv.status}</span>
              <Link href={`/portal/${inv.client_slug}/invoice/${inv.id}`} target="_blank" className="text-sm font-medium text-neutral-600 hover:text-orange">PDF ↗</Link>
            </div>
          );
        })}
        {!dbOff && !failed && invoices.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-neutral-500">No invoices yet — create one from a client&apos;s page.</div>
        )}
      </div>
    </div>
  );
}
