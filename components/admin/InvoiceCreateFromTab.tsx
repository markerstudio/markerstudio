"use client";

import { useState } from "react";
import { createInvoiceFromTab } from "@/app/admin/invoice-actions";
import ClientSelectOrType from "@/components/admin/ClientSelectOrType";

type Item = { label: string; amount: string };

function numeric(amount: string): number {
  const n = parseFloat(amount.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

const field = "rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange/40 focus:border-orange";

/* "New invoice" form for the Invoices tab — pick or type the client, then the
   same line-items / VAT / deposit flow as the client-page editor. */
export default function InvoiceCreateFromTab({ clients }: { clients: { slug: string; name: string }[] }) {
  const [items, setItems] = useState<Item[]>([{ label: "", amount: "" }]);
  const [addVat, setAddVat] = useState(false);
  const [vatRate, setVatRate] = useState("16");
  const [paid, setPaid] = useState("");
  const update = (i: number, key: keyof Item, value: string) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [key]: value } : it)));

  const subtotal = items.reduce((s, it) => s + numeric(it.amount), 0);
  const rate = addVat ? parseFloat(vatRate) || 0 : 0;
  const vat = (subtotal * rate) / 100;
  const total = subtotal + vat;
  const paidNum = numeric(paid);
  const remaining = Math.max(0, total - paidNum);
  const cleaned = items.filter((i) => i.label.trim() || i.amount.trim());

  return (
    <form action={createInvoiceFromTab}>
      <input type="hidden" name="items" value={JSON.stringify(cleaned)} />
      <input type="hidden" name="addVat" value={addVat ? "on" : ""} />
      <input type="hidden" name="vatRate" value={vatRate} />
      <input type="hidden" name="paidAmount" value={paidNum} />

      <div className="mb-4">
        <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">Client</label>
        <ClientSelectOrType clients={clients} />
      </div>

      <div className="grid grid-cols-[1fr_130px_24px] items-center gap-2 mb-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
        <span>Item</span>
        <span>Amount</span>
        <span />
      </div>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="grid grid-cols-[1fr_130px_24px] items-center gap-2">
            <input className={field} placeholder="e.g. Monthly social — Jun" value={it.label} onChange={(e) => update(i, "label", e.target.value)} />
            <input className={`${field} text-right tabular-nums`} placeholder="1,800 ILS" value={it.amount} onChange={(e) => update(i, "amount", e.target.value)} />
            <button type="button" onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))} className="text-neutral-300 hover:text-red-600 text-lg leading-none" aria-label="Remove line">
              ×
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setItems((prev) => [...prev, { label: "", amount: "" }])} className="mt-2 text-sm font-medium text-neutral-600 hover:text-orange">
        + Add line
      </button>

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
          <div className="flex justify-between gap-4">
            <span className="text-neutral-500">Subtotal (excl. VAT)</span>
            <span className="tabular-nums text-neutral-700">{subtotal.toLocaleString("en-US")}</span>
          </div>
          {addVat && rate > 0 && (
            <div className="flex justify-between gap-4">
              <span className="text-neutral-500">VAT ({rate}%)</span>
              <span className="tabular-nums text-neutral-700">{vat.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <span className="font-semibold text-neutral-900">Total{addVat && rate > 0 ? " (incl. VAT)" : ""}</span>
            <span className="font-bold tabular-nums text-neutral-900">{total.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
          </div>
          {paidNum > 0 && (
            <div className="flex justify-between gap-4">
              <span className="font-semibold text-orange-deep">Money left</span>
              <span className="font-bold tabular-nums text-orange-deep">{remaining.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
            </div>
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
        <button className="bg-orange text-white font-semibold rounded-md px-5 py-2.5 text-sm hover:bg-orange-deep transition-colors">Create invoice</button>
      </div>
    </form>
  );
}
