"use client";

import { useState } from "react";
import { recordPaymentAction } from "@/app/admin/invoice-actions";

type Line = { label: string; amount: string; kind?: string; owner?: string };
export type OpenInvoice = {
  id: number;
  number: string;
  clientSlug: string;
  clientName: string;
  currency: "ILS" | "USD";
  remaining: number;
  lines: Line[];
};

const field = "rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange/40 focus:border-orange";

function num(s: string): number {
  const n = parseFloat((s || "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
// Default each line to its share of what's still owed on the invoice.
function defaultAlloc(o: OpenInvoice): string[] {
  const total = o.lines.reduce((s, l) => s + num(l.amount), 0);
  return o.lines.map((l) => (total > 0 ? String(Math.round((num(l.amount) * o.remaining) / total)) : "0"));
}
const KIND_LABEL: Record<string, string> = { branding: "Branding", plan: "Marketing", stories: "Stories · Ramzi", extra: "Extra" };
const isRamzi = (l: Line) => l.owner === "ramzi" || l.kind === "stories";

/* Global "Record payment": pick any open invoice, then choose how the payment
   splits across its lines (defaults proportional to what's left). The split
   drives the Marker-vs-Ramzi booking and the per-line Notion sync. An optional
   initialId pre-selects an invoice (deep-linked from an invoice's "+ Payment"). */
export default function RecordPaymentForm({ invoices, initialId }: { invoices: OpenInvoice[]; initialId?: number }) {
  const preset = initialId != null ? invoices.find((v) => v.id === initialId) : undefined;
  const [id, setId] = useState<number | "">(preset ? preset.id : "");
  const [alloc, setAlloc] = useState<string[]>(preset ? defaultAlloc(preset) : []);
  // Currency starts from the invoice's inferred currency but is editable — the
  // "$" heuristic can misread a mixed/USD invoice, and this is what's written to
  // Notion, so the admin gets the final say.
  const [currency, setCurrency] = useState<"ILS" | "USD">(preset ? preset.currency : "ILS");
  const inv = invoices.find((v) => v.id === id);

  function selectInvoice(value: string) {
    const v = Number(value);
    setId(value ? v : "");
    const o = invoices.find((x) => x.id === v);
    if (!o) return setAlloc([]);
    setAlloc(defaultAlloc(o));
    setCurrency(o.currency);
  }

  const groups = Array.from(new Set(invoices.map((v) => v.clientName))).sort();
  const total = alloc.reduce((s, a) => s + num(a), 0);
  const ramziTotal = inv ? inv.lines.reduce((s, l, i) => s + (isRamzi(l) ? num(alloc[i] || "0") : 0), 0) : 0;
  const allocationPayload = inv
    ? inv.lines.map((l, i) => ({ label: l.label, kind: l.kind, owner: l.owner, amount: num(alloc[i] || "0") })).filter((a) => a.amount > 0)
    : [];

  return (
    <form action={recordPaymentAction} className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="slug" value={inv?.clientSlug || ""} />
      <input type="hidden" name="back" value="/admin/invoices" />
      <input type="hidden" name="amount" value={total} />
      <input type="hidden" name="currency" value={currency} />
      <input type="hidden" name="allocation" value={JSON.stringify(allocationPayload)} />

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">Invoice</label>
        <select required value={id} onChange={(e) => selectInvoice(e.target.value)} className={`${field} min-w-[280px]`}>
          <option value="" disabled>Choose an open invoice…</option>
          {groups.map((g) => (
            <optgroup key={g} label={g}>
              {invoices.filter((v) => v.clientName === g).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.number} · {Math.round(v.remaining).toLocaleString("en-US")} {v.currency} left
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {invoices.length === 0 && <p className="text-sm text-neutral-500">No open invoices to pay.</p>}

      {inv && (
        <>
          <div>
            <div className="grid grid-cols-[1fr_120px_120px] items-center gap-2 mb-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              <span>Line</span>
              <span>Type</span>
              <span className="text-right">Apply</span>
            </div>
            <div className="space-y-2">
              {inv.lines.map((l, i) => (
                <div key={i} className="grid grid-cols-[1fr_120px_120px] items-center gap-2">
                  <span className="text-sm text-neutral-800 truncate">{l.label || "—"}</span>
                  <span className={`text-xs ${isRamzi(l) ? "text-orange-deep font-semibold" : "text-neutral-500"}`}>
                    {KIND_LABEL[l.kind || "plan"] || "Marketing"}
                  </span>
                  <input
                    value={alloc[i] ?? ""}
                    onChange={(e) => setAlloc((prev) => prev.map((a, idx) => (idx === i ? e.target.value : a)))}
                    className={`${field} text-right tabular-nums`}
                    inputMode="decimal"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-neutral-100 pt-3 text-sm">
            <span className="font-semibold text-neutral-900">Total payment</span>
            <span className="font-bold tabular-nums text-neutral-900">{total.toLocaleString("en-US")} {currency}</span>
          </div>
          {ramziTotal > 0 && (
            <p className="text-xs text-orange-deep -mt-2">
              {ramziTotal.toLocaleString("en-US")} {currency} of this is Ramzi&apos;s (stories) — collected for him, kept out of Marker income &amp; Notion.
            </p>
          )}

          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Date</label>
              <input type="date" name="paidOn" className={field} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value as "ILS" | "USD")} className={field}>
                <option value="ILS">ILS ₪</option>
                <option value="USD">USD $</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Method</label>
              <select name="method" defaultValue="" className={field}>
                <option value="">—</option>
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
                <option value="card">Card</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Note (optional)</label>
              <input name="note" className={`${field} w-full`} placeholder="e.g. June stories + plan" />
            </div>
          </div>

          <label className="flex items-start gap-2.5 text-sm text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-md px-3 py-2.5">
            <input type="checkbox" name="toNotion" defaultChecked value="on" className="custom-checkbox mt-0.5" />
            <span>
              <b>Also add to Notion records.</b> Writes the Marker (marketing/branding) part of this payment to the Notion
              Income database, in the currency above. Stories stay out of Notion (collected for Ramzi). Uncheck if it&apos;s
              already in Notion.
            </span>
          </label>

          <button disabled={total <= 0} className="bg-green-600 text-white font-semibold rounded-md px-5 py-2.5 text-sm hover:bg-green-700 transition-colors disabled:opacity-50">
            Record payment &amp; create receipt
          </button>
        </>
      )}
    </form>
  );
}
