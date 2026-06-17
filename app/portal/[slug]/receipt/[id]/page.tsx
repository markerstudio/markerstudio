import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClient } from "@/lib/clients";
import { getInvoice, invoiceGrandTotal, invoiceRemaining } from "@/lib/invoices";
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
  const isAdmin = s.role !== "client";

  return (
    <main className="min-h-screen bg-[#F5F2EC] px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="print:hidden mb-6 flex items-center justify-between gap-3">
          <a href={isAdmin ? searchParams.back || "/admin/invoices" : `/portal/${client.slug}/invoices`} className="text-sm font-medium text-neutral-600 hover:text-neutral-900">← Back</a>
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
              <div className="text-2xl font-bold tracking-tight text-neutral-900">Receipt</div>
              <div className="mt-1 font-mono text-sm text-neutral-600">{pay.number}</div>
              <span className="mt-2 inline-block rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold uppercase text-green-800">Paid</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 px-6 py-5 text-sm sm:px-9">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Received from</div>
              <div className="mt-1 font-semibold text-neutral-900">{client.name}</div>
            </div>
            <div className="text-right">
              <div><span className="text-neutral-400">Date:</span> <span className="text-neutral-800">{date(pay.paid_on)}</span></div>
              {inv && <div><span className="text-neutral-400">For invoice:</span> <span className="font-mono text-neutral-800">{inv.number}</span></div>}
              {pay.method && <div><span className="text-neutral-400">Method:</span> <span className="text-neutral-800">{METHOD_LABEL[pay.method] || pay.method}</span></div>}
            </div>
          </div>

          <div className="px-6 pb-2 sm:px-9">
            <div className="rounded-xl bg-[#F5F2EC] px-5 py-5 text-center">
              <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Amount received</div>
              <div className="mt-1 text-4xl font-extrabold tabular-nums text-neutral-900">{money(Number(pay.amount) || 0, pay.currency)}</div>
            </div>

            {inv && (
              <div className="ml-auto mt-4 w-full max-w-xs space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Invoice total</span>
                  <span className="tabular-nums text-neutral-800">{money(grand, pay.currency)}</span>
                </div>
                <div className="flex justify-between border-t border-neutral-200 pt-1.5 font-semibold text-orange-deep">
                  <span>Remaining on invoice</span>
                  <span className="tabular-nums">{money(remaining, pay.currency)}</span>
                </div>
              </div>
            )}
          </div>

          {pay.note && <p className="px-6 pb-2 text-sm text-neutral-500 sm:px-9">{pay.note}</p>}

          <p className="border-t border-neutral-100 px-6 py-5 text-center text-xs text-neutral-400 sm:px-9">
            Thank you for your payment. Marker Studio® · create@marker.ps · www.marker.ps · +970 568 08 14 08
          </p>
        </div>
      </div>
    </main>
  );
}
