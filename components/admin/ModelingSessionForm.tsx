"use client";

import { useRef } from "react";
import { addModelingSessionAction } from "@/app/admin/partner/modeling-actions";

const label =
  "block text-[11px] font-display font-bold uppercase tracking-[0.1em] text-charcoal-60 mb-1";

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
        <label className={label}>Session</label>
        <input name="name" required placeholder="e.g. Brand lookbook shoot" className="lq-input w-full" />
      </div>
      <div>
        <label className={label}>Amount</label>
        <input name="amount" required inputMode="decimal" placeholder="0" className="lq-input w-full text-end tabular-nums" />
      </div>
      <div>
        <label className={label}>Currency</label>
        <select name="currency" defaultValue="ILS" className="lq-input w-full">
          <option value="ILS">ILS ₪</option>
          <option value="USD">USD $</option>
        </select>
      </div>
      <div>
        <label className={label}>Date</label>
        <input name="sessionDate" type="date" className="lq-input w-full" />
      </div>
      <div className="sm:col-span-4">
        <button className="lq-btn lq-btn--primary">
          + Add modeling session
        </button>
      </div>
    </form>
  );
}
