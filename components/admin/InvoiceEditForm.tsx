"use client";

import { useState } from "react";
import { updateInvoiceAction } from "@/app/admin/invoice-actions";

type Kind = "branding" | "plan" | "stories" | "extra";
type Item = { label: string; amount: string; kind?: Kind; owner?: "marker" | "ramzi" };

const KIND_OPTS: { value: Kind; label: string }[] = [
  { value: "plan", label: "Marketing" },
  { value: "branding", label: "Branding" },
  { value: "stories", label: "Stories · Ramzi" },
  { value: "extra", label: "Extra" },
];

function numeric(amount: string): number {
  const n = parseFloat(amount.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

const field = "lq-input !px-3 !py-2 text-sm";

/* Edit an existing invoice — same line/VAT/due/note controls as the creator,
   prefilled, posting to updateInvoiceAction. The client is fixed, so there's no
   client picker. */
export default function InvoiceEditForm({
  id,
  back,
  initialItems,
  initialVatRate,
  initialNote,
  initialDueDate,
  storiesFee = "",
}: {
  id: number;
  back: string;
  initialItems: Item[];
  initialVatRate: number;
  initialNote: string;
  initialDueDate: string;
  storiesFee?: string;
}) {
  const [items, setItems] = useState<Item[]>(initialItems.length ? initialItems : [{ label: "", amount: "", kind: "plan" }]);
  const [addVat, setAddVat] = useState(initialVatRate > 0);
  const [vatRate, setVatRate] = useState(String(initialVatRate > 0 ? initialVatRate : 16));
  const update = (i: number, key: keyof Item, value: string) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? ({ ...it, [key]: value } as Item) : it)));

  const subtotal = items.reduce((s, it) => s + numeric(it.amount), 0);
  const rate = addVat ? parseFloat(vatRate) || 0 : 0;
  const vat = (subtotal * rate) / 100;
  const total = subtotal + vat;
  const cleaned = items.filter((i) => i.label.trim() || i.amount.trim());

  return (
    <form action={updateInvoiceAction} className="lq-card lq-rise p-5">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="back" value={back} />
      <input type="hidden" name="items" value={JSON.stringify(cleaned)} />
      <input type="hidden" name="addVat" value={addVat ? "on" : ""} />
      <input type="hidden" name="vatRate" value={vatRate} />

      <div className="grid grid-cols-[1fr_120px_130px_24px] items-center gap-2 mb-1.5 px-0.5 text-[10px] font-display font-bold uppercase tracking-[0.12em] text-charcoal-60">
        <span>Item</span>
        <span>Amount</span>
        <span>Type</span>
        <span />
      </div>
      <div className="space-y-2">
        {items.map((it, i) => {
          const stories = it.kind === "stories";
          return (
            <div key={i} className="grid grid-cols-[1fr_120px_130px_24px] items-center gap-2">
              <input className={field} placeholder="e.g. Monthly social — Jun" value={it.label} onChange={(e) => update(i, "label", e.target.value)} />
              <input className={`${field} text-right tabular-nums`} placeholder="1,800 ILS" value={it.amount} onChange={(e) => update(i, "amount", e.target.value)} />
              <select
                className={`${field} ${stories ? "text-orange-deep font-semibold" : ""}`}
                value={it.kind || "plan"}
                onChange={(e) => update(i, "kind", e.target.value as Kind)}
                title={stories ? "Collected for Ramzi — billed to the client but kept out of Marker's income & Notion" : undefined}
              >
                {KIND_OPTS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <button type="button" onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))} className="text-charcoal-20 hover:text-rose-600 text-lg leading-none" aria-label="Remove line">×</button>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-4 flex-wrap">
        <button type="button" onClick={() => setItems((prev) => [...prev, { label: "", amount: "", kind: "plan" }])} className="text-sm font-medium text-charcoal-60 hover:text-orange-deep">+ Add line</button>
        <button
          type="button"
          onClick={() => setItems((prev) => [...prev, { label: "Stories", amount: storiesFee || "", kind: "stories" }])}
          className="text-sm font-medium text-orange-deep hover:text-orange"
        >
          + Stories (Ramzi){storiesFee ? ` · ${storiesFee}` : ""}
        </button>
      </div>

      <div className="mt-3 flex items-center gap-3 border-t border-charcoal/5 pt-3 flex-wrap">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-charcoal-80">
          <input type="checkbox" checked={addVat} onChange={(e) => setAddVat(e.target.checked)} className="h-4 w-4 rounded border-charcoal/20 text-orange focus:ring-orange/30" />
          Add VAT
        </label>
        {addVat && (
          <label className="flex items-center gap-1.5 text-sm text-charcoal-60">
            <input value={vatRate} onChange={(e) => setVatRate(e.target.value)} className={`${field} !w-16 text-right`} />
            %
          </label>
        )}
      </div>

      {subtotal > 0 && (
        <div className="mt-3 border-t border-charcoal/5 pt-3 text-sm space-y-1">
          <div className="flex justify-between gap-4">
            <span className="text-charcoal-60">Subtotal (excl. VAT)</span>
            <span className="tabular-nums text-charcoal-80">{subtotal.toLocaleString("en-US")}</span>
          </div>
          {addVat && rate > 0 && (
            <div className="flex justify-between gap-4">
              <span className="text-charcoal-60">VAT ({rate}%)</span>
              <span className="tabular-nums text-charcoal-80">{vat.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <span className="font-semibold text-ink">Total{addVat && rate > 0 ? " (incl. VAT)" : ""}</span>
            <span className="font-bold tabular-nums text-ink">{total.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      )}

      <div className="mt-3 flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-[11px] font-display font-bold uppercase tracking-[0.1em] text-charcoal-60 mb-1">Due date (optional)</label>
          <input type="date" name="dueDate" defaultValue={initialDueDate} className={field} />
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-[11px] font-display font-bold uppercase tracking-[0.1em] text-charcoal-60 mb-1">Note (optional)</label>
          <input name="note" defaultValue={initialNote} placeholder="e.g. Cycle 03 · paid on receipt" className={`${field} w-full`} />
        </div>
      </div>

      <button className="mt-4 lq-btn lq-btn--primary">Save changes</button>
    </form>
  );
}
