import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getClient } from "@/lib/clients";
import { listClientInvoices, invoiceGrandTotal } from "@/lib/invoices";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invoices · Marker Studio", robots: { index: false, follow: false } };

export default async function InvoicesListPage({ params }: { params: { slug: string } }) {
  const s = await getSession();
  if (!s) redirect("/login");

  const client = await getClient(params.slug);
  if (!client) notFound();
  if (s.role === "client" && s.clientId !== client.id) redirect("/portal");

  let invoices: Awaited<ReturnType<typeof listClientInvoices>> = [];
  try {
    invoices = await listClientInvoices(client.id);
  } catch {
    invoices = [];
  }
  const ar = client.data.onboarding?.lang === "ar";

  return (
    <main dir={ar ? "rtl" : "ltr"} className="min-h-screen bg-[#F5F2EC] px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <a href={`/portal/${client.slug}`} aria-label="Portal">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/logo-primary-transparent.png" alt="Marker Studio" className="h-9 w-auto" />
          </a>
          <a href={`/portal/${client.slug}`} className="text-sm font-medium text-neutral-600 hover:text-neutral-900">{ar ? "→ البوابة" : "← Portal"}</a>
        </div>

        <h1 className="mb-4 text-2xl font-bold tracking-tight text-neutral-900">{ar ? "الفواتير" : "Invoices"}</h1>

        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm divide-y divide-neutral-100">
          {invoices.map((inv) => {
            const rate = Number(inv.vat_rate) || 0;
            const total = invoiceGrandTotal(inv.items, rate);
            const tone = inv.status === "paid" ? "bg-green-100 text-green-800" : inv.status === "partial" ? "bg-amber-100 text-amber-800" : inv.status === "due" ? "bg-orange-100 text-orange-deep" : "bg-neutral-100 text-neutral-600";
            return (
              <Link key={inv.id} href={`/portal/${client.slug}/invoice/${inv.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-neutral-50">
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm font-semibold text-neutral-900">{inv.number}</div>
                  <div className="text-xs text-neutral-500">{new Date(inv.issued_date).toLocaleDateString("en-GB")}</div>
                </div>
                <span className="tabular-nums font-semibold text-neutral-900">{total.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${tone}`}>{inv.status}</span>
              </Link>
            );
          })}
          {invoices.length === 0 && (
            <div className="px-5 py-12 text-center text-sm text-neutral-500">{ar ? "لا توجد فواتير بعد." : "No invoices yet."}</div>
          )}
        </div>
      </div>
    </main>
  );
}
