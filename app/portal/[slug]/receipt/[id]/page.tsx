import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClient } from "@/lib/clients";
import { getInvoice, invoiceGrandTotal, invoiceRemaining, invoiceCurrency } from "@/lib/invoices";
import { getPayment } from "@/lib/payments";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Receipt · Marker Studio", robots: { index: false, follow: false } };

const METHOD_LABEL: Record<string, string> = { cash: "Cash", bank: "Bank transfer", card: "Card", other: "Other" };

function money(n: number, currency: "ILS" | "USD") {
  const v = n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return currency === "USD" ? `$${v}` : `${v} ILS`;
}
function date(d: string | null) {
  return d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}

export default async function ReceiptPage({
  params,
  searchParams,
}: {
  params: { slug: string; id: string };
  searchParams: { back?: string };
}) {
  const s = await getSession();
  if (!s) redirect("/login");

  const client = await getClient(params.slug);
  if (!client) notFound();
  if (s.role === "client" && s.clientId !== client.id) redirect("/portal");

  const pay = await getPayment(Number(params.id));
  if (!pay || pay.client_slug !== client.slug) notFound();

  const inv = await getInvoice(pay.invoice_id);
  const rate = inv ? Number(inv.vat_rate) || 0 : 0;
  const grand = inv ? invoiceGrandTotal(inv.items, rate) : 0;
  const remaining = inv ? invoiceRemaining(inv.items, rate, Number(inv.paid_amount) || 0) : 0;
  // Invoice figures render in the INVOICE's currency — a $400 payment against
  // a shekel invoice must not dress the invoice's totals in dollar signs.
  const invCurrency = inv ? invoiceCurrency(inv.items) : pay.currency;
  const isAdmin = s.role !== "client";

  return (
    <main className="lq-app min-h-screen px-4 py-8">
      <div className="mx-auto max-w-3xl lq-rise">
        <div className="print:hidden mb-6 flex items-center justify-between gap-3">
          <a href={isAdmin ? searchParams.back || "/admin/invoices" : `/portal/${client.slug}/invoices`} className="lq-btn lq-btn--glass lq-btn--sm no-underline">← Back</a>
          <PrintButton label="Download PDF" />
        </div>

        {/* Glass sheet on screen; the print rules flatten .rounded-2xl cards to a clean page. */}
        <div className="lq-card rounded-2xl overflow-hidden">
          <div className="flex items-start justify-between gap-4 border-b border-charcoal/5 px-6 py-7 sm:px-9">
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/logo-primary-transparent.png" alt="Marker Studio" className="h-9 w-auto" />
              <p className="mt-3 text-xs leading-5 text-charcoal-60">Marker Studio®<br />Beit Sahour · Palestine<br />create@marker.ps · +970 568 08 14 08</p>
            </div>
            <div className="text-right">
              <div className="font-display font-extrabold text-[26px] tracking-tight text-ink">Receipt</div>
              <div className="mt-1 font-mono text-sm text-charcoal-60">{pay.number}</div>
              <span className="lq-chip lq-chip--green mt-2 uppercase !text-[10px]">Paid</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 px-6 py-5 text-sm sm:px-9">
            <div>
              <div className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-charcoal-40">Received from</div>
              <div className="mt-1 font-semibold text-ink">{client.name}</div>
            </div>
            <div className="text-right">
              <div><span className="text-charcoal-40">Date:</span> <span className="text-charcoal-80">{date(pay.paid_on)}</span></div>
              {inv && <div><span className="text-charcoal-40">For invoice:</span> <span className="font-mono text-charcoal-80">{inv.number}</span></div>}
              {pay.method && <div><span className="text-charcoal-40">Method:</span> <span className="text-charcoal-80">{METHOD_LABEL[pay.method] || pay.method}</span></div>}
            </div>
          </div>

          <div className="px-6 pb-2 sm:px-9">
            <div className="lq-well px-5 py-6 text-center">
              <div className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-charcoal-60">Amount received</div>
              <div className="mt-1.5 font-display font-extrabold text-4xl tracking-tight tabular-nums text-ink">{money(Number(pay.amount) || 0, pay.currency)}</div>
            </div>

            {inv && (
              <div className="ml-auto mt-4 w-full max-w-xs space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-charcoal-60">Invoice total</span>
                  <span className="tabular-nums text-charcoal-80">{money(grand, invCurrency)}</span>
                </div>
                <div className="flex justify-between border-t border-charcoal/10 pt-1.5 font-display font-bold text-orange-deep">
                  <span className="tracking-tight">Remaining on invoice</span>
                  <span className="tabular-nums">{money(remaining, invCurrency)}</span>
                </div>
              </div>
            )}
          </div>

          {pay.note && <p className="px-6 pb-2 text-sm text-charcoal-60 sm:px-9">{pay.note}</p>}

          <p className="border-t border-charcoal/5 px-6 py-5 text-center text-xs text-charcoal-40 sm:px-9">
            Thank you for your payment. Marker Studio® · create@marker.ps · www.marker.ps · +970 568 08 14 08
          </p>
        </div>
      </div>
    </main>
  );
}
