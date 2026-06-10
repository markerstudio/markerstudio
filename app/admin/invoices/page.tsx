import Link from "next/link";
import { isDbEnabled } from "@/lib/db";
import { getClients } from "@/lib/clients";
import { listInvoices, ensureInvoicesTable, invoiceGrandTotal, invoiceRemaining, type Invoice } from "@/lib/invoices";
import InvoiceCreateFromTab from "@/components/admin/InvoiceCreateFromTab";
import InvoiceStatusSelect from "@/components/admin/InvoiceStatusSelect";
import ConfirmButton from "@/components/admin/ConfirmButton";
import { setInvoiceArchivedAction, deleteInvoiceAction } from "../invoice-actions";

export const dynamic = "force-dynamic";

const ERR: Record<string, string> = {
  empty: "Add at least one line item.",
  client: "Pick a client or type a name.",
};

export default async function InvoicesAdmin({ searchParams }: { searchParams: { ok?: string; error?: string; archived?: string } }) {
  const dbOff = !isDbEnabled();
  const showArchived = searchParams.archived === "1";
  let invoices: Invoice[] = [];
  let clients: { slug: string; name: string }[] = [];
  let failed = false;
  if (!dbOff) {
    try {
      await ensureInvoicesTable();
      const [inv, cls] = await Promise.all([listInvoices(), getClients()]);
      invoices = inv;
      clients = cls.map((c) => ({ slug: c.slug, name: c.name || c.slug }));
    } catch {
      failed = true;
    }
  }

  const archivedCount = invoices.filter((i) => i.archived_at).length;
  const shown = invoices.filter((i) => (showArchived ? i.archived_at : !i.archived_at));

  return (
    <div>
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
        <div className="flex items-center gap-2 text-sm">
          <Link
            href="/admin/invoices"
            className={`rounded-full px-3 py-1.5 font-semibold ${!showArchived ? "bg-charcoal text-white" : "bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-400"}`}
          >
            Active
          </Link>
          <Link
            href="/admin/invoices?archived=1"
            className={`rounded-full px-3 py-1.5 font-semibold ${showArchived ? "bg-charcoal text-white" : "bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-400"}`}
          >
            Archived <span className="tabular-nums opacity-60">{archivedCount}</span>
          </Link>
        </div>
      </div>

      {searchParams.ok && (
        <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-md px-4 py-2.5 mb-6">
          Invoice <b className="font-mono">{searchParams.ok}</b> created.
        </p>
      )}
      {searchParams.error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-4 py-2.5 mb-6">{ERR[searchParams.error] || "Something went wrong."}</p>
      )}
      {dbOff && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-4 py-3 mb-6">No database configured.</p>}
      {failed && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-4 py-3 mb-6">Database connected, but not initialised yet.</p>}

      {!dbOff && !failed && (
        <details className="bg-white border border-neutral-200 rounded-xl mb-6 group">
          <summary className="cursor-pointer select-none px-4 py-3.5 font-semibold text-sm flex items-center gap-2 text-neutral-800 hover:text-orange transition-colors">
            <span className="inline-flex w-5 h-5 rounded-full bg-orange text-white items-center justify-center text-sm leading-none group-open:rotate-45 transition-transform">+</span>
            New invoice
          </summary>
          <div className="px-4 pb-4 border-t border-neutral-100 pt-4">
            <InvoiceCreateFromTab clients={clients} />
          </div>
        </details>
      )}

      <div className="bg-white border border-neutral-200 rounded-xl divide-y divide-neutral-100">
        {shown.map((inv) => {
          const total = invoiceGrandTotal(inv.items, Number(inv.vat_rate) || 0);
          const remaining = invoiceRemaining(inv.items, Number(inv.vat_rate) || 0, Number(inv.paid_amount) || 0);
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
              <div className="text-right">
                <div className="tabular-nums font-semibold text-neutral-900">{total.toLocaleString("en-US", { maximumFractionDigits: 2 })}</div>
                {inv.status === "partial" && remaining > 0 && (
                  <div className="text-[11px] tabular-nums text-orange-deep">{remaining.toLocaleString("en-US", { maximumFractionDigits: 2 })} left</div>
                )}
              </div>
              <InvoiceStatusSelect id={inv.id} slug={inv.client_slug} status={inv.status} back={`/admin/invoices${showArchived ? "?archived=1" : ""}`} />
              <Link href={`/portal/${inv.client_slug}/invoice/${inv.id}`} target="_blank" className="text-sm font-medium text-neutral-600 hover:text-orange">PDF ↗</Link>
              <form action={setInvoiceArchivedAction}>
                <input type="hidden" name="id" value={inv.id} />
                <input type="hidden" name="archived" value={inv.archived_at ? "" : "1"} />
                <button className="text-sm font-medium text-neutral-500 hover:text-charcoal">{inv.archived_at ? "Restore" : "Archive"}</button>
              </form>
              <form action={deleteInvoiceAction}>
                <input type="hidden" name="id" value={inv.id} />
                <input type="hidden" name="slug" value={inv.client_slug} />
                <input type="hidden" name="back" value={`/admin/invoices${showArchived ? "?archived=1" : ""}`} />
                <ConfirmButton
                  message={`Delete invoice ${inv.number}? This can't be undone — archiving keeps it for your records instead.`}
                  className="text-sm font-medium text-neutral-400 hover:text-red-600"
                >
                  Delete
                </ConfirmButton>
              </form>
            </div>
          );
        })}
        {!dbOff && !failed && shown.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-neutral-500">
            {showArchived ? "No archived invoices." : "No invoices yet — create one above."}
          </div>
        )}
      </div>
    </div>
  );
}
