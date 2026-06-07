"use client";

import Link from "next/link";
import { useLang } from "@/lib/useLang";
import { MARKER_CONTENT } from "@/lib/content";
import { type Project } from "@/lib/projects";

const LOGO = "/assets/logo-primary-transparent.png";

export default function ProjectView({ project, next }: { project: Project; next: Project }) {
  const [lang, setLang] = useLang();
  const t = MARKER_CONTENT[lang];

  const labels = {
    en: { back: "All work", overview: "Overview", challenge: "The challenge", approach: "Our approach", results: "The result", services: "Services", deliverables: "Deliverables", year: "Year", next: "Next project" },
    ar: { back: "كل الأعمال", overview: "نظرة عامة", challenge: "التحدّي", approach: "مقاربتنا", results: "النتيجة", services: "الخدمات", deliverables: "المُسلّمات", year: "السنة", next: "المشروع التالي" },
  }[lang];

  return (
    <div data-screen-label={`Project · ${project.name[lang]}`}>
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
        {/* hero — on the brand colour */}
        <section className="ms-proj-hero" style={{ background: project.color }}>
          <div className="ms-container">
            <Link href="/#work" className="ms-proj-back">
              <span>{t.cta.arrow === "←" ? "→" : "←"}</span> {labels.back}
            </Link>
            <div className="ms-proj-hero__grid">
              <div>
                <span className="ms-proj-tag">{project.tag[lang]}</span>
                <h1 className="ms-proj-title">{project.name[lang]}</h1>
                <p className="ms-proj-summary">{project.summary[lang]}</p>
              </div>
              <div className="ms-proj-logo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={project.logo} alt={project.name[lang]} />
              </div>
            </div>
            <div className="ms-proj-facts">
              <div className="ms-proj-fact">
                <span className="ms-proj-fact__label">{labels.year}</span>
                <span className="ms-proj-fact__value">{project.year}</span>
              </div>
              <div className="ms-proj-fact">
                <span className="ms-proj-fact__label">{labels.services}</span>
                <span className="ms-proj-fact__value">{project.services[lang].join(" · ")}</span>
              </div>
              <div className="ms-proj-fact">
                <span className="ms-proj-fact__label">{labels.deliverables}</span>
                <span className="ms-proj-fact__value">{project.deliverables[lang].join(" · ")}</span>
              </div>
            </div>
          </div>
        </section>

        {/* body */}
        <section className="ms-section">
          <div className="ms-container ms-proj-body">
            <div className="ms-proj-body__rail">
              <span className="ms-section__eyebrow">{labels.overview}</span>
            </div>
            <div className="ms-proj-body__main">
              <div className="ms-proj-block">
                <h3 className="ms-proj-block__title">{labels.challenge}</h3>
                <p className="ms-proj-block__text">{project.challenge[lang]}</p>
              </div>
              <div className="ms-proj-block">
                <h3 className="ms-proj-block__title">{labels.approach}</h3>
                <p className="ms-proj-block__text">{project.approach[lang]}</p>
              </div>
              <div className="ms-proj-block">
                <h3 className="ms-proj-block__title">{labels.results}</h3>
                <p className="ms-proj-block__text">{project.results[lang]}</p>
              </div>
            </div>
          </div>
        </section>

        {/* metrics (optional) */}
        {project.metrics && project.metrics.length > 0 && (
          <section className="ms-section ms-section--dark">
            <div className="ms-container">
              <div className="ms-metrics">
                {project.metrics.map((m, i) => (
                  <div key={i} className="ms-metric">
                    <div className="ms-metric__value">{m.value}</div>
                    <div className="ms-metric__label">{m.label[lang]}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* gallery (optional) */}
        {project.gallery && project.gallery.length > 0 && (
          <section className="ms-section ms-section--cream">
            <div className="ms-container ms-proj-gallery">
              {project.gallery.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={src} alt={`${project.name[lang]} ${i + 1}`} loading="lazy" />
              ))}
            </div>
          </section>
        )}

        {/* next project */}
        <Link href={`/work/${next.slug}`} className="ms-proj-next" style={{ background: next.color }}>
          <div className="ms-container ms-proj-next__inner">
            <span className="ms-proj-next__label">{labels.next}</span>
            <span className="ms-proj-next__name">
              {next.name[lang]} <span>{t.cta.arrow}</span>
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
