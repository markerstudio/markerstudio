import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClient } from "@/lib/clients";
import { listClientInvoices, invoiceGrandTotal, amountLabelToIls } from "@/lib/invoices";
import { clientFacingMoney } from "@/lib/clientFinance";
import StatementDocument, { type StatementRow } from "@/components/docs/StatementDocument";

export const dynamic = "force-dynamic";
export const metadata = { title: "Statement · Marker Studio", robots: { index: false, follow: false } };

export default async function StatementPage({ params }: { params: { slug: string } }) {
  const s = await getSession();
  if (!s) redirect("/login");

  const client = await getClient(params.slug);
  if (!client) notFound();
  if (s.role === "client" && s.clientId !== client.id) redirect("/portal");

  const now = new Date();
  const rows: StatementRow[] = [];
  let totalBilled = 0;
  let totalPaid = 0;
  let totalOpen = 0;

  let invoices: Awaited<ReturnType<typeof listClientInvoices>> = [];
  try {
    invoices = await listClientInvoices(client.id);
  } catch {
    invoices = [];
  }

  if (invoices.length > 0) {
    // Real numbered invoices (incl. the backdated history) — the canonical record.
    for (const inv of invoices) {
      if (inv.archived_at || inv.status === "draft") continue;
      const total = invoiceGrandTotal(inv.items, Number(inv.vat_rate) || 0);
      const paid = Number(inv.paid_amount) || 0;
      const open = Math.max(0, total - paid);
      const overdue = (inv.status === "due" || inv.status === "partial") && !!inv.due_date && new Date(inv.due_date) < now;
      totalBilled += total;
      totalPaid += paid;
      totalOpen += open;
      rows.push({
        date: inv.issued_date,
        number: inv.number,
        label: (inv.items || []).map((it) => it.label).filter(Boolean).join(" · ") || "Invoice",
        total,
        paid,
        status: overdue ? "overdue" : inv.status,
        dueDate: inv.due_date || undefined,
      });
    }
    rows.sort((a, b) => (a.date < b.date ? 1 : -1));
  } else {
    // No invoices yet — fall back to the portal's payment-history entries.
    for (const h of client.data.invoices || []) {
      if (!h.cycle && !h.desc && !h.amount) continue;
      const text = `${h.cycle || ""} ${h.desc || ""}`;
      const payDate = text.match(/Paid\s+(\d{4}-\d{2}-\d{2})/i)?.[1];
      const dueDate = text.match(/Due\s+(\d{4}-\d{2}-\d{2})/i)?.[1];
      const amount = amountLabelToIls(h.amount || "");
      const paid = h.status === "paid" ? amount : 0;
      totalBilled += amount;
      totalPaid += paid;
      if (h.status !== "paid") totalOpen += amount;
      rows.push({
        date: payDate || dueDate || "",
        label: h.cycle || h.desc || "Payment",
        total: amount,
        paid,
        status: h.status === "paid" ? "paid" : h.status === "overdue" ? "overdue" : "due",
        dueDate,
        amountLabel: h.amount,
      });
    }
    rows.sort((a, b) => (a.date < b.date ? 1 : -1));
  }

  // Summary totals come from the SAME combined calculation as the portal
  // dashboard (lib/clientFinance) so the two screens never disagree. The rows
  // above remain the itemised history. Fall back to the row totals if the
  // combined read fails.
  let money: Awaited<ReturnType<typeof clientFacingMoney>> | null = null;
  try {
    money = await clientFacingMoney(client);
  } catch {
    money = null;
  }

  const ar = client.data.onboarding?.lang === "ar";
  return (
    <main style={{ background: "#33312e", minHeight: "100vh" }}>
      {/* Way back home — the document is a dead end without it. */}
      <a
        href={`/portal/${client.slug}`}
        dir={ar ? "rtl" : "ltr"}
        className="print:hidden fixed top-4 start-4 z-50 lq-btn lq-btn--glass lq-btn--sm no-underline"
      >
        {ar ? "→ البوابة" : "← Portal"}
      </a>
      <StatementDocument
        clientName={client.name || client.slug}
        clientSlug={client.slug}
        rows={rows}
        summary={{
          totalBilled: money ? money.totalIls : totalBilled,
          totalPaid: money ? money.paidIls : totalPaid,
          totalOpen: money ? money.openIls : totalOpen,
          balance: money ? money.balanceLabel : client.data.plan?.balance || "",
          monthlyFee: client.data.finance?.monthlyFee || "",
          currency: "ILS",
        }}
        initialLang={client.data.onboarding?.lang === "ar" ? "ar" : "en"}
      />
    </main>
  );
}
