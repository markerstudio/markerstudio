"use client";

import { useEffect, useState } from "react";
import { MARKER_CONTENT, type Lang, type SiteContent } from "@/lib/content";

const LOGO = "/assets/logo-primary-transparent.png";

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}

function SiteHeader({
  lang,
  setLang,
  t,
}: {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: SiteContent;
}) {
  return (
    <header className="ms-header">
      <div className="ms-container ms-header__inner">
        <a className="ms-logo" href="#">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="Marker Studio" />
        </a>
        <nav className="ms-nav">
          {t.nav.map((item, i) => (
            <a key={item} href="#" className={i === 0 ? "active" : ""}>
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
          <button className="ms-btn ms-btn-primary">
            {t.cta.primary} <span>{t.cta.arrow}</span>
          </button>
        </div>
      </div>
    </header>
  );
}

function Hero({ t }: { t: SiteContent }) {
  return (
    <section className="ms-hero">
      <div className="ms-container">
        <div className="ms-hero__eyebrow">{t.hero.eyebrow}</div>
        <h1 className="ms-hero__title">
          {t.hero.title[0]}{" "}
          <span className="brushed brushed--bold">{t.hero.title[1]}</span>{" "}
          {t.hero.title[2]}
          <br />
          {t.hero.title[3]}
        </h1>
        <p className="ms-hero__sub">{t.hero.sub}</p>
        <div className="ms-hero__cta">
          <button className="ms-btn ms-btn-primary">
            {t.cta.primary} <span>{t.cta.arrow}</span>
          </button>
          <button className="ms-btn ms-btn-ghost">
            {t.cta.secondary} <span>{t.cta.arrow}</span>
          </button>
        </div>
        <div className="ms-hero__meta">
          {t.hero.meta.map((m) => (
            <div key={m.label} className="ms-hero__meta-item">
              <div className="ms-hero__meta-num">{m.num}</div>
              <div className="ms-hero__meta-label">{m.label}</div>
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
    <section className="ms-section ms-section--cream">
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
            <div key={i} className={`ms-work-card ms-work-card--${layout[i] || "md"}`}>
              <div
                className="ms-work-card__media"
                style={{
                  background: i % 2 === 0 ? "#FFE3BF" : "#303030",
                  color: i % 2 === 0 ? "#FF9100" : "rgba(255,255,255,.12)",
                }}
              >
                {item.media}
              </div>
              <div className="ms-work-card__body">
                <span className="ms-work-card__tag">{item.tag}</span>
                <h3 className="ms-work-card__title">{item.title}</h3>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ServicesGrid({ t }: { t: SiteContent }) {
  return (
    <section className="ms-section">
      <div className="ms-container">
        <div className="ms-section__header">
          <div>
            <span className="ms-section__eyebrow">{t.services.eyebrow}</span>
            <h2 className="ms-section__title">{t.services.title}</h2>
          </div>
        </div>
        <div className="ms-services">
          {t.services.items.map((s) => (
            <div key={s.num} className="ms-service">
              <div className="ms-service__num">{s.num}</div>
              <h3 className="ms-service__title">{s.title}</h3>
              <p className="ms-service__desc">{s.desc}</p>
              <a className="ms-service__link" href="#">
                {t.services.link}
                <ArrowIcon />
              </a>
            </div>
          ))}
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
          {t.metrics.items.map((m) => (
            <div key={m.label} className="ms-metric">
              <div className="ms-metric__label">{m.label}</div>
              <div className="ms-metric__value">{m.value}</div>
              <div className="ms-metric__delta">{m.delta}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProcessSteps({ t }: { t: SiteContent }) {
  return (
    <section className="ms-section">
      <div className="ms-container">
        <div className="ms-section__header">
          <div>
            <span className="ms-section__eyebrow">{t.process.eyebrow}</span>
            <h2 className="ms-section__title">{t.process.title}</h2>
          </div>
        </div>
        <div className="ms-process">
          {t.process.items.map((s) => (
            <div key={s.num} className="ms-step">
              <div className="ms-step__num">{s.num}</div>
              <h3 className="ms-step__title">{s.title}</h3>
              <p className="ms-step__desc">{s.desc}</p>
              <span className="ms-step__bar" />
            </div>
          ))}
        </div>
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
    <div data-screen-label={lang === "en" ? "Marker Site (EN)" : "Marker Site (AR)"}>
      <SiteHeader lang={lang} setLang={setLang} t={t} />
      <main>
        <Hero t={t} />
        <WorkGrid t={t} />
        <ServicesGrid t={t} />
        <MetricStrip t={t} />
        <ProcessSteps t={t} />
        <ContactBlock t={t} />
      </main>
      <SiteFooter t={t} />
    </div>
  );
}
