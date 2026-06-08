"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useLang } from "@/lib/useLang";
import { MARKER_CONTENT } from "@/lib/content";
import { type Project } from "@/lib/projects";

const LOGO = "/assets/logo-primary-transparent.png";

export default function ProjectView({ project, next }: { project: Project; next: Project }) {
  const [lang, setLang] = useLang();
  const t = MARKER_CONTENT[lang];
  const backArrow = t.cta.arrow === "←" ? "→" : "←";
  const rootRef = useRef<HTMLDivElement>(null);

  // Scroll-reveal: fade/slide elements in as they enter the viewport.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      els.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            (e.target as HTMLElement).classList.add("is-in");
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.12 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const labels = {
    en: { back: "All work", overview: "The story", challenge: "The challenge", approach: "Our approach", results: "The result", services: "Services", deliverables: "Deliverables", year: "Year", next: "Next project", impact: "The impact", wild: "In the wild", wildSub: "The identity, applied.", colors: "Colour system" },
    ar: { back: "كل الأعمال", overview: "القصّة", challenge: "التحدّي", approach: "مقاربتنا", results: "النتيجة", services: "الخدمات", deliverables: "المُسلّمات", year: "السنة", next: "المشروع التالي", impact: "الأثر", wild: "على أرض الواقع", wildSub: "الهوية، مُطبَّقة.", colors: "نظام الألوان" },
  }[lang];

  const chapters = [
    { key: "01", label: labels.challenge, text: project.challenge[lang] },
    { key: "02", label: labels.approach, text: project.approach[lang] },
    { key: "03", label: labels.results, text: project.results[lang] },
  ];

  const hasGallery = !!(project.gallery && project.gallery.length);
  const logoColor = !!project.keepLogoColor;

  return (
    <div ref={rootRef} data-screen-label={`Project · ${project.name[lang]}`} style={{ ["--pj" as string]: project.accent || project.color }}>
      {/* slim header */}
      <header className="ms-header">
        <div className="ms-container ms-header__inner">
          <Link className="ms-logo" href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO} alt="Marker Studio" />
          </Link>
          <div className="ms-actions">
            <div className="ms-lang" role="group" aria-label="Language">
              <button className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>EN</button>
              <button className={lang === "ar" ? "on" : ""} onClick={() => setLang("ar")}>ع</button>
            </div>
            <Link href="/#contact" className="ms-btn ms-btn-primary ms-cta-desktop">
              {t.cta.primary} <span>{t.cta.arrow}</span>
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ===== HERO — editorial cover on the brand colour ===== */}
        <section className="ms-pj-hero" style={{ background: project.color }}>
          <span className="ms-pj-hero__ghost" aria-hidden>{project.year}</span>
          <div className="ms-container ms-pj-hero__inner">
            <Link href="/#work" className="ms-pj-back">
              <span>{backArrow}</span> {labels.back}
            </Link>

            <div className="ms-pj-hero__grid">
              <div className="ms-pj-hero__lead">
                <span className="ms-pj-kicker">{project.tag[lang]}</span>
                <h1 className="ms-pj-title">{project.name[lang]}</h1>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="ms-pj-rule" src="/assets/brushstroke-orange.png" alt="" aria-hidden />
                <p className="ms-pj-summary">{project.summary[lang]}</p>
              </div>
              <div className={`ms-pj-hero__logo${logoColor ? " ms-pj-hero__logo--light" : ""}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={project.logo} alt={project.name[lang]} className={logoColor ? "ms-pj-logo--color" : ""} />
              </div>
            </div>

            <div className="ms-pj-facts">
              <div className="ms-pj-fact">
                <span className="ms-pj-fact__label">{labels.year}</span>
                <span className="ms-pj-fact__value">{project.year}</span>
              </div>
              <div className="ms-pj-fact">
                <span className="ms-pj-fact__label">{labels.services}</span>
                <span className="ms-pj-fact__value">{project.services[lang].join(" · ")}</span>
              </div>
              <div className="ms-pj-fact">
                <span className="ms-pj-fact__label">{labels.deliverables}</span>
                <span className="ms-pj-fact__value">{project.deliverables[lang].join(" · ")}</span>
              </div>
            </div>
          </div>
        </section>

        {/* ===== STORY — numbered editorial chapters ===== */}
        <section className="ms-section ms-pj-story">
          <div className="ms-container">
            <span className="ms-section__eyebrow">{labels.overview}</span>
            <div className="ms-pj-chapters">
              {chapters.map((c) => (
                <article key={c.key} className="ms-pj-chapter" data-reveal>
                  <span className="ms-pj-chapter__num" aria-hidden>{c.key}</span>
                  <div className="ms-pj-chapter__body">
                    <h3 className="ms-pj-chapter__label">{c.label}</h3>
                    <p className="ms-pj-chapter__text">{c.text}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ===== COLOUR SYSTEM ===== */}
        {project.palette && project.palette.length > 0 && (
          <section className="ms-section ms-section--cream ms-pj-palette">
            <div className="ms-container">
              <span className="ms-section__eyebrow">{labels.colors}</span>
              <div className="ms-pj-swatches">
                {project.palette.map((s, i) => (
                  <div key={i} className="ms-pj-swatch" data-reveal style={{ ["--d" as string]: `${i * 80}ms` }}>
                    <div className="ms-pj-swatch__chip" style={{ background: s.hex, border: s.hex.toLowerCase() === "#ffffff" ? "1px solid var(--border)" : "none" }} />
                    <div className="ms-pj-swatch__meta">
                      <span className="ms-pj-swatch__name">{s.name[lang]}</span>
                      <span className="ms-pj-swatch__hex">{s.hex.toUpperCase()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ===== METRICS — the impact, exploded ===== */}
        {project.metrics && project.metrics.length > 0 && (
          <section className="ms-section ms-pj-impact">
            <div className="ms-container">
              <span className="ms-section__eyebrow" style={{ color: "var(--marker-orange)" }}>{labels.impact}</span>
              <div className="ms-pj-metrics">
                {project.metrics.map((m, i) => (
                  <div key={i} className="ms-pj-metric" data-reveal style={{ ["--d" as string]: `${i * 80}ms` }}>
                    <div className="ms-pj-metric__value">{m.value}</div>
                    <div className="ms-pj-metric__label">{m.label[lang]}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ===== IN THE WILD — real spreads if present, else generated device mockups ===== */}
        {hasGallery ? (
          <section className="ms-section ms-section--cream ms-pj-show">
            <div className="ms-container">
              <span className="ms-section__eyebrow">{labels.wild}</span>
              <h2 className="ms-section__title">{labels.wildSub}</h2>
              <div className="ms-container ms-pj-gallery" style={{ padding: 0, marginTop: 40 }}>
                {project.gallery!.map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={src} alt={`${project.name[lang]} ${i + 1}`} loading="lazy" data-reveal className={i === 0 ? "ms-pj-gallery__feature" : ""} />
                ))}
              </div>
            </div>
          </section>
        ) : (
          <section className="ms-section ms-section--cream ms-pj-show">
            <div className="ms-container">
              <span className="ms-section__eyebrow">{labels.wild}</span>
              <h2 className="ms-section__title">{labels.wildSub}</h2>

              <div className="ms-pj-show__grid">
                {/* Browser / website mock */}
                <div className="ms-mock ms-mock--browser" data-reveal>
                  <div className="ms-mock__bar">
                    <span className="ms-mock__dot" /><span className="ms-mock__dot" /><span className="ms-mock__dot" />
                    <span className="ms-mock__url">{project.slug}.com</span>
                  </div>
                  <div className="ms-mock__screen" style={{ background: project.color }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={project.logo} alt="" aria-hidden className={logoColor ? "ms-pj-logo--color" : ""} />
                    <span className="ms-mock__cap">{project.tag[lang]}</span>
                  </div>
                </div>

                {/* Phone / social mock */}
                <div className="ms-mock ms-mock--phone" data-reveal>
                  <div className="ms-mock__notch" />
                  <div className="ms-mock__screen" style={{ background: project.color }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={project.logo} alt="" aria-hidden className={logoColor ? "ms-pj-logo--color" : ""} />
                    <span className="ms-mock__handle">@{project.slug.replace(/-/g, "")}</span>
                  </div>
                </div>

                {/* Business card mock */}
                <div className="ms-mock ms-mock--card" data-reveal style={{ background: project.color }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className={`ms-mock__cardlogo${logoColor ? " ms-pj-logo--color" : ""}`} src={project.logo} alt="" aria-hidden />
                  <div className="ms-mock__cardfoot">
                    <span>{project.name[lang]}</span>
                    <span>{project.year}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ===== NEXT PROJECT ===== */}
        <Link href={`/work/${next.slug}`} className="ms-pj-next" style={{ background: next.color }}>
          <span className="ms-pj-next__ghost" aria-hidden>{next.name[lang]}</span>
          <div className="ms-container ms-pj-next__inner">
            <span className="ms-pj-next__label">{labels.next}</span>
            <span className="ms-pj-next__name">
              {next.name[lang]} <span className="ms-pj-next__arrow">{t.cta.arrow}</span>
            </span>
          </div>
        </Link>
      </main>

      <footer className="ms-footer">
        <div className="ms-container">
          <div className="ms-footer__bottom" style={{ borderTop: "none", paddingTop: 0 }}>
            <span>{t.footer.copy}</span>
            <span>{t.footer.contact.web}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
