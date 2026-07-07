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
        className="lq-input !w-auto !rounded-full !px-2.5 !py-1.5 !text-xs !font-semibold uppercase text-charcoal-80 hover:border-orange/50 cursor-pointer"
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
