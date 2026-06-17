import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getInvoice } from "@/lib/invoices";
import { getClient } from "@/lib/clients";
import InvoiceEditForm from "@/components/admin/InvoiceEditForm";

export const dynamic = "force-dynamic";

export default async function EditInvoicePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  if (!(await getSession())) redirect("/login");
  const id = Number(params.id || 0);
  const inv = await getInvoice(id);
  if (!inv) notFound();

  const client = await getClient(inv.client_slug).catch(() => undefined);
  const storiesFee = client?.data?.finance?.storiesFee || "";
  const dueDate = inv.due_date ? String(inv.due_date).slice(0, 10) : "";

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Edit invoice <span className="font-mono">{inv.number}</span>
          </h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            <Link href={`/admin/clients/${inv.client_slug}/edit`} className="hover:text-orange">/{inv.client_slug}</Link>
            {" · "}change lines, type, VAT, due date or note. Already-paid amounts stay; past Notion payments aren&apos;t rewritten.
          </p>
        </div>
        <Link href="/admin/invoices" className="text-sm font-medium text-neutral-500 hover:text-orange">← Back to invoices</Link>
      </div>

      {searchParams.error === "empty" && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-4 py-2.5 mb-4">Add at least one line item.</p>
      )}

      <InvoiceEditForm
        id={inv.id}
        back="/admin/invoices"
        initialItems={inv.items || []}
        initialVatRate={Number(inv.vat_rate) || 0}
        initialNote={inv.note || ""}
        initialDueDate={dueDate}
        storiesFee={storiesFee}
      />
    </div>
  );
}
