"use client";

import { setInvoiceStatusAction } from "@/app/admin/invoice-actions";
import type { InvoiceStatus } from "@/lib/invoices";

const STATUSES: InvoiceStatus[] = ["draft", "due", "partial", "paid"];

// Dropdown that saves the invoice status the moment it changes. `back`
// overrides the redirect target (e.g. stay on /admin/invoices).
export default function InvoiceStatusSelect({
  id,
  slug,
  status,
  back,
}: {
  id: number;
  slug: string;
  status: InvoiceStatus;
  back?: string;
}) {
  return (
    <form action={setInvoiceStatusAction}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="id" value={id} />
      {back && <input type="hidden" name="back" value={back} />}
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
