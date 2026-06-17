"use client";

import { useState } from "react";
import { createInvoiceAction } from "@/app/admin/invoice-actions";

type Kind = "branding" | "plan" | "stories" | "extra";
type Item = { label: string; amount: string; kind?: Kind };

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

const field = "rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange/40 focus:border-orange";

export default function InvoiceEditor({ slug, seed, defaultVatRate = 16, storiesFee = "" }: { slug: string; seed: Item[]; defaultVatRate?: number; storiesFee?: string }) {
  const [items, setItems] = useState<Item[]>(seed.length ? seed : [{ label: "", amount: "" }]);
  const [addVat, setAddVat] = useState(false);
  const [vatRate, setVatRate] = useState(String(defaultVatRate));
  const [paid, setPaid] = useState("");
  const update = (i: number, key: keyof Item, value: string) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? ({ ...it, [key]: value } as Item) : it)));
  const addRow = () => setItems((prev) => [...prev, { label: "", amount: "" }]);
  const removeRow = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));

  const subtotal = items.reduce((s, it) => s + numeric(it.amount), 0);
  const rate = addVat ? parseFloat(vatRate) || 0 : 0;
  const vat = (subtotal * rate) / 100;
  const total = subtotal + vat;
  const paidNum = numeric(paid);
  const remaining = Math.max(0, total - paidNum);
  const cleaned = items.filter((i) => i.label.trim() || i.amount.trim());

  return (
    <form action={createInvoiceAction} className="border border-neutral-200 rounded-lg p-4">
      <div className="mb-3 font-semibold text-sm">New invoice</div>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="items" value={JSON.stringify(cleaned)} />

      <div className="grid grid-cols-[1fr_120px_130px_24px] items-center gap-2 mb-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
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
              <button type="button" onClick={() => removeRow(i)} className="text-neutral-300 hover:text-red-600 text-lg leading-none" aria-label="Remove line">×</button>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-4 flex-wrap">
        <button type="button" onClick={addRow} className="text-sm font-medium text-neutral-600 hover:text-orange">+ Add line</button>
        <button
          type="button"
          onClick={() => setItems((prev) => [...prev, { label: "Stories", amount: storiesFee || "", kind: "stories" }])}
          className="text-sm font-medium text-orange-deep hover:text-orange"
        >
          + Stories (Ramzi){storiesFee ? ` · ${storiesFee}` : ""}
        </button>
      </div>

      {/* VAT toggle */}
      <input type="hidden" name="addVat" value={addVat ? "on" : ""} />
      <input type="hidden" name="vatRate" value={vatRate} />
      <input type="hidden" name="paidAmount" value={paidNum} />
      <div className="mt-3 flex items-center gap-3 border-t border-neutral-100 pt-3 flex-wrap">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
          <input type="checkbox" checked={addVat} onChange={(e) => setAddVat(e.target.checked)} className="h-4 w-4 rounded border-neutral-300 text-orange focus:ring-orange/30" />
          Add VAT
        </label>
        {addVat && (
          <label className="flex items-center gap-1.5 text-sm text-neutral-600">
            <input value={vatRate} onChange={(e) => setVatRate(e.target.value)} className={`${field} w-16 text-right`} />
            %
          </label>
        )}
        <label className="flex items-center gap-1.5 text-sm text-neutral-600 ml-auto">
          <span className="whitespace-nowrap">Paid / deposit</span>
          <input value={paid} onChange={(e) => setPaid(e.target.value)} placeholder="0" className={`${field} w-28 text-right tabular-nums`} />
        </label>
      </div>

      {subtotal > 0 && (
        <div className="mt-3 border-t border-neutral-100 pt-3 text-sm space-y-1">
          <div className="grid grid-cols-[1fr_130px_24px] gap-2">
            <span className="text-neutral-500">Subtotal (excl. VAT)</span>
            <span className="text-right tabular-nums text-neutral-700">{subtotal.toLocaleString("en-US")}</span>
            <span />
          </div>
          {addVat && rate > 0 && (
            <div className="grid grid-cols-[1fr_130px_24px] gap-2">
              <span className="text-neutral-500">VAT ({rate}%)</span>
              <span className="text-right tabular-nums text-neutral-700">{vat.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
              <span />
            </div>
          )}
          <div className="grid grid-cols-[1fr_130px_24px] gap-2">
            <span className="font-semibold text-neutral-900">Total{addVat && rate > 0 ? " (incl. VAT)" : " (excl. VAT)"}</span>
            <span className="text-right font-bold tabular-nums text-neutral-900">{total.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
            <span />
          </div>
          {paidNum > 0 && (
            <>
              <div className="grid grid-cols-[1fr_130px_24px] gap-2">
                <span className="text-neutral-500">Paid / deposit</span>
                <span className="text-right tabular-nums text-green-700">−{paidNum.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
                <span />
              </div>
              <div className="grid grid-cols-[1fr_130px_24px] gap-2">
                <span className="font-semibold text-orange-deep">Money left</span>
                <span className="text-right font-bold tabular-nums text-orange-deep">{remaining.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
                <span />
              </div>
            </>
          )}
        </div>
      )}

      <div className="mt-3 flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Due date (optional)</label>
          <input type="date" name="dueDate" className={field} />
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Note (optional)</label>
          <input name="note" placeholder="e.g. Cycle 03 · paid on receipt" className={`${field} w-full`} />
        </div>
      </div>

      <button className="mt-3 bg-orange text-white font-semibold rounded-md px-4 py-2 text-sm hover:bg-orange-deep transition-colors">Create invoice</button>
    </form>
  );
}
