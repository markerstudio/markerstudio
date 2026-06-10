"use client";

// Shared primitives for the proposal / agreement builders — bilingual inputs,
// collapsible sections, list tools and the theme picker.

import type { DocTheme, L } from "@/lib/docs";

export function Acc({
  title,
  hint,
  defaultOpen = false,
  children,
}: {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="group border border-neutral-200 rounded-xl bg-white" open={defaultOpen}>
      <summary className="cursor-pointer select-none px-4 py-3 flex items-center gap-2">
        <span className="text-neutral-300 text-xs transition-transform group-open:rotate-90">▶</span>
        <span className="font-semibold text-sm text-neutral-800">{title}</span>
        {hint && <span className="text-xs text-neutral-400 truncate">{hint}</span>}
      </summary>
      <div className="px-4 pb-4 pt-1 border-t border-neutral-100 space-y-3">{children}</div>
    </details>
  );
}

export function Lbl({ children }: { children: React.ReactNode }) {
  return <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">{children}</label>;
}

const inputCls =
  "w-full border border-neutral-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange/30 focus:border-orange bg-white";

export function TextInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      {label && <Lbl>{label}</Lbl>}
      <input className={inputCls} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function NumInput({ label, value, onChange }: { label?: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      {label && <Lbl>{label}</Lbl>}
      <input
        className={inputCls}
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      />
    </div>
  );
}

// Bilingual single-line input — EN and AR side by side.
export function LInput({
  label,
  value,
  onChange,
  area = false,
  rows = 2,
}: {
  label?: string;
  value: L;
  onChange: (v: L) => void;
  area?: boolean;
  rows?: number;
}) {
  const v = value || { en: "", ar: "" };
  return (
    <div>
      {label && <Lbl>{label}</Lbl>}
      <div className="grid grid-cols-2 gap-1.5">
        {area ? (
          <>
            <textarea className={inputCls} rows={rows} dir="ltr" placeholder="EN" value={v.en} onChange={(e) => onChange({ ...v, en: e.target.value })} />
            <textarea className={inputCls} rows={rows} dir="rtl" placeholder="AR" value={v.ar} onChange={(e) => onChange({ ...v, ar: e.target.value })} />
          </>
        ) : (
          <>
            <input className={inputCls} dir="ltr" placeholder="EN" value={v.en} onChange={(e) => onChange({ ...v, en: e.target.value })} />
            <input className={inputCls} dir="rtl" placeholder="AR" value={v.ar} onChange={(e) => onChange({ ...v, ar: e.target.value })} />
          </>
        )}
      </div>
    </div>
  );
}

// Small list-item toolbar: move up / down / delete.
export function ItemTools({
  onUp,
  onDown,
  onDel,
}: {
  onUp?: () => void;
  onDown?: () => void;
  onDel?: () => void;
}) {
  const b = "w-6 h-6 inline-flex items-center justify-center rounded border border-neutral-200 text-neutral-400 hover:text-neutral-800 hover:border-neutral-400 text-xs bg-white";
  return (
    <div className="flex gap-1 shrink-0">
      {onUp && (
        <button type="button" className={b} onClick={onUp} title="Move up">↑</button>
      )}
      {onDown && (
        <button type="button" className={b} onClick={onDown} title="Move down">↓</button>
      )}
      {onDel && (
        <button type="button" className={`${b} hover:text-red-600 hover:border-red-300`} onClick={onDel} title="Remove">✕</button>
      )}
    </div>
  );
}

export function AddBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs font-semibold text-orange-deep hover:text-orange border border-dashed border-orange/40 hover:border-orange rounded-md px-3 py-1.5 transition-colors"
    >
      + {children}
    </button>
  );
}

export function ItemCard({ children }: { children: React.ReactNode }) {
  return <div className="border border-neutral-100 bg-neutral-50/60 rounded-lg p-2.5 space-y-2">{children}</div>;
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm font-medium text-neutral-700 cursor-pointer select-none">
      <span
        className={`relative inline-block w-9 h-5 rounded-full transition-colors ${checked ? "bg-orange" : "bg-neutral-200"}`}
        onClick={(e) => {
          e.preventDefault();
          onChange(!checked);
        }}
      >
        <span className={`absolute top-0.5 ${checked ? "left-[18px]" : "left-0.5"} w-4 h-4 rounded-full bg-white shadow transition-all`} />
      </span>
      {label}
    </label>
  );
}

// Theme picker — the document's look in five quick controls.
export function ThemePicker({ theme, onChange }: { theme: DocTheme; onChange: (t: DocTheme) => void }) {
  const opt = (active: boolean) =>
    `px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors ${
      active ? "bg-charcoal text-white border-charcoal" : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400"
    }`;
  return (
    <div className="space-y-2.5">
      <div>
        <Lbl>Cover</Lbl>
        <div className="flex gap-1.5">
          {(["ink", "paper", "orange"] as const).map((c) => (
            <button key={c} type="button" className={opt(theme.cover === c)} onClick={() => onChange({ ...theme, cover: c })}>
              <span
                className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle border border-black/10"
                style={{ background: c === "ink" ? "#1A1A1A" : c === "paper" ? "#F5F2EC" : "#FF9100" }}
              />
              {c}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-5 flex-wrap">
        <div>
          <Lbl>Accent</Lbl>
          <div className="flex gap-1.5">
            {(["orange", "charcoal"] as const).map((c) => (
              <button key={c} type="button" className={opt(theme.accent === c)} onClick={() => onChange({ ...theme, accent: c })}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Lbl>Display</Lbl>
          <div className="flex gap-1.5">
            {(["bold", "light"] as const).map((c) => (
              <button key={c} type="button" className={opt(theme.display === c)} onClick={() => onChange({ ...theme, display: c })}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Lbl>Numbers</Lbl>
          <div className="flex gap-1.5">
            {(["solid", "outline"] as const).map((c) => (
              <button key={c} type="button" className={opt(theme.nums === c)} onClick={() => onChange({ ...theme, nums: c })}>
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>
      <Toggle label="Brushstroke accents" checked={theme.brush} onChange={(v) => onChange({ ...theme, brush: v })} />
      <p className="text-[11px] text-neutral-400">
        Tip: in any text, wrap a word in <code className="bg-neutral-100 px-1 rounded">*stars*</code> for the accent colour and{" "}
        <code className="bg-neutral-100 px-1 rounded">**double**</code> for bold.
      </p>
    </div>
  );
}
