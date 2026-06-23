"use client";

import { useRef } from "react";
import { addModelingSessionAction } from "@/app/admin/partner/modeling-actions";

const field =
  "rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange/40 focus:border-orange";

/* Add a modeling session to Ramzi's private ledger: a session name and what he
   earned (with date + currency). On submit the row is saved and the form resets
   so he can log the next one. */
export default function ModelingSessionForm() {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={formRef}
      action={addModelingSessionAction}
      onSubmit={() => setTimeout(() => formRef.current?.reset(), 0)}
      className="grid gap-3 sm:grid-cols-[1fr_120px_110px_140px] sm:items-end"
    >
      <div className="min-w-0">
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">Session</label>
        <input name="name" required placeholder="e.g. Brand lookbook shoot" className={`${field} w-full`} />
      </div>
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">Amount</label>
        <input name="amount" required inputMode="decimal" placeholder="0" className={`${field} w-full text-right tabular-nums`} />
      </div>
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">Currency</label>
        <select name="currency" defaultValue="ILS" className={`${field} w-full`}>
          <option value="ILS">ILS ₪</option>
          <option value="USD">USD $</option>
        </select>
      </div>
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">Date</label>
        <input name="sessionDate" type="date" className={`${field} w-full`} />
      </div>
      <div className="sm:col-span-4">
        <button className="bg-orange text-white font-semibold rounded-md px-5 py-2.5 text-sm hover:bg-orange-deep transition-colors">
          + Add modeling session
        </button>
      </div>
    </form>
  );
}
