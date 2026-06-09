import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClient } from "@/lib/clients";
import { getInvoice, invoiceTotal, invoiceVat, invoiceGrandTotal, invoiceRemaining } from "@/lib/invoices";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invoice · Marker Studio", robots: { index: false, follow: false } };

function fmt(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
function date(d: string | null) {
  return d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}

export default async function InvoicePage({ params }: { params: { slug: string; id: string } }) {
  const s = await getSession();
  if (!s) redirect("/login");

  const client = await getClient(params.slug);
  if (!client) notFound();
  if (s.role === "client" && s.clientId !== client.id) redirect("/portal");

  const inv = await getInvoice(Number(params.id));
  if (!inv || inv.client_id !== client.id) notFound();

  const subtotal = invoiceTotal(inv.items);
  const rate = Number(inv.vat_rate) || 0;
  const vat = invoiceVat(inv.items, rate);
  const grand = invoiceGrandTotal(inv.items, rate);
  const paid = Number(inv.paid_amount) || 0;
  const remaining = invoiceRemaining(inv.items, rate, paid);
  const statusTone = inv.status === "paid" ? "bg-green-100 text-green-800" : inv.status === "partial" ? "bg-amber-100 text-amber-800" : inv.status === "due" ? "bg-orange-100 text-orange-deep" : "bg-neutral-100 text-neutral-600";

  return (
    <main className="min-h-screen bg-[#F5F2EC] px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="print:hidden mb-6 flex items-center justify-between gap-3">
          <a href={`/portal/${client.slug}/invoices`} className="text-sm font-medium text-neutral-600 hover:text-neutral-900">← Invoices</a>
          <PrintButton label="Download PDF" />
        </div>

        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="flex items-start justify-between gap-4 border-b border-neutral-100 px-6 py-7 sm:px-9">
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/logo-primary-transparent.png" alt="Marker Studio" className="h-9 w-auto" />
              <p className="mt-3 text-xs leading-5 text-neutral-500">Marker Studio®<br />Beit Sahour · Palestine<br />create@marker.ps · +970 568 08 14 08</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold tracking-tight text-neutral-900">Invoice</div>
              <div className="mt-1 font-mono text-sm text-neutral-600">{inv.number}</div>
              <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${statusTone}`}>{inv.status}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 px-6 py-5 text-sm sm:px-9">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Bill to</div>
              <div className="mt-1 font-semibold text-neutral-900">{client.name}</div>
            </div>
            <div className="text-right">
              <div><span className="text-neutral-400">Issued:</span> <span className="text-neutral-800">{date(inv.issued_date)}</span></div>
              {inv.due_date && <div><span className="text-neutral-400">Due:</span> <span className="text-neutral-800">{date(inv.due_date)}</span></div>}
            </div>
          </div>

          <div className="px-6 pb-2 sm:px-9">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  <th className="py-2">Description</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {inv.items.map((it, i) => (
                  <tr key={i} className="border-b border-neutral-100">
                    <td className="py-2.5 text-neutral-800">{it.label}</td>
                    <td className="py-2.5 text-right tabular-nums text-neutral-900">{it.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="ml-auto mt-4 w-full max-w-xs space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-500">Subtotal (excl. VAT)</span>
                <span className="tabular-nums text-neutral-800">{fmt(subtotal)}</span>
              </div>
              {rate > 0 && (
                <div className="flex justify-between">
                  <span className="text-neutral-500">VAT ({rate}%)</span>
                  <span className="tabular-nums text-neutral-800">{fmt(vat)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-neutral-200 pt-1.5 text-base font-bold text-neutral-900">
                <span>Total {rate > 0 ? "(incl. VAT)" : "(excl. VAT)"}</span>
                <span className="tabular-nums">{fmt(grand)}</span>
              </div>
              {paid > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Paid{inv.status === "paid" ? "" : " (deposit)"}</span>
                    <span className="tabular-nums text-green-700">−{fmt(paid)}</span>
                  </div>
                  <div className="flex justify-between border-t border-neutral-200 pt-1.5 text-base font-bold text-orange-deep">
                    <span>Money left</span>
                    <span className="tabular-nums">{fmt(remaining)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {inv.note && <p className="px-6 pb-2 text-sm text-neutral-500 sm:px-9">{inv.note}</p>}

          <p className="border-t border-neutral-100 px-6 py-5 text-center text-xs text-neutral-400 sm:px-9">
            Thank you. Marker Studio® · create@marker.ps · www.marker.ps · +970 568 08 14 08
          </p>
        </div>
      </div>
    </main>
  );
}
