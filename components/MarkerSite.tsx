"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MARKER_CONTENT, type Lang, type SiteContent } from "@/lib/content";
import { CinematicHero } from "@/components/ui/cinematic-landing-hero";
import { PixelLogoGrid } from "@/components/ui/pixel-logo-grid";
import Pricing from "@/components/Pricing";
import ContactForm from "@/components/ContactForm";
import { useLang } from "@/lib/useLang";
import { type Project } from "@/lib/projects";

const LOGO = "/assets/logo-primary-transparent.png";

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}

/* Scroll-reveal wrapper — animates a section into view once. The default is
   a fade + lift; variants give sections their own personality:
   "wipe" sweeps in like a marker stroke, "zoom" settles in from 96%. */
function Reveal({
  children,
  className = "",
  delay = 0,
  variant,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  variant?: "wipe" | "zoom";
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
      className={`ms-reveal ${variant ? `ms-reveal--${variant}` : ""} ${shown ? "is-visible" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* Counts a formatted stat (e.g. "+1,353%", "445K", "87,606") up from zero the
   first time it scrolls into view. Prefix, suffix, decimals, and digit
   grouping are preserved; renders the plain value when the string has no
   number or the user prefers reduced motion. */
function CountUp({ value, duration = 1400 }: { value: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const m = value.match(/[\d,]*\d(?:\.\d+)?/);
    if (
      !m ||
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const num = m[0];
    const target = parseFloat(num.replace(/,/g, ""));
    const decimals = (num.split(".")[1] || "").length;
    const grouped = num.includes(",");
    const prefix = value.slice(0, m.index);
    const suffix = value.slice((m.index ?? 0) + num.length);
    const fmt = (n: number) =>
      prefix +
      (grouped ? Math.round(n).toLocaleString("en-US") : n.toFixed(decimals)) +
      suffix;

    let raf = 0;
    const run = () => {
      const t0 = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(target * eased);
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    el.textContent = fmt(0);
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            run();
            io.disconnect();
          }
        });
      },
      { threshold: 0.6 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, duration]);

  return <span ref={ref}>{value}</span>;
}

/* Magnetic hover — the wrapped element leans toward the cursor and springs
   back on leave. Fine pointers only; inert for touch and reduced motion. */
function Magnetic({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (
      !window.matchMedia?.("(pointer: fine)").matches ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    let raf = 0;
    let tx = 0, ty = 0, cx = 0, cy = 0;
    const render = () => {
      cx += (tx - cx) * 0.2;
      cy += (ty - cy) * 0.2;
      el.style.transform = `translate(${cx.toFixed(2)}px, ${cy.toFixed(2)}px)`;
      if (Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1) {
        raf = requestAnimationFrame(render);
      } else {
        raf = 0;
      }
    };
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      tx = Math.max(-10, Math.min(10, (e.clientX - (r.left + r.width / 2)) * 0.22));
      ty = Math.max(-8, Math.min(8, (e.clientY - (r.top + r.height / 2)) * 0.34));
      if (!raf) raf = requestAnimationFrame(render);
    };
    const onLeave = () => {
      tx = 0;
      ty = 0;
      if (!raf) raf = requestAnimationFrame(render);
    };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <span ref={ref} className={`ms-magnetic ${className}`}>
      {children}
    </span>
  );
}

/* Page scroll progress — a thin orange marker line drawing across the very
   top of the viewport as you read. Hidden by CSS under reduced motion. */
function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      el.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return <div ref={ref} className="ms-progress" aria-hidden />;
}

// Nav items map to section anchors, by index, matching content order.
const NAV_HREFS = ["#work", "#services", "#studio", "#faq", "#contact"];

/* The Marker V — the mark alone, crisp at any size (inline SVG, brand orange). */
function MarkerMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={Math.round(size * (516 / 613))} height={size} viewBox="0 0 516.1 613.64" aria-hidden focusable="false">
      <path
        fill="#FF9100"
        d="M172.3,466.08l55.16,146.24c33.35-48.73,65.82-97.46,97.54-146.24h-152.7ZM310.85,354.75L172.89,0H0l164.41,435.83h176.65c60.58-94.11,118.46-188.47,174.94-283.54l-205.14,202.46Z"
      />
    </svg>
  );
}

/* Menu icons — one stroke glyph per nav item (shown in the mobile menu). */
const NAV_ICONS = [
  <svg key="work" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>,
  <svg key="services" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l1.9 5.6L20 10l-6.1 1.4L12 17l-1.9-5.6L4 10l6.1-1.4L12 3z" /></svg>,
  <svg key="studio" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="8" r="3.5" /><path d="M3 20c0-3 2.7-5 6-5s6 2 6 5" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21 20c0-2.5-1.8-4.2-4.3-4.8" /></svg>,
  <svg key="faq" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 3h9l5 5v13H6z" /><path d="M14 3v6h6M9 13h7M9 17h5" /></svg>,
  <svg key="contact" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></svg>,
];
const CAREERS_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 12h18" /></svg>
);

function SiteHeader({
  lang,
  setLang,
  t,
}: {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: SiteContent;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState("");

  // Compact the header once the page starts scrolling. Hysteresis (engage at
  // 64px, release under 8px): compacting shrinks the sticky header, which
  // shifts scrollY — a single threshold flickers right at the boundary.
  useEffect(() => {
    const onScroll = () => setScrolled((prev) => (prev ? window.scrollY > 8 : window.scrollY > 64));
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Scroll-spy — highlight the nav link of the section crossing mid-viewport.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const sections = NAV_HREFS
      .map((h) => document.getElementById(h.slice(1)))
      .filter((el): el is HTMLElement => Boolean(el));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(`#${e.target.id}`);
        });
      },
      { rootMargin: "-40% 0px -55% 0px" }
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  return (
    <header className={`ms-header ${scrolled ? "is-scrolled" : ""}`}>
      <div className="ms-container ms-header__inner">
        <a className="ms-logo" href="#top" aria-label="Marker Studio" onClick={() => setMenuOpen(false)}>
          <MarkerMark />
        </a>
        <nav className={`ms-nav ${menuOpen ? "is-open" : ""}`}>
          {t.nav.map((item, i) => (
            <a
              key={item}
              href={NAV_HREFS[i] || "#top"}
              className={active === NAV_HREFS[i] ? "active" : ""}
              onClick={() => setMenuOpen(false)}
            >
              <span className="ms-nav__ic">{NAV_ICONS[i]}</span>
              {item}
            </a>
          ))}
          <Link href="/careers" onClick={() => setMenuOpen(false)}>
            <span className="ms-nav__ic">{CAREERS_ICON}</span>
            {lang === "ar" ? "الوظائف" : "Careers"}
          </Link>
          <div className="ms-nav__foot">
            <Link href="/login" className="ms-btn ms-btn-primary ms-nav__loginbtn" onClick={() => setMenuOpen(false)}>
              {t.cta.login}
            </Link>
          </div>
        </nav>
        <div className="ms-actions">
          <div className="ms-lang" role="group" aria-label="Language">
            <button className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>
              EN
            </button>
            <button className={lang === "ar" ? "on" : ""} onClick={() => setLang("ar")}>
              ع
            </button>
          </div>
          <Link href="/login" className="ms-login" aria-label={t.cta.login} title={t.cta.login}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" />
            </svg>
          </Link>
          <Magnetic className="ms-cta-desktop">
            <a href="#contact" className="ms-btn ms-btn-primary">
              {t.cta.primary} <span>{t.cta.arrow}</span>
            </a>
          </Magnetic>
          <button
            className={`ms-burger ${menuOpen ? "is-open" : ""}`}
            aria-label="Menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span />
            <span />
          </button>
        </div>
      </div>
    </header>
  );
}

