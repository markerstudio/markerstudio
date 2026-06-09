"use client";

import { setInvoiceStatusAction } from "@/app/admin/invoice-actions";
import type { InvoiceStatus } from "@/lib/invoices";

const STATUSES: InvoiceStatus[] = ["draft", "due", "partial", "paid"];

// Dropdown that saves the invoice status the moment it changes.
export default function InvoiceStatusSelect({
  id,
  slug,
  status,
}: {
  id: number;
  slug: string;
  status: InvoiceStatus;
}) {
  return (
    <form action={setInvoiceStatusAction}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="id" value={id} />
      <select
        name="status"
        defaultValue={status}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="text-xs font-semibold uppercase text-neutral-600 border border-neutral-300 rounded-md px-2 py-1 hover:border-orange focus:outline-none focus:ring-2 focus:ring-orange/40 transition-colors"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </form>
  );
}
