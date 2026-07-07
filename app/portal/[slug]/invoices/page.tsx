import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getClient } from "@/lib/clients";
import { listClientInvoices, invoiceGrandTotal } from "@/lib/invoices";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invoices · Marker Studio", robots: { index: false, follow: false } };

const STATUS_CHIP: Record<string, string> = {
  paid: "lq-chip--green",
  partial: "lq-chip--orange",
  due: "lq-chip--orange",
  overdue: "lq-chip--red",
};

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
    <main dir={ar ? "rtl" : "ltr"} className="lq-app min-h-screen px-4 py-8">
      <div className="mx-auto max-w-3xl lq-rise">
        <div className="mb-6 flex items-center justify-between gap-3">
          <a href={`/portal/${client.slug}`} aria-label="Portal">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/logo-primary-transparent.png" alt="Marker Studio" className="h-9 w-auto" />
          </a>
          <a href={`/portal/${client.slug}`} className="lq-btn lq-btn--glass lq-btn--sm no-underline">{ar ? "البوابة →" : "← Portal"}</a>
        </div>

        <p className="text-[11px] font-display font-bold uppercase tracking-[0.14em] text-charcoal-60">{ar ? "ماركر استديو" : "Marker Studio"}</p>
        <h1 className="mb-4 mt-1 font-display font-extrabold text-[28px] tracking-tight text-ink leading-tight">{ar ? "الفواتير" : "Invoices"}</h1>

        <div className="lq-card overflow-hidden divide-y divide-charcoal/5">
          {invoices.map((inv) => {
            const rate = Number(inv.vat_rate) || 0;
            const total = invoiceGrandTotal(inv.items, rate);
            return (
              <Link key={inv.id} href={`/portal/${client.slug}/invoice/${inv.id}`} className="flex items-center gap-4 px-5 py-4 no-underline hover:bg-white/60">
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm font-semibold text-ink">{inv.number}</div>
                  <div className="text-xs text-charcoal-60">{new Date(inv.issued_date).toLocaleDateString("en-GB")}</div>
                </div>
                <span className="tabular-nums font-display font-bold text-ink">{total.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
                <span className={`lq-chip ${STATUS_CHIP[inv.status] || ""} uppercase !text-[10px]`}>{inv.status}</span>
              </Link>
            );
          })}
          {invoices.length === 0 && (
            <div className="px-5 py-12 text-center text-sm text-charcoal-40">{ar ? "لا توجد فواتير بعد." : "No invoices yet."}</div>
          )}
        </div>
      </div>
    </main>
  );
}