/* Cinematic scroll-driven hero (GSAP) — wired to bilingual content. */
function Hero({ t }: { t: SiteContent }) {
  const h = t.heroCine;
  return (
    <CinematicHero
      dir={t.dir}
      brandName={h.brandName}
      tagline1={h.tagline1}
      tagline2={h.tagline2}
      tagline2Brush={h.tagline2Brush}
      cardHeading={h.cardHeading}
      cardDescription={h.cardDescription}
      metricValue={h.metricValue}
      metricLabel={h.metricLabel}
      ctaHeading={h.ctaHeading}
      ctaHeadingBrush={h.ctaHeadingBrush}
      ctaDescription={h.ctaDescription}
      ctaPrimary={t.cta.primary}
      ctaSecondary={t.cta.secondary}
      arrow={t.cta.arrow}
      phoneToday={h.phoneToday}
      phoneTitle={h.phoneTitle}
      phoneChartLabel={h.phoneChartLabel}
      phoneInitials={h.phoneInitials}
      phonePlainTitle={h.phonePlainTitle}
      phoneStats={h.phoneStats}
      badges={h.badges}
      scrollHint={t.dir === "rtl" ? "مرّر للأسفل" : "Scroll"}
      swipeHint={t.dir === "rtl" ? "اسحب للأسفل" : "Swipe down"}
    />
  );
}

