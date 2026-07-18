import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClient } from "@/lib/clients";
import { getInvoice, invoiceTotal, invoiceVat, invoiceGrandTotal, invoiceRemaining } from "@/lib/invoices";
import { listInvoicePayments } from "@/lib/payments";
import { deletePaymentAction } from "@/app/admin/invoice-actions";
import ConfirmButton from "@/components/admin/ConfirmButton";
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
  const payments = await listInvoicePayments(inv.id);
  const isAdmin = s.role !== "client";
  const statusTone =
    inv.status === "paid" ? "lq-chip--green" : inv.status === "partial" ? "lq-chip--orange" : inv.status === "due" ? "lq-chip--orange" : "";

  return (
    <main className="lq-app min-h-screen px-4 py-8">
      <div className="mx-auto max-w-3xl lq-rise">
        <div className="print:hidden mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <a href={`/portal/${client.slug}`} className="lq-btn lq-btn--glass lq-btn--sm no-underline">← Portal</a>
            <a href={`/portal/${client.slug}/invoices`} className="lq-btn lq-btn--glass lq-btn--sm no-underline">Invoices</a>
          </div>
          <PrintButton label="Download PDF" basename={inv.number || `invoice-${inv.id}`} />
        </div>

        {/* The document itself — a glass sheet on screen, a clean white page in print
            (the print rules flatten any .rounded-2xl card inside main). data-doc
            marks it as the capture target for the PDF/image downloads. */}
        <div data-doc className="lq-card rounded-2xl overflow-hidden">
          <div className="flex items-start justify-between gap-4 border-b border-charcoal/5 px-6 py-7 sm:px-9">
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/logo-primary-transparent.png" alt="Marker Studio" className="h-9 w-auto" />
              <p className="mt-3 text-xs leading-5 text-charcoal-60">Marker Studio®<br />Beit Sahour · Palestine<br />create@marker.ps · +970 568 08 14 08</p>
            </div>
            <div className="text-right">
              <div className="font-display font-extrabold text-[26px] tracking-tight text-ink">Invoice</div>
              <div className="mt-1 font-mono text-sm text-charcoal-60">{inv.number}</div>
              <span className={`lq-chip ${statusTone} mt-2 uppercase !text-[10px]`}>{inv.status}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 px-6 py-5 text-sm sm:px-9">
            <div>
              <div className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-charcoal-40">Bill to</div>
              <div className="mt-1 font-semibold text-ink">{client.name}</div>
            </div>
            <div className="text-right">
              <div><span className="text-charcoal-40">Issued:</span> <span className="text-charcoal-80">{date(inv.issued_date)}</span></div>
              {inv.due_date && <div><span className="text-charcoal-40">Due:</span> <span className="text-charcoal-80">{date(inv.due_date)}</span></div>}
            </div>
          </div>

          <div className="px-6 pb-2 sm:px-9">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-charcoal/10 text-left text-[10px] font-display font-bold uppercase tracking-[0.12em] text-charcoal-60">
                  <th className="py-2">Description</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {inv.items.map((it, i) => (
                  <tr key={i} className="border-b border-charcoal/5">
                    <td className="py-2.5 text-charcoal-80">{it.label}</td>
                    <td className="py-2.5 text-right tabular-nums text-ink">{it.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="ml-auto mt-4 w-full max-w-xs space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-charcoal-60">Subtotal (excl. VAT)</span>
                <span className="tabular-nums text-charcoal-80">{fmt(subtotal)}</span>
              </div>
              {rate > 0 && (
                <div className="flex justify-between">
                  <span className="text-charcoal-60">VAT ({rate}%)</span>
                  <span className="tabular-nums text-charcoal-80">{fmt(vat)}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline border-t border-charcoal/10 pt-1.5 font-display font-extrabold text-ink">
                <span className="text-[15px] tracking-tight">Total {rate > 0 ? "(incl. VAT)" : "(excl. VAT)"}</span>
                <span className="tabular-nums text-[19px] tracking-tight">{fmt(grand)}</span>
              </div>
              {paid > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-charcoal-60">Paid{inv.status === "paid" ? "" : " (deposit)"}</span>
                    <span className="tabular-nums text-green-700">−{fmt(paid)}</span>
                  </div>
                  <div className="flex justify-between items-baseline border-t border-charcoal/10 pt-1.5 font-display font-extrabold text-orange-deep">
                    <span className="text-[15px] tracking-tight">Money left</span>
                    <span className="tabular-nums text-[19px] tracking-tight">{fmt(remaining)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {payments.length > 0 && (
            <div className="px-6 pt-4 pb-2 sm:px-9">
              <div className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-charcoal-60 mb-2">Payments &amp; receipts</div>
              <table className="w-full text-sm">
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-charcoal/5">
                      <td className="py-2 text-charcoal-80">{date(p.paid_on)}</td>
                      <td className="py-2 text-charcoal-60">{p.method ? p.method[0].toUpperCase() + p.method.slice(1) : "—"}</td>
                      <td className="py-2 text-right tabular-nums text-ink">{fmt(Number(p.amount) || 0)}{p.currency === "USD" ? " USD" : " ILS"}</td>
                      <td className="py-2 text-right print:hidden">
                        <a href={`/portal/${client.slug}/receipt/${p.id}`} className="font-mono text-xs font-medium text-charcoal-60 hover:text-orange">{p.number} ↗</a>
                      </td>
                      {isAdmin && (
                        <td className="py-2 text-right print:hidden">
                          <form action={deletePaymentAction}>
                            <input type="hidden" name="payId" value={p.id} />
                            <input type="hidden" name="back" value={`/portal/${client.slug}/invoice/${inv.id}`} />
                            <ConfirmButton
                              message={`Void payment ${p.number} (${fmt(Number(p.amount) || 0)})? It rolls back off the invoice. Re-record the correct amount afterwards.`}
                              className="text-xs font-medium text-charcoal-20 hover:text-rose-700"
                            >
                              Void
                            </ConfirmButton>
                          </form>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {inv.note && <p className="px-6 pb-2 text-sm text-charcoal-60 sm:px-9">{inv.note}</p>}

          <p className="border-t border-charcoal/5 px-6 py-5 text-center text-xs text-charcoal-40 sm:px-9">
            Thank you. Marker Studio® · create@marker.ps · www.marker.ps · +970 568 08 14 08
          </p>
        </div>
      </div>
    </main>
  );
}
