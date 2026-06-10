"use client";

// Inline "+ Payment" control on an invoice row — expands to an amount field
// and records the payment without leaving the list.

import { useRef, useState } from "react";
import { recordPaymentAction } from "@/app/admin/invoice-actions";

export default function RecordPayment({
  id,
  slug,
  back,
  remaining,
}: {
  id: number;
  slug: string;
  back: string;
  remaining: number;
}) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 30);
        }}
        className="text-sm font-semibold text-green-700 hover:text-green-800"
      >
        + Payment
      </button>
    );
  }

  return (
    <form action={recordPaymentAction} className="flex items-center gap-1.5">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="back" value={back} />
      <input
        ref={inputRef}
        name="amount"
        type="number"
        step="0.01"
        min="0"
        defaultValue={remaining > 0 ? remaining : undefined}
        placeholder="Amount"
        className="w-24 border border-neutral-300 rounded-md px-2 py-1 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500"
      />
      <button className="text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-md px-2.5 py-1">✓</button>
      <button type="button" onClick={() => setOpen(false)} className="text-sm text-neutral-400 hover:text-neutral-700 px-1">
        ✕
      </button>
    </form>
  );
}
