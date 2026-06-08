"use client";

import { useEffect, useRef, useState } from "react";
import { type SiteContent } from "@/lib/content";

/* Currency table — amounts are authored in USD in content.ts, then converted
   and rounded to a tidy step per currency. Rates are intentionally simple to
   edit; the studio quotes the real figure anyway. */
const CURRENCIES = [
  { code: "USD", symbol: "$", rate: 1, round: 10 },
  { code: "ILS", symbol: "₪", rate: 3.6, round: 50 },
  { code: "EUR", symbol: "€", rate: 0.92, round: 10 },
] as const;

function convert(usd: number, code: string): { symbol: string; amount: number } {
  const c = CURRENCIES.find((x) => x.code === code) ?? CURRENCIES[0];
  const amount = Math.round((usd * c.rate) / c.round) * c.round;
  return { symbol: c.symbol, amount };
}

/* Count-up number — a lightweight stand-in for @number-flow, so the price
   animates when you switch category or currency without pulling in a dep. */
function useCountUp(value: number, duration = 550): number {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const displayRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    const diff = value - from;
    if (diff === 0) return;

    if (typeof window === "undefined" || typeof requestAnimationFrame === "undefined") {
      fromRef.current = value;
      displayRef.current = value;
      setDisplay(value);
      return;
    }

    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const next = Math.round(from + diff * eased);
      displayRef.current = next;
      setDisplay(next);
      if (t < 1) raf = requestAnimationFrame(tick);
      else {
        fromRef.current = value;
        displayRef.current = value;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      fromRef.current = displayRef.current; // resume from where we stopped
    };
  }, [value, duration]);

  return display;
}

/* Sliding pill toggle — the template's PricingSwitch, rebuilt with logical
   properties so the indicator tracks correctly in both LTR and RTL. */
function PillToggle({
  options,
  selected,
  onSelect,
}: {
  options: string[];
  selected: number;
  onSelect: (i: number) => void;
}) {
  const pad = 5;
  const n = options.length;
  return (
    <div
      className="ms-toggle"
      style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}
    >
      <span
        className="ms-toggle__ind"
        aria-hidden
        style={{
          top: pad,
          bottom: pad,
          width: `calc((100% - ${2 * pad}px) / ${n})`,
          insetInlineStart: `calc(${pad}px + ${selected} * ((100% - ${2 * pad}px) / ${n}))`,
        }}
      />
      {options.map((label, i) => (
        <button
          key={label}
          type="button"
          onClick={() => onSelect(i)}
          className={`ms-toggle__btn ${selected === i ? "on" : ""}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9L12 2z" />
    </svg>
  );
}

export default function Pricing({ t }: { t: SiteContent }) {
  const p = t.pricing;
  const [cat, setCat] = useState(0);
  const [cur, setCur] = useState(0);

  const category = p.categories[cat];
  const { symbol, amount } = convert(category.base, CURRENCIES[cur].code);
  const animated = useCountUp(amount);

  return (
    <section className="ms-section ms-pricing" id="pricing">
      <div className="ms-pricing__bg" aria-hidden />
      <div className="ms-container ms-pricing__inner">
        <div className="ms-pricing__head">
          <span className="ms-pricing__eyebrow">
            <SparkIcon />
            {p.eyebrow}
          </span>
          <h2 className="ms-pricing__title">
            {p.title[0]} <span className="brushed brushed--bold">{p.title[1]}</span>
          </h2>
          <p className="ms-pricing__sub">{p.sub}</p>
        </div>

        <div className="ms-pricing__switch">
          <PillToggle
            options={p.categories.map((c) => c.label)}
            selected={cat}
            onSelect={setCat}
          />
        </div>

        <div className="ms-pricing__panel">
          <div className="ms-pricing__inside">
            <h3 className="ms-pricing__inside-title">{p.insideLabel}</h3>
            <ul className="ms-pricing__features">
              {category.features.map((f) => (
                <li key={f} className="ms-pricing__feature">
                  <span className="ms-pricing__feature-ico" aria-hidden>
                    <CheckIcon />
                  </span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="ms-pricing__aside">
            <div className="ms-pricing__cur">
              <span className="ms-pricing__cur-label">{p.currencyLabel}</span>
              <PillToggle
                options={CURRENCIES.map((c) => c.code)}
                selected={cur}
                onSelect={setCur}
              />
            </div>

            <div className="ms-pricing__price">
              <span className="ms-pricing__from">{p.fromLabel}</span>
              <div className="ms-pricing__amount-row">
                <span className="ms-pricing__amount">
                  {symbol}
                  {animated.toLocaleString("en-US")}
                </span>
                <span className="ms-pricing__period">{category.period}</span>
              </div>
              <p className="ms-pricing__note">{category.note}</p>
            </div>

            <a href="#contact" className="ms-btn ms-btn-primary ms-pricing__cta">
              {category.cta} <span>{p.arrow}</span>
            </a>

            <p className="ms-pricing__quote-note">{p.quoteNote}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
