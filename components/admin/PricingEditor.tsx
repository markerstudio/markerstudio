"use client";

import { useState } from "react";
import { savePricing } from "@/app/admin/actions";

type Item = { label: string; amount: string };

function numeric(amount: string): number {
  const n = parseFloat(amount.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

const field =
  "rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange/40 focus:border-orange";

export default function PricingEditor({ slug, initial, note }: { slug: string; initial: Item[]; note: string }) {
  const [items, setItems] = useState<Item[]>(initial.length ? initial : [{ label: "", amount: "" }]);

  const update = (i: number, key: keyof Item, value: string) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [key]: value } : it)));
  const addRow = () => setItems((prev) => [...prev, { label: "", amount: "" }]);
  const removeRow = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));

  const total = items.reduce((sum, it) => sum + numeric(it.amount), 0);
  const cleaned = items.filter((i) => i.label.trim() || i.amount.trim());

  return (
    <form action={savePricing} className="border border-neutral-200 rounded-lg p-4 mb-4">
      <div className="mb-3 font-semibold text-sm">Pricing / quote</div>

      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="items" value={JSON.stringify(cleaned)} />

      <div className="grid grid-cols-[1fr_130px_24px] items-center gap-2 mb-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
        <span>Item</span>
        <span>Amount</span>
        <span />
      </div>

      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="grid grid-cols-[1fr_130px_24px] items-center gap-2">
            <input
              className={field}
              placeholder="e.g. Growth Branding"
              value={it.label}
              onChange={(e) => update(i, "label", e.target.value)}
            />
            <input
              className={`${field} text-right tabular-nums`}
              placeholder="3,000 ILS"
              value={it.amount}
              onChange={(e) => update(i, "amount", e.target.value)}
            />
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="text-neutral-300 hover:text-red-600 text-lg leading-none"
              aria-label="Remove line"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <button type="button" onClick={addRow} className="mt-2 text-sm font-medium text-neutral-600 hover:text-orange">
        + Add line
      </button>

      {total > 0 && (
        <div className="mt-3 grid grid-cols-[1fr_130px_24px] gap-2 border-t border-neutral-100 pt-3 text-sm">
          <span className="font-semibold text-neutral-700">Total (approx.)</span>
          <span className="text-right font-bold tabular-nums text-neutral-900">{total.toLocaleString("en-US")}</span>
          <span />
        </div>
      )}

      <div className="mt-3">
        <input name="note" defaultValue={note} placeholder="Pricing note (optional) — e.g. 50% to start, 50% on approval · excl. VAT" className={`${field} w-full`} />
      </div>

      <button className="mt-3 bg-orange text-white font-semibold rounded-md px-4 py-2 text-sm hover:bg-orange-deep transition-colors">
        Save pricing
      </button>
    </form>
  );
}
