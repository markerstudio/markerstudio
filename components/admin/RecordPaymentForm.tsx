"use client";

import { useState } from "react";
import { recordPaymentAction } from "@/app/admin/invoice-actions";

type Line = { label: string; amount: string; kind?: string; owner?: string; left: number };
export type OpenInvoice = {
  id: number;
  number: string;
  clientSlug: string;
  clientName: string;
  currency: "ILS" | "USD";
  remaining: number;
  lines: Line[];
};

const field = "lq-input !px-3 !py-2 text-sm";

function num(s: string): number {
  const n = parseFloat((s || "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
// Default each line to exactly what's still owed on it (server-computed from
// the recorded allocations), so a full payment needs zero editing.
function defaultAlloc(o: OpenInvoice): string[] {
  return o.lines.map((l) => String(Math.round(l.left)));
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
    <form action={recordPaymentAction} className="lq-card lq-rise p-5 space-y-4">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="slug" value={inv?.clientSlug || ""} />
      <input type="hidden" name="back" value="/admin/invoices" />
      <input type="hidden" name="amount" value={total} />
      <input type="hidden" name="currency" value={currency} />
      <input type="hidden" name="allocation" value={JSON.stringify(allocationPayload)} />

      <div>
        <label className="block text-[11px] font-display font-bold uppercase tracking-[0.1em] text-charcoal-60 mb-1.5">Invoice</label>
        <select required value={id} onChange={(e) => selectInvoice(e.target.value)} className={`${field} !w-auto min-w-[280px] max-w-full`}>
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

      {invoices.length === 0 && <p className="text-sm text-charcoal-60">No open invoices to pay.</p>}

      {inv && (
        <>
          <div>
            <div className="grid grid-cols-[1fr_104px_92px_110px] items-center gap-2 mb-1.5 px-0.5 text-[10px] font-display font-bold uppercase tracking-[0.12em] text-charcoal-60">
              <span>Line</span>
              <span>Type</span>
              <span className="text-right">Left</span>
              <span className="text-right">Apply</span>
            </div>
            <div className="space-y-2">
              {inv.lines.map((l, i) => (
                <div key={i} className="grid grid-cols-[1fr_104px_92px_110px] items-center gap-2">
                  <span className="text-sm text-charcoal-80 truncate">{l.label || "—"}</span>
                  <span className={`text-xs ${isRamzi(l) ? "text-orange-deep font-semibold" : "text-charcoal-60"}`}>
                    {KIND_LABEL[l.kind || "plan"] || "Marketing"}
                  </span>
                  {/* What this line still owes — click it to apply exactly that. */}
                  <button
                    type="button"
                    title="Apply exactly this line's remainder"
                    onClick={() => setAlloc((prev) => prev.map((a, idx) => (idx === i ? String(Math.round(l.left)) : a)))}
                    className={`text-right text-sm tabular-nums lq-press rounded-md px-1 py-0.5 hover:bg-orange/10 ${
                      l.left > 0.5 ? "font-semibold text-charcoal-80 hover:text-orange-deep" : "text-charcoal-40"
                    }`}
                  >
                    {l.left > 0.5 ? Math.round(l.left).toLocaleString("en-US") : "✓ paid"}
                  </button>
                  <input
                    value={alloc[i] ?? ""}
                    onChange={(e) => setAlloc((prev) => prev.map((a, idx) => (idx === i ? e.target.value : a)))}
                    className={`${field} text-right tabular-nums`}
                    inputMode="decimal"
                  />
                </div>
              ))}
            </div>
            <p className="mt-1.5 px-0.5 text-[11px] text-charcoal-40">
              Left = what each line still owes (VAT included), from the recorded payments. Click a number to apply exactly that.
            </p>
          </div>

          <div className="flex items-center justify-between border-t border-charcoal/5 pt-3 text-sm">
            <span className="font-semibold text-ink">Total payment</span>
            <span className="font-bold tabular-nums text-ink">{total.toLocaleString("en-US")} {currency}</span>
          </div>
          {ramziTotal > 0 && (
            <p className="text-xs text-orange-deep -mt-2">
              {ramziTotal.toLocaleString("en-US")} {currency} of this is Ramzi&apos;s (stories) — collected for him, kept out of Marker income &amp; Notion.
            </p>
          )}

          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="block text-[11px] font-display font-bold uppercase tracking-[0.1em] text-charcoal-60 mb-1">Date</label>
              <input type="date" name="paidOn" className={field} />
            </div>
            <div>
              <label className="block text-[11px] font-display font-bold uppercase tracking-[0.1em] text-charcoal-60 mb-1">Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value as "ILS" | "USD")} className={field}>
                <option value="ILS">ILS ₪</option>
                <option value="USD">USD $</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-display font-bold uppercase tracking-[0.1em] text-charcoal-60 mb-1">Method</label>
              <select name="method" defaultValue="" className={field}>
                <option value="">—</option>
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
                <option value="card">Card</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="block text-[11px] font-display font-bold uppercase tracking-[0.1em] text-charcoal-60 mb-1">Note (optional)</label>
              <input name="note" className={`${field} w-full`} placeholder="e.g. June stories + plan" />
            </div>
          </div>

          <label className="lq-well flex items-start gap-2.5 text-sm text-charcoal-80 px-3.5 py-3">
            <input type="checkbox" name="toNotion" defaultChecked value="on" className="custom-checkbox mt-0.5" />
            <span>
              <b>Also add to Notion records.</b> Writes the Marker (marketing/branding) part of this payment to the Notion
              Income database, in the currency above. Stories stay out of Notion (collected for Ramzi). Uncheck if it&apos;s
              already in Notion.
            </span>
          </label>

          <button disabled={total <= 0} className="lq-btn lq-btn--primary">
            Record payment &amp; create receipt
          </button>
        </>
      )}
    </form>
  );
}