/* Client showcase — the brands we've marked, in a pixel-shimmer logo grid. */
function ClientsMarquee({ t }: { t: SiteContent }) {
  return (
    <PixelLogoGrid
      badge={t.clients.eyebrow}
      heading={t.clients.title}
      items={t.clients.items}
    />
  );
}

function WorkGrid({ t, lang, projects }: { t: SiteContent; lang: Lang; projects: Project[] }) {
  // Repeating bento rhythm whose groups each fill the 6-column grid exactly
  // ([lg+sm]=6, [md+md]=6, [sm+sm+sm]=6), so any number of projects tiles
  // cleanly with no internal gaps.
  const pattern = ["lg", "sm", "md", "md", "sm", "sm", "sm"];
  return (
    <section className="ms-section ms-section--cream" id="work">
      <div className="ms-container">
        <div className="ms-section__header">
          <Reveal>
            <span className="ms-section__eyebrow">{t.work.eyebrow}</span>
            <h2 className="ms-section__title">{t.work.title}</h2>
            <p className="ms-section__sub">{t.work.sub}</p>
          </Reveal>
        </div>
        <div className="ms-work-grid">
          {projects.map((p, i) => (
            <Reveal
              key={p.slug}
              delay={i * 60}
              variant="wipe"
              className={`ms-work-card ms-work-card--${pattern[i % pattern.length]}`}
            >
              <Link href={`/work/${p.slug}`} className="ms-work-card__link" aria-label={p.name[lang]} />
              <div
                className="ms-work-card__media"
                style={{ background: p.color }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={`ms-work-card__logo${p.keepLogoColor ? " ms-pj-logo--color" : ""}`} src={p.logo} alt={p.name[lang]} loading="lazy" />
              </div>
              <div className="ms-work-card__body">
                <span className="ms-work-card__tag">{p.tag[lang]}</span>
                <h3 className="ms-work-card__title">{p.name[lang]}</h3>
                <span className="ms-work-card__cta" aria-hidden>
                  {lang === "ar" ? "اعرض المشروع" : "View project"}
                  <ArrowIcon />
                </span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function ServicesGrid({ t }: { t: SiteContent }) {
  return (
    <section className="ms-section" id="services">
      <div className="ms-container">
        <div className="ms-section__header">
          <Reveal>
            <span className="ms-section__eyebrow">{t.services.eyebrow}</span>
            <h2 className="ms-section__title">{t.services.title}</h2>
          </Reveal>
        </div>
        <div className="ms-services">
          {t.services.items.map((s, i) => (
            <Reveal key={s.num} delay={i * 80} className="ms-service">
              <div className="ms-service__num">{s.num}</div>
              <h3 className="ms-service__title">{s.title}</h3>
              <p className="ms-service__desc">{s.desc}</p>
              <a className="ms-service__link" href="#">
                {t.services.link}
                <ArrowIcon />
              </a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* Studio story + a small showcase of the live logo marks. */
function StudioBlock({ t }: { t: SiteContent }) {
  return (
    <section className="ms-section ms-section--cream" id="studio">
      <div className="ms-container">
        <div className="ms-studio">
          <Reveal className="ms-studio__copy">
            <span className="ms-section__eyebrow">{t.studio.eyebrow}</span>
            <h2 className="ms-studio__title">
              {t.studio.title[0]}{" "}
              <span className="brushed brushed--bold brush-draw">{t.studio.title[1]}</span>{" "}
              {t.studio.title[2]}
            </h2>
            {t.studio.body.map((p, i) => (
              <p key={i} className="ms-studio__p">
                {p}
              </p>
            ))}
          </Reveal>
          <Reveal className="ms-studio__marks" delay={120}>
            {t.studio.logos.map((l) => (
              <div
                key={l.label}
                className={`ms-mark ${l.dark ? "ms-mark--dark" : ""}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={l.src} alt={l.label} />
                <span className="ms-mark__label">{l.label}</span>
              </div>
            ))}
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function MetricStrip({ t }: { t: SiteContent }) {
  return (
    <section className="ms-section ms-section--dark">
      <div className="ms-container">
        <div className="ms-section__header">
          <Reveal>
            <span className="ms-section__eyebrow">{t.metrics.eyebrow}</span>
            <h2 className="ms-section__title">{t.metrics.title}</h2>
            <p className="ms-section__sub">{t.metrics.sub}</p>
          </Reveal>
        </div>
        <div className="ms-metrics">
          {t.metrics.items.map((m, i) => (
            <Reveal key={m.label} delay={i * 80} className="ms-metric">
              <div className="ms-metric__label">{m.label}</div>
              <div className="ms-metric__value">
                <CountUp value={m.value} duration={1200 + i * 200} />
              </div>
              <div className="ms-metric__delta">{m.delta}</div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* Testimonials — what it's like to be marked. */
function Testimonials({ t }: { t: SiteContent }) {
  return (
    <section className="ms-section">
      <div className="ms-container">
        <div className="ms-section__header">
          <Reveal>
            <span className="ms-section__eyebrow">{t.testimonials.eyebrow}</span>
            <h2 className="ms-section__title">{t.testimonials.title}</h2>
          </Reveal>
        </div>
        <div className="ms-quotes">
          {t.testimonials.items.map((q, i) => (
            <Reveal key={i} delay={i * 90} variant="zoom" className="ms-quote">
              <div className="ms-quote__mark">”</div>
              <p className="ms-quote__text">{q.quote}</p>
              <div className="ms-quote__by">
                <span className="ms-quote__name">{q.name}</span>
                <span className="ms-quote__role">{q.role}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProcessSteps({ t }: { t: SiteContent }) {
  return (
    <section className="ms-section ms-section--cream">
      <div className="ms-container">
        <div className="ms-section__header">
          <Reveal>
            <span className="ms-section__eyebrow">{t.process.eyebrow}</span>
            <h2 className="ms-section__title">{t.process.title}</h2>
          </Reveal>
        </div>
        <div className="ms-process">
          {t.process.items.map((s, i) => (
            <Reveal key={s.num} delay={i * 80} className="ms-step">
              <div className="ms-step__num">{s.num}</div>
              <h3 className="ms-step__title">{s.title}</h3>
              <p className="ms-step__desc">{s.desc}</p>
              <span className="ms-step__bar" />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* FAQ — interactive accordion. */
function FaqAccordion({ t }: { t: SiteContent }) {
  const [open, setOpen] = useState(0);
  return (
    <section className="ms-section" id="faq">
      <div className="ms-container">
        <div className="ms-section__header">
          <Reveal>
            <span className="ms-section__eyebrow">{t.faq.eyebrow}</span>
            <h2 className="ms-section__title">{t.faq.title}</h2>
            <p className="ms-section__sub">{t.faq.sub}</p>
          </Reveal>
        </div>
        <div className="ms-faq">
          {t.faq.items.map((item, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={i} delay={i * 50}>
                <div className={`ms-faq__item ${isOpen ? "is-open" : ""}`}>
                  <button
                    className="ms-faq__q"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? -1 : i)}
                  >
                    <span>{item.q}</span>
                    <span className="ms-faq__sign" aria-hidden>
                      +
                    </span>
                  </button>
                  {/* Animated via the 0fr → 1fr grid-row trick in globals.css */}
                  <div className="ms-faq__a" aria-hidden={!isOpen}>
                    <div className="ms-faq__a-inner">
                      <p>{item.a}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* Full-bleed orange call-to-action before contact. */
function CtaBanner({ t }: { t: SiteContent }) {
  return (
    <section className="ms-section ms-section--orange ms-cta-banner">
      <div className="ms-container">
        <Reveal className="ms-cta-banner__inner">
          <h2 className="ms-cta-banner__title">
            {t.ctaBanner.title[0]} <br />
            {t.ctaBanner.title[1]}
          </h2>
          <div className="ms-cta-banner__side">
            <p className="ms-cta-banner__sub">{t.ctaBanner.sub}</p>
            <Magnetic>
              <a href="#contact" className="ms-btn ms-btn-dark">
                {t.ctaBanner.button} <span>{t.cta.arrow}</span>
              </a>
            </Magnetic>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function ContactBlock({ t, lang }: { t: SiteContent; lang: Lang }) {
  return (
    <section className="ms-section ms-section--dark" id="contact">
      <div className="ms-container">
        <div className="ms-contact">
          <Reveal>
            <span className="ms-section__eyebrow">{t.contact.eyebrow}</span>
            <h2 className="ms-contact__big">
              {t.contact.title[0]}
              <br />
              <span className="brushed brushed--bold brush-draw">{t.contact.title[1]}</span>
            </h2>
            <p className="ms-contact__sub">{t.contact.sub}</p>
            <div className="ms-contact__info">
              <div>📧 {t.footer.contact.email}</div>
              <div>📞 {t.footer.contact.phone}</div>
              <div>📍 {t.footer.contact.addr}</div>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <ContactForm t={t} lang={lang} />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function SiteFooter({ t }: { t: SiteContent }) {
  return (
    <footer className="ms-footer">
      <div className="ms-container">
        <div className="ms-footer__top">
          <div className="ms-footer__brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO} alt="Marker Studio" />
            <p className="ms-footer__tagline">{t.footer.tagline}</p>
            <div className="ms-footer__contact">
              <div>{t.footer.contact.email}</div>
              <div>{t.footer.contact.phone}</div>
              <div>{t.footer.contact.addr}</div>
            </div>
          </div>
          {t.footer.cols.map((col) => (
            <div key={col.title}>
              <h6>{col.title}</h6>
              <ul>
                {col.items.map((it) => (
                  <li key={it}>
                    <a href="#">{it}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="ms-footer__bottom">
          <span>{t.footer.copy}</span>
          <span>{t.footer.contact.web}</span>
        </div>
      </div>
    </footer>
  );
}

export default function MarkerSite({ projects }: { projects: Project[] }) {
  const [lang, setLang] = useLang();
  const t = MARKER_CONTENT[lang];

  // Paint .brush-draw strokes in once they reach the viewport (the hero runs
  // its own GSAP-driven strokes and is not tagged with this class).
  useEffect(() => {
    const els = Array.from(document.querySelectorAll(".brush-draw"));
    if (!els.length) return;
    if (typeof IntersectionObserver === "undefined") {
      els.forEach((el) => el.classList.add("is-inked"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-inked");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.5 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [lang]);

  return (
    <div id="top" data-screen-label={lang === "en" ? "Marker Site (EN)" : "Marker Site (AR)"}>
      <ScrollProgress />
      <SiteHeader lang={lang} setLang={setLang} t={t} />
      <main>
        <Hero t={t} />
        <ClientsMarquee t={t} />
        <WorkGrid t={t} lang={lang} projects={projects} />
        <ServicesGrid t={t} />
        <Pricing t={t} />
        <StudioBlock t={t} />
        <MetricStrip t={t} />
        <Testimonials t={t} />
        <ProcessSteps t={t} />
        <FaqAccordion t={t} />
        <CtaBanner t={t} />
        <ContactBlock t={t} lang={lang} />
      </main>
      <SiteFooter t={t} />
    </div>
  );
}
