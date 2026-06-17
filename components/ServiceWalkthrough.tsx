"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLang } from "@/lib/useLang";
import { MARKER_CONTENT, type Lang } from "@/lib/content";
import { SERVICES, type ServiceDetail } from "@/lib/services";

const LOGO = "/assets/logo-primary-transparent.png";
const HEADER_OFFSET = 96;

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/* Scroll-reveal wrapper — fades + lifts a block into view once. */
function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setShown(true);
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`ms-reveal ${shown ? "is-visible" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export default function ServiceWalkthrough({ service }: { service: ServiceDetail }) {
  const [lang, setLang] = useLang();
  const t = MARKER_CONTENT[lang];
  const isAr = lang === "ar";
  const disp = isAr ? "font-arabic-display" : "font-display";
  const backArrow = isAr ? "→" : "←";

  const labels = {
    en: {
      services: "Services",
      processEyebrow: "How we work",
      processTitle: "The process, step by step.",
      phase: "Phase",
      getWhat: "What you get",
      ctaTitle: "Ready to leave a mark?",
      ctaSub: "Tell us what you're building. We reply to every brief within two working days.",
      quote: "Get a quote",
      more: "Other services",
    },
    ar: {
      services: "الخدمات",
      processEyebrow: "كيف نعمل",
      processTitle: "العملية، خطوةً بخطوة.",
      phase: "مرحلة",
      getWhat: "ما الذي تحصل عليه",
      ctaTitle: "جاهزٌ لترك بصمة؟",
      ctaSub: "أخبرنا بما تبنيه. نردّ على كل طلبٍ خلال يومَي عمل.",
      quote: "اطلب عرض سعر",
      more: "خدمات أخرى",
    },
  }[lang];

  // Active phase tracking for the clickable progress rail.
  const [active, setActive] = useState(0);
  const panelRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const els = panelRefs.current.filter((el): el is HTMLElement => Boolean(el));
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const idx = Number((e.target as HTMLElement).dataset.idx);
            if (!Number.isNaN(idx)) setActive(idx);
          }
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [service.slug]);

  const goToPhase = (i: number) => {
    const el = panelRefs.current[i];
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  const others = SERVICES.filter((s) => s.slug !== service.slug);
  const progress = service.steps.length > 1 ? (active / (service.steps.length - 1)) * 100 : 0;

  return (
    <div dir={isAr ? "rtl" : "ltr"} data-screen-label={`Service · ${service.name[lang]}`} className="bg-paper text-ink">
      {/* ===== Header ===== */}
      <header className="sticky top-0 z-50 border-b border-charcoal-10 bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-container items-center justify-between gap-4 px-[6vw] py-3.5 md:px-8">
          <Link href="/#services" className="inline-flex items-center gap-2 text-sm font-semibold font-display text-charcoal-80 hover:text-ink">
            <span aria-hidden>{backArrow}</span>
            {labels.services}
          </Link>
          <Link href="/" aria-label="Marker Studio">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO} alt="Marker Studio" className="h-7 w-auto" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-1 text-sm font-semibold font-display sm:flex" role="group" aria-label="Language">
              <button className={lang === "en" ? "text-ink" : "text-charcoal-40"} onClick={() => setLang("en" as Lang)}>EN</button>
              <span className="text-charcoal-20">/</span>
              <button className={lang === "ar" ? "text-ink" : "text-charcoal-40"} onClick={() => setLang("ar" as Lang)}>ع</button>
            </div>
            <Link href="/#contact" className="ms-btn ms-btn-primary" style={{ padding: "9px 16px", fontSize: 13, borderRadius: 999 }}>
              {labels.quote} <span>{t.cta.arrow}</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ===== Hero ===== */}
      <section className="mx-auto max-w-container px-[6vw] pt-[clamp(3rem,8vw,6rem)] pb-[clamp(2.5rem,6vw,4.5rem)] md:px-8">
        <Reveal>
          <span className="inline-block text-xs font-bold uppercase tracking-[0.2em] text-orange font-display">
            {service.eyebrow[lang]}
          </span>
          <h1 className={`mt-5 text-[clamp(2.6rem,8vw,6rem)] font-bold leading-[0.9] tracking-tight ${disp}`}>
            {service.name[lang]}
          </h1>
          <p className={`mt-6 max-w-[26ch] text-[clamp(1.3rem,3vw,2rem)] font-semibold leading-snug text-charcoal-80 ${disp}`}>
            {service.tagline[lang]}
          </p>
          <p className="mt-6 max-w-[58ch] text-[clamp(1rem,1.8vw,1.2rem)] leading-relaxed text-charcoal-60 font-body">
            {service.intro[lang]}
          </p>
        </Reveal>
      </section>

      {/* ===== Interactive process walkthrough ===== */}
      <section className="border-t border-charcoal-10 bg-cream">
        <div className="mx-auto max-w-container px-[6vw] py-[clamp(3rem,7vw,5.5rem)] md:px-8">
          <Reveal>
            <span className="ms-section__eyebrow">{labels.processEyebrow}</span>
            <h2 className={`mt-3 text-[clamp(1.8rem,4vw,3rem)] font-bold leading-tight tracking-tight ${disp}`}>
              {labels.processTitle}
            </h2>
          </Reveal>

          <div className="mt-10 grid gap-10 lg:grid-cols-[260px_1fr] lg:gap-16">
            {/* Clickable progress rail (sticky on desktop, horizontal on mobile) */}
            <nav
              aria-label={labels.processEyebrow}
              className="lg:sticky lg:top-28 lg:self-start"
            >
              <ol className="flex gap-2 overflow-x-auto pb-2 lg:relative lg:flex-col lg:gap-0 lg:overflow-visible lg:pb-0">
                {/* Vertical track + animated fill (desktop only) */}
                <span aria-hidden className="pointer-events-none absolute inset-y-2 hidden w-px bg-charcoal-20 lg:block ltr:left-[15px] rtl:right-[15px]" />
                <span
                  aria-hidden
                  className="pointer-events-none absolute top-2 hidden w-px bg-orange transition-[height] duration-500 ease-out lg:block ltr:left-[15px] rtl:right-[15px]"
                  style={{ height: `calc(${progress}% )` }}
                />
                {service.steps.map((step, i) => {
                  const on = i === active;
                  const done = i < active;
                  return (
                    <li key={step.num} className="lg:relative">
                      <button
                        type="button"
                        onClick={() => goToPhase(i)}
                        aria-current={on ? "step" : undefined}
                        className="group flex shrink-0 items-center gap-3 rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors lg:w-full lg:rounded-xl lg:border-0 lg:bg-transparent lg:px-0 lg:py-3"
                        style={{
                          borderColor: on ? "#FF9100" : "#E8E8E8",
                          background: on ? "#FFF4E5" : "transparent",
                        }}
                      >
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold font-display transition-colors ${
                            on || done ? "bg-orange text-white" : "bg-charcoal-10 text-charcoal-60"
                          }`}
                        >
                          {step.num}
                        </span>
                        <span
                          className={`whitespace-nowrap font-display transition-colors lg:whitespace-normal ${
                            on ? "text-ink" : "text-charcoal-60 group-hover:text-ink"
                          }`}
                        >
                          {step.title[lang]}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </nav>

            {/* Phase panels */}
            <div className="flex flex-col gap-5">
              {service.steps.map((step, i) => (
                <article
                  key={step.num}
                  ref={(el) => {
                    panelRefs.current[i] = el;
                  }}
                  data-idx={i}
                  id={`phase-${i + 1}`}
                  style={{ scrollMarginTop: HEADER_OFFSET }}
                >
                  <Reveal>
                    <div className="rounded-2xl border border-charcoal-10 bg-paper p-7 transition-shadow md:p-10">
                      <div className="flex items-baseline gap-4">
                        <span className={`text-[clamp(2.5rem,6vw,4rem)] font-bold leading-none text-orange-200 ${disp}`}>
                          {step.num}
                        </span>
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-charcoal-40 font-display">
                            {labels.phase} {i + 1}
                          </span>
                          <h3 className={`text-[clamp(1.5rem,3vw,2.25rem)] font-bold leading-tight tracking-tight ${disp}`}>
                            {step.title[lang]}
                          </h3>
                        </div>
                      </div>
                      <p className="mt-5 max-w-[60ch] text-[clamp(1rem,1.6vw,1.15rem)] leading-relaxed text-charcoal-80 font-body">
                        {step.desc[lang]}
                      </p>
                      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                        {step.bullets.map((b) => (
                          <li key={b[lang]} className="flex items-center gap-3 text-[0.95rem] font-medium text-charcoal-80 font-body">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange [&>svg]:h-3 [&>svg]:w-3">
                              <CheckIcon />
                            </span>
                            {b[lang]}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </Reveal>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== What you get ===== */}
      <section className="mx-auto max-w-container px-[6vw] py-[clamp(3rem,7vw,5rem)] md:px-8">
        <Reveal>
          <span className="ms-section__eyebrow">{labels.getWhat}</span>
          <p className={`mt-4 max-w-[40ch] text-[clamp(1.3rem,3vw,2rem)] font-semibold leading-snug ${disp}`}>
            {service.outcome[lang]}
          </p>
        </Reveal>
        <div className="mt-8 flex flex-wrap gap-3">
          {service.deliverables.map((d, i) => (
            <Reveal key={d[lang]} delay={i * 50}>
              <span className="inline-flex items-center gap-2.5 rounded-full border border-charcoal-10 bg-cream px-4 py-2.5 text-sm font-semibold text-charcoal-80 font-display">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange text-white [&>svg]:h-3 [&>svg]:w-3">
                  <CheckIcon />
                </span>
                {d[lang]}
              </span>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===== CTA banner ===== */}
      <section className="bg-orange">
        <div className="mx-auto flex max-w-container flex-col items-start gap-8 px-[6vw] py-[clamp(3rem,7vw,5rem)] md:flex-row md:items-end md:justify-between md:px-8">
          <h2 className={`text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[0.95] tracking-tight text-ink ${disp}`}>
            {labels.ctaTitle}
          </h2>
          <div className="max-w-md">
            <p className="text-[1.05rem] leading-relaxed text-ink/80 font-body">{labels.ctaSub}</p>
            <Link href="/#contact" className="ms-btn ms-btn-dark mt-6">
              {labels.quote} <span>{t.cta.arrow}</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ===== Other services ===== */}
      <section className="mx-auto max-w-container px-[6vw] py-[clamp(3rem,6vw,4.5rem)] md:px-8">
        <span className="ms-section__eyebrow">{labels.more}</span>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {others.map((s) => (
            <Link
              key={s.slug}
              href={`/services/${s.slug}`}
              className="group flex items-center justify-between gap-4 rounded-2xl border border-charcoal-10 bg-cream p-6 transition-colors hover:border-orange"
            >
              <div>
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-charcoal-40 font-display">{s.eyebrow[lang]}</span>
                <h3 className={`mt-1 text-[clamp(1.3rem,2.5vw,1.75rem)] font-bold tracking-tight ${disp}`}>{s.name[lang]}</h3>
              </div>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange text-white transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1 [&>svg]:h-4 [&>svg]:w-4 rtl:[&>svg]:-scale-x-100">
                <ArrowIcon />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="border-t border-charcoal-10 bg-paper">
        <div className="mx-auto flex max-w-container flex-col items-center justify-between gap-3 px-[6vw] py-7 text-sm text-charcoal-60 font-display sm:flex-row md:px-8">
          <span>{t.footer.copy}</span>
          <span>{t.footer.contact.web}</span>
        </div>
      </footer>
    </div>
  );
}
