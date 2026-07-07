"use client";

import { useState, useTransition } from "react";
import type { LocalizedText } from "@/lib/clients";

// Shared form primitives for the tabbed client editor. Extracted from the old
// monolithic ClientForm so every tab renders identical-looking fields.

export const input = "lq-input";
export const lbl = "block text-[11px] font-display font-bold uppercase tracking-[0.1em] text-charcoal-60 mb-1";

export const fmtIls = (n: number) => `${Math.round(n).toLocaleString("en-US")} ILS`;

// A payment amount is stored as one string ("1,800 ILS" / "$50"); the editor
// works in a number + currency, so split it on load and recompose on change.
export function splitAmount(s: string): { num: string; cur: "ILS" | "USD" } {
  return { num: (s || "").match(/[\d.,]+/)?.[0] || "", cur: /\$|usd/i.test(s || "") ? "USD" : "ILS" };
}
export function joinAmount(num: string, cur: "ILS" | "USD"): string {
  const clean = (num || "").trim();
  return !clean ? "" : cur === "USD" ? `$${clean}` : `${clean} ILS`;
}

// Normalise whatever the AI put in a bilingual field — a {en,ar} object, or a
// bare string (treated as English) — into a LocalizedText.
export function coerceLT(v: unknown): LocalizedText | undefined {
  if (v == null) return undefined;
  if (typeof v === "string") return v.trim() ? { en: v, ar: "" } : undefined;
  if (typeof v === "object") {
    const o = v as { en?: unknown; ar?: unknown };
    const en = typeof o.en === "string" ? o.en : "";
    const ar = typeof o.ar === "string" ? o.ar : "";
    return en || ar ? { en, ar } : undefined;
  }
  return undefined;
}

export function Text({ label, value, onChange, placeholder, area }: { label?: string; value: string; onChange: (v: string) => void; placeholder?: string; area?: boolean }) {
  return (
    <div>
      {label && <label className={lbl}>{label}</label>}
      {area ? (
        <textarea className={input} rows={2} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className={input} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

export function Bi({ label, value, onChange, area }: { label: string; value?: LocalizedText; onChange: (v: LocalizedText) => void; area?: boolean }) {
  const v = value ?? { en: "", ar: "" };
  return (
    <div className="mb-4">
      <label className={lbl}>{label}</label>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <span className="block text-[10px] font-display font-bold text-charcoal-40 mb-1">EN</span>
          {area ? <textarea dir="ltr" rows={2} className={input} value={v.en} onChange={(e) => onChange({ ...v, en: e.target.value })} /> : <input dir="ltr" className={input} value={v.en} onChange={(e) => onChange({ ...v, en: e.target.value })} />}
        </div>
        <div>
          <span className="block text-[10px] font-display font-bold text-charcoal-40 mb-1">AR</span>
          {area ? <textarea dir="rtl" rows={2} className={input} value={v.ar} onChange={(e) => onChange({ ...v, ar: e.target.value })} /> : <input dir="rtl" className={input} value={v.ar} onChange={(e) => onChange({ ...v, ar: e.target.value })} />}
        </div>
      </div>
    </div>
  );
}

export function Rows<T>({ items, onChange, blank, addLabel, render }: { items: T[]; onChange: (next: T[]) => void; blank: T; addLabel: string; render: (item: T, set: (patch: Partial<T>) => void) => React.ReactNode }) {
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={i} className="bg-white/60 border border-charcoal/5 rounded-2xl p-3 relative">
          <button type="button" onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="absolute top-2 right-2 text-xs font-semibold text-charcoal-40 hover:text-rose-700">Remove</button>
          {render(it, (patch) => onChange(items.map((x, idx) => (idx === i ? { ...x, ...patch } : x))))}
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, { ...blank }])} className="text-sm font-semibold text-orange hover:text-orange-deep">+ {addLabel}</button>
    </div>
  );
}

// Per-section save control. Each tab owns its own save; this handles the pending
// state and the transient "Saved ✓" / error message so tabs stay declarative.
export function SaveButton({ onSave, label = "Save section" }: { onSave: () => Promise<{ ok: boolean; error?: string }>; label?: string }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  return (
    <div className="flex items-center gap-3 sticky bottom-0 bg-paper/95 py-3 -mx-1 px-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setMsg(null);
            const res = await onSave();
            setMsg(res.ok ? { text: "Saved ✓", ok: true } : { text: res.error || "Save failed.", ok: false });
          })
        }
        className="lq-btn lq-btn--primary"
      >
        {pending ? "Saving…" : label}
      </button>
      {msg && <span className={`text-sm ${msg.ok ? "text-emerald-700" : "text-rose-700"}`}>{msg.text}</span>}
    </div>
  );
}
