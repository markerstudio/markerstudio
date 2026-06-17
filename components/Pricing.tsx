"use client";

import { useState } from "react";
import { type SiteContent } from "@/lib/content";

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
    <div className="ms-toggle" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
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
  const category = p.categories[cat];

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

        <div className="ms-pricing__grid" key={category.key}>
          {category.plans.map((plan, i) => (
            <div
              key={plan.name}
              className={`ms-plan ${plan.featured ? "ms-plan--featured" : ""}`}
            >
              {plan.featured && (
                <span className="ms-plan__badge">
                  <SparkIcon />
                  {p.popularLabel}
                </span>
              )}
              <div className="ms-plan__head">
                <span className="ms-plan__meta">{plan.meta}</span>
                <h3 className="ms-plan__name">{plan.name}</h3>
                <p className="ms-plan__tagline">{plan.tagline}</p>
              </div>

              <ul className="ms-plan__features">
                {plan.features.map((f) => (
                  <li key={f} className="ms-plan__feature">
                    <span className="ms-plan__feature-ico" aria-hidden>
                      <CheckIcon />
                    </span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <a
                href={`/onboarding?${category.key === "marketing" ? "marketing" : "branding"}=${i}`}
                className={`ms-btn ms-plan__cta ${
                  plan.featured ? "ms-btn-primary" : "ms-btn-outline"
                }`}
              >
                {p.cta} <span>{p.arrow}</span>
              </a>
            </div>
          ))}
        </div>

        <p className="ms-pricing__quote-note">{p.quoteNote}</p>
      </div>
    </section>
  );
}
