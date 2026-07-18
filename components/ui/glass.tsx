"use client";

/* Marker Glass — shared UI primitives for the app (admin + portal).
   Pure presentation over the `lq-*` layer in globals.css; no data logic.
   Real backdrop blur lives only in chrome pieces (Sheet, Modal, Popover,
   Toast) — cards fake the material so pages stay fast. */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

/* ---------------------------------------------------------------- cards */

export function GlassCard({
  as: Tag = "div",
  hover = false,
  className = "",
  style,
  children,
  ...rest
}: {
  as?: any;
  hover?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  [key: string]: any;
}) {
  return (
    <Tag
      className={`lq-card ${hover ? "lq-card--hover" : ""} ${className}`}
      style={style}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function SectionHead({
  title,
  sub,
  action,
  className = "",
}: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-end justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <h2 className="font-display font-bold text-[17px] tracking-tight text-ink leading-snug">
          {title}
        </h2>
        {sub && <p className="text-[12.5px] text-charcoal-60 mt-0.5">{sub}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function StatTile({
  label,
  value,
  sub,
  tone = "neutral",
  href,
  delay = 0,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad" | "accent";
  href?: string;
  delay?: number;
}) {
  const subColor =
    tone === "good"
      ? "text-emerald-700"
      : tone === "warn"
      ? "text-amber-700"
      : tone === "bad"
      ? "text-rose-700"
      : "text-charcoal-60";
  const body = (
    <div
      className={`${tone === "accent" ? "lq-accent" : "lq-card"} lq-card--hover h-full p-4 flex flex-col gap-1.5`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <span
        className={`text-[10px] font-display font-bold uppercase tracking-[0.12em] ${
          tone === "accent" ? "text-white/85" : "text-charcoal-60"
        }`}
      >
        {label}
      </span>
      <span
        className={`font-display font-extrabold text-[24px] leading-none tracking-tight break-words ${
          tone === "accent" ? "text-white" : "text-ink"
        }`}
      >
        {value}
      </span>
      {sub && (
        <span
          className={`text-[11.5px] font-semibold leading-tight ${
            tone === "accent" ? "text-white/85" : subColor
          }`}
        >
          {sub}
        </span>
      )}
    </div>
  );
  return href ? (
    <a href={href} className="block h-full no-underline lq-rise" style={{ animationDelay: `${delay}ms` }}>
      {body}
    </a>
  ) : (
    <div className="h-full lq-rise" style={{ animationDelay: `${delay}ms` }}>{body}</div>
  );
}

/* ------------------------------------------------------------- controls */

export function Seg<T extends string>({
  value,
  onChange,
  options,
  className = "",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  className?: string;
}) {
  return (
    <div className={`lq-seg ${className}`} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          className={`lq-seg__opt ${o.value === value ? "is-on" : ""}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  sub,
  action,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  sub?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-2 py-10 px-6">
      {icon && (
        <div className="w-12 h-12 rounded-full lq-well flex items-center justify-center text-charcoal-40 mb-1">
          {icon}
        </div>
      )}
      <p className="font-display font-bold text-[14px] text-charcoal-80">{title}</p>
      {sub && <p className="text-[12.5px] text-charcoal-60 max-w-[36ch]">{sub}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`lq-skeleton ${className}`} aria-hidden />;
}

/** One blessed field wrapper: label + control + optional hint. */
export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="lq-label">{label}</span>
      {children}
      {hint && <span className="lq-hint block">{hint}</span>}
    </label>
  );
}

/** iOS-style switch. A real checkbox underneath — works in plain form posts. */
export function Toggle({
  label,
  sub,
  ...input
}: { label?: React.ReactNode; sub?: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  const control = (
    <span className="lq-switch">
      <input type="checkbox" {...input} />
      <i aria-hidden />
    </span>
  );
  if (!label) return control;
  return (
    <label className="flex items-center justify-between gap-4 py-1 cursor-pointer select-none">
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold text-ink leading-snug">{label}</span>
        {sub && <span className="block text-[12px] text-charcoal-60 mt-0.5">{sub}</span>}
      </span>
      {control}
    </label>
  );
}

/* ------------------------------------------------------------- overlays */

function useLockScroll(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);
}

function useEscape(onClose: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose, active]);
}

/* Overlays render through a body portal (a rule of the road). Rendered inline,
   their fixed scrim/panel gets trapped by any ancestor that creates a
   containing block — page entrance animations (lq-rise) do exactly that — so
   the scrim dimmed/blurred only the content column instead of the viewport. */
function BodyPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

/** Bottom sheet (mobile-first). Swipe-down or scrim tap to dismiss. */
export function Sheet({
  open,
  onClose,
  children,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  useLockScroll(open);
  useEscape(onClose, open);
  const startY = useRef<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  if (!open) return null;
  return (
    <BodyPortal>
      <div className="lq-scrim" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        className={`lq-sheet lq-chrome ${className}`}
        onTouchStart={(e) => {
          if (ref.current && ref.current.scrollTop <= 0) startY.current = e.touches[0].clientY;
        }}
        onTouchMove={(e) => {
          if (startY.current == null || !ref.current) return;
          const dy = e.touches[0].clientY - startY.current;
          if (dy > 0) ref.current.style.transform = `translateY(${Math.pow(dy, 0.86)}px)`;
        }}
        onTouchEnd={(e) => {
          if (startY.current == null || !ref.current) return;
          const dy = e.changedTouches[0].clientY - startY.current;
          ref.current.style.transform = "";
          startY.current = null;
          if (dy > 90) onClose();
        }}
      >
        <div className="lq-sheet__handle" />
        {children}
      </div>
    </BodyPortal>
  );
}

/** Centered modal on desktop; becomes a bottom sheet under 640px (CSS). */
export function Modal({
  open,
  onClose,
  children,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  useLockScroll(open);
  useEscape(onClose, open);
  if (!open) return null;
  return (
    <BodyPortal>
      <div className="lq-scrim" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" className={`lq-modal lq-chrome ${className}`}>
        {children}
      </div>
    </BodyPortal>
  );
}

/* --------------------------------------------------------------- toasts */

type Toast = { id: number; text: React.ReactNode; action?: { label: string; run: () => void } };
const ToastCtx = createContext<{ toast: (t: Omit<Toast, "id">) => void } | null>(null);

export function useToast() {
  const ctx = useContext(ToastCtx);
  return ctx ?? { toast: () => {} };
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const idRef = useRef(1);
  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = idRef.current++;
    setItems((xs) => [...xs.slice(-2), { ...t, id }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 5000);
  }, []);
  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div
        className="fixed z-[120] inset-inline-0 flex flex-col items-center gap-2 pointer-events-none"
        style={{ bottom: "calc(84px + env(safe-area-inset-bottom, 0px))", insetInline: 0 }}
      >
        {items.map((t) => (
          <div key={t.id} className="lq-toast lq-chrome pointer-events-auto">
            <span>{t.text}</span>
            {t.action && (
              <button
                type="button"
                className="font-display font-bold text-orange-deep lq-press"
                onClick={() => {
                  t.action!.run();
                  setItems((xs) => xs.filter((x) => x.id !== t.id));
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
