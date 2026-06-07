"use client";

import { useEffect, useRef, useState } from "react";
import { MARKER_CONTENT, type Lang, type SiteContent } from "@/lib/content";
import { CinematicHero } from "@/components/ui/cinematic-landing-hero";

const LOGO = "/assets/logo-primary-transparent.png";

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}

/* Scroll-reveal wrapper — fades + lifts a section into view once. */
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

// Nav items map to section anchors, by index, matching content order.
const NAV_HREFS = ["#work", "#services", "#studio", "#faq", "#contact"];

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

  return (
    <header className="ms-header">
      <div className="ms-container ms-header__inner">
        <a className="ms-logo" href="#top" onClick={() => setMenuOpen(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="Marker Studio" />
        </a>
        <nav className={`ms-nav ${menuOpen ? "is-open" : ""}`}>
          {t.nav.map((item, i) => (
            <a
              key={item}
              href={NAV_HREFS[i] || "#top"}
              onClick={() => setMenuOpen(false)}
            >
              {item}
            </a>
          ))}
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
          <a href="#contact" className="ms-btn ms-btn-primary ms-cta-desktop">
            {t.cta.primary} <span>{t.cta.arrow}</span>
          </a>
          <button
            className={`ms-burger ${menuOpen ? "is-open" : ""}`}
            aria-label="Menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span />
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
      cardHeading={h.cardHeading}
      cardDescription={h.cardDescription}
      metricValue={h.metricValue}
      metricLabel={h.metricLabel}
      ctaHeading={h.ctaHeading}
      ctaDescription={h.ctaDescription}
      ctaPrimary={t.cta.primary}
      ctaSecondary={t.cta.secondary}
      arrow={t.cta.arrow}
      phoneToday={h.phoneToday}
      phoneTitle={h.phoneTitle}
      phoneInitials={h.phoneInitials}
      badges={h.badges}
    />
  );
}

/* Infinite logo/client marquee — the brands we've marked, on loop. */
function ClientsMarquee({ t }: { t: SiteContent }) {
  const row = [...t.clients.items, ...t.clients.items];
  return (
    <section className="ms-clients" aria-label={t.clients.title}>
      <div className="ms-container">
        <div className="ms-clients__head">
          <span className="ms-section__eyebrow">{t.clients.eyebrow}</span>
          <h2 className="ms-clients__title">{t.clients.title}</h2>
        </div>
      </div>
      <div className="ms-marquee">
        <div className="ms-marquee__track">
          {row.map((c, i) => (
            <div className="ms-chip" key={`${c.name}-${i}`} title={c.name}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="ms-chip__logo" src={c.logo} alt={c.name} loading="lazy" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WorkGrid({ t }: { t: SiteContent }) {
  const layout = ["lg", "sm", "sm", "md", "md"];
  return (
    <section className="ms-section ms-section--cream" id="work">
      <div className="ms-container">
        <div className="ms-section__header">
          <div>
            <span className="ms-section__eyebrow">{t.work.eyebrow}</span>
            <h2 className="ms-section__title">{t.work.title}</h2>
            <p className="ms-section__sub">{t.work.sub}</p>
          </div>
          <button className="ms-btn ms-btn-outline">
            {t.cta.secondary} <span>{t.cta.arrow}</span>
          </button>
        </div>
        <div className="ms-work-grid">
          {t.work.items.map((item, i) => (
            <Reveal
              key={i}
              delay={i * 60}
              className={`ms-work-card ms-work-card--${layout[i] || "md"}`}
            >
              <div
                className="ms-work-card__media"
                style={{ background: item.color }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="ms-work-card__logo" src={item.logo} alt={item.title} loading="lazy" />
              </div>
              <div className="ms-work-card__body">
                <span className="ms-work-card__tag">{item.tag}</span>
                <h3 className="ms-work-card__title">{item.title}</h3>
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
          <div>
            <span className="ms-section__eyebrow">{t.services.eyebrow}</span>
            <h2 className="ms-section__title">{t.services.title}</h2>
          </div>
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
              <span className="brushed brushed--bold">{t.studio.title[1]}</span>{" "}
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
          <div>
            <span className="ms-section__eyebrow">{t.metrics.eyebrow}</span>
            <h2 className="ms-section__title">{t.metrics.title}</h2>
            <p className="ms-section__sub">{t.metrics.sub}</p>
          </div>
        </div>
        <div className="ms-metrics">
          {t.metrics.items.map((m, i) => (
            <Reveal key={m.label} delay={i * 80} className="ms-metric">
              <div className="ms-metric__label">{m.label}</div>
              <div className="ms-metric__value">{m.value}</div>
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
          <div>
            <span className="ms-section__eyebrow">{t.testimonials.eyebrow}</span>
            <h2 className="ms-section__title">{t.testimonials.title}</h2>
          </div>
        </div>
        <div className="ms-quotes">
          {t.testimonials.items.map((q, i) => (
            <Reveal key={i} delay={i * 90} className="ms-quote">
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
          <div>
            <span className="ms-section__eyebrow">{t.process.eyebrow}</span>
            <h2 className="ms-section__title">{t.process.title}</h2>
          </div>
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
          <div>
            <span className="ms-section__eyebrow">{t.faq.eyebrow}</span>
            <h2 className="ms-section__title">{t.faq.title}</h2>
            <p className="ms-section__sub">{t.faq.sub}</p>
          </div>
        </div>
        <div className="ms-faq">
          {t.faq.items.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={i} className={`ms-faq__item ${isOpen ? "is-open" : ""}`}>
                <button
                  className="ms-faq__q"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? -1 : i)}
                >
                  <span>{item.q}</span>
                  <span className="ms-faq__sign" aria-hidden>
                    {isOpen ? "−" : "+"}
                  </span>
                </button>
                <div className="ms-faq__a" hidden={!isOpen}>
                  <p>{item.a}</p>
                </div>
              </div>
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
            <a href="#contact" className="ms-btn ms-btn-dark">
              {t.ctaBanner.button} <span>{t.cta.arrow}</span>
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function ContactBlock({ t }: { t: SiteContent }) {
  return (
    <section className="ms-section ms-section--dark" id="contact">
      <div className="ms-container">
        <div className="ms-contact">
          <div>
            <span className="ms-section__eyebrow">{t.contact.eyebrow}</span>
            <h2 className="ms-contact__big">
              {t.contact.title[0]}
              <br />
              <span className="brushed brushed--bold">{t.contact.title[1]}</span>
            </h2>
            <p className="ms-contact__sub">{t.contact.sub}</p>
            <div className="ms-contact__info">
              <div>📧 {t.footer.contact.email}</div>
              <div>📞 {t.footer.contact.phone}</div>
              <div>📍 {t.footer.contact.addr}</div>
            </div>
          </div>
          <form className="ms-contact__form" onSubmit={(e) => e.preventDefault()}>
            <div className="ms-contact__field">
              <label>{t.contact.form.name}</label>
              <input type="text" placeholder="Elias Boulos" />
            </div>
            <div className="ms-contact__field">
              <label>{t.contact.form.email}</label>
              <input type="email" placeholder="you@brand.com" />
            </div>
            <div className="ms-contact__field">
              <label>{t.contact.form.brand}</label>
              <input type="text" placeholder="Aurora Goods" />
            </div>
            <div className="ms-contact__field">
              <label>{t.contact.form.service}</label>
              <select>
                {t.contact.form.serviceOptions.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="ms-contact__field">
              <label>{t.contact.form.message}</label>
              <textarea placeholder="…" />
            </div>
            <button
              type="submit"
              className="ms-btn ms-btn-primary"
              style={{ width: "100%", justifyContent: "center" }}
            >
              {t.contact.form.submit} <span>{t.cta.arrow}</span>
            </button>
          </form>
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

export default function MarkerSite() {
  const [lang, setLang] = useState<Lang>("en");
  const t = MARKER_CONTENT[lang];

  useEffect(() => {
    document.documentElement.dir = t.dir;
    document.documentElement.lang = lang;
    document.body.className = t.bodyClass;
  }, [lang, t]);

  return (
    <div id="top" data-screen-label={lang === "en" ? "Marker Site (EN)" : "Marker Site (AR)"}>
      <SiteHeader lang={lang} setLang={setLang} t={t} />
      <main>
        <Hero t={t} />
        <ClientsMarquee t={t} />
        <WorkGrid t={t} />
        <ServicesGrid t={t} />
        <StudioBlock t={t} />
        <MetricStrip t={t} />
        <Testimonials t={t} />
        <ProcessSteps t={t} />
        <FaqAccordion t={t} />
        <CtaBanner t={t} />
        <ContactBlock t={t} />
      </main>
      <SiteFooter t={t} />
    </div>
  );
}
