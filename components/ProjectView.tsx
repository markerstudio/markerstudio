"use client";

import React from "react";
import Link from "next/link";
import { useLang } from "@/lib/useLang";
import { MARKER_CONTENT, type Lang } from "@/lib/content";
import { type Project } from "@/lib/projects";
import FlowArt, { FlowSection } from "@/components/ui/story-scroll";

/* Brand anchors used to round out a project's palette into a panel sequence. */
const INK = "#1A1A1A";
const CHARCOAL = "#303030";
const ORANGE = "#FF9100";
const CREAM = "#F1ECE2";

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const int = parseInt(n, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

// Relative luminance (WCAG) — used to choose readable text per panel.
function luminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const lin = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

const isLight = (hex: string) => luminance(hex) > 0.52;
const textOn = (hex: string) => (isLight(hex) ? "#1A1614" : "#FFFFFF");
const ruleOn = (hex: string) => (isLight(hex) ? "rgba(0,0,0,0.32)" : "rgba(255,255,255,0.40)");
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/* Split a phrase into stacked lines (one word per line) for the giant display. */
function Stacked({ text }: { text: string }) {
  return (
    <>
      {text.split(/\s+/).map((word, i) => (
        <React.Fragment key={i}>
          {i > 0 && <br />}
          {word}
        </React.Fragment>
      ))}
    </>
  );
}

export default function ProjectView({ project, next }: { project: Project; next: Project }) {
  const [lang, setLang] = useLang();
  const t = MARKER_CONTENT[lang];
  const isAr = lang === "ar";
  const disp = isAr ? "font-arabic-display" : "font-display";
  const arrow = t.cta.arrow;
  const backArrow = isAr ? "→" : "←";

  const labels = {
    en: { back: "All work", story: "The story", challenge: "The challenge", approach: "Our approach", results: "The result", services: "Services", deliverables: "Deliverables", year: "Year", next: "Next project", impact: "The impact", wild: "In the wild", wildSub: "The identity, applied.", caseStudy: "Case study" },
    ar: { back: "كل الأعمال", story: "القصّة", challenge: "التحدّي", approach: "مقاربتنا", results: "النتيجة", services: "الخدمات", deliverables: "المُسلّمات", year: "السنة", next: "المشروع التالي", impact: "الأثر", wild: "على أرض الواقع", wildSub: "الهوية، مُطبَّقة.", caseStudy: "دراسة حالة" },
  }[lang];

  const hasMetrics = !!(project.metrics && project.metrics.length);
  const hasGallery = !!(project.gallery && project.gallery.length);

  // ---- Build the panel-background sequence from the project's own palette ----
  // Pull distinct candidate colours (palette → accent → brand anchors), never
  // repeating the cover colour, then assign them per panel and finally smooth
  // out any adjacent duplicates so neighbouring panels always read distinct.
  const cover = project.color;
  const pool: string[] = [];
  for (const c of [...(project.palette?.map((p) => p.hex) ?? []), project.accent, CHARCOAL, INK, ORANGE, CREAM]) {
    if (!c || same(c, cover) || pool.some((p) => same(p, c))) continue;
    pool.push(c);
  }
  while (pool.length < 3) pool.push([CHARCOAL, ORANGE, CREAM][pool.length % 3]);

  // Prefer a dark anchor for the impact panel and a light one for the gallery.
  const impactBg = pool.find((c) => !isLight(c)) ?? INK;
  const wildBg = pool.find((c) => isLight(c)) ?? CREAM;

  const seq: string[] = [cover, pool[0], pool[1], pool[2]];
  if (hasMetrics) seq.push(impactBg);
  seq.push(wildBg);
  seq.push(next.color);

  // Smooth adjacent duplicates.
  const fallbacks = [ORANGE, CHARCOAL, CREAM, INK];
  for (let i = 1; i < seq.length; i++) {
    if (same(seq[i], seq[i - 1])) {
      seq[i] = fallbacks.find((f) => !same(f, seq[i - 1]) && (i + 1 >= seq.length || !same(f, seq[i + 1]))) ?? seq[i];
    }
  }

  let k = 0;
  const sCover = seq[k++];
  const sChapters = [seq[k++], seq[k++], seq[k++]];
  const sImpact = hasMetrics ? seq[k++] : null;
  const sWild = seq[k++];
  const sNext = seq[k++];

  const chapters = [
    { bg: sChapters[0], num: "01", label: labels.challenge, text: project.challenge[lang] },
    { bg: sChapters[1], num: "02", label: labels.approach, text: project.approach[lang] },
    { bg: sChapters[2], num: "03", label: labels.results, text: project.results[lang] },
  ];

  const eyebrowCls = `text-xs font-bold uppercase tracking-[0.2em] ${disp}`;
  const giantCls = `${disp} text-[clamp(3rem,11vw,12rem)] font-bold leading-[0.82] tracking-tight ${isAr ? "" : "uppercase"}`;
  const bodyCls = "max-w-[55ch] text-[clamp(1rem,2.2vw,1.7rem)] font-normal leading-relaxed";

  const Rule = ({ color }: { color: string }) => (
    <hr className="my-[2vw] border-none border-t" style={{ borderColor: color }} aria-hidden />
  );

  return (
    <div dir={isAr ? "rtl" : "ltr"} data-screen-label={`Project · ${project.name[lang]}`} className="bg-ink">
      {/* Minimal nav — blends against any panel colour. */}
      <header className="fixed inset-x-0 top-0 z-[100] flex items-center justify-between px-[6vw] py-5 text-white mix-blend-difference">
        <Link href="/#work" className="inline-flex items-center gap-2 text-sm font-semibold font-display">
          <span aria-hidden>{backArrow}</span> {labels.back}
        </Link>
        <Link href="/" className="text-base font-bold tracking-tight font-display">Marker</Link>
        <div className="flex items-center gap-1 text-sm font-semibold font-display" role="group" aria-label="Language">
          <button className={lang === "en" ? "opacity-100" : "opacity-50"} onClick={() => setLang("en" as Lang)}>EN</button>
          <span className="opacity-40">/</span>
          <button className={lang === "ar" ? "opacity-100" : "opacity-50"} onClick={() => setLang("ar" as Lang)}>ع</button>
        </div>
      </header>

      <FlowArt aria-label={`${project.name[lang]} — ${labels.caseStudy}`}>
        {/* ===== COVER ===== */}
        <FlowSection aria-label={project.name[lang]} style={{ backgroundColor: sCover, color: textOn(sCover) }}>
          <div className="flex items-center justify-between gap-4">
            <p className={eyebrowCls}>{project.tag[lang]}</p>
            <p className={eyebrowCls}>{labels.caseStudy} · {project.year}</p>
          </div>
          <Rule color={ruleOn(sCover)} />
          <div>
            <h1 className={giantCls}><Stacked text={project.name[lang]} /></h1>
          </div>
          <Rule color={ruleOn(sCover)} />
          <div className="flex flex-wrap items-end justify-between gap-x-[4vw] gap-y-8">
            <p className={bodyCls}>{project.summary[lang]}</p>
            <div className="flex flex-wrap gap-x-[3vw] gap-y-6">
              <div className="min-w-[180px] max-w-[34ch]">
                <p className="text-xs font-bold uppercase tracking-[0.16em] opacity-60 font-display">{labels.services}</p>
                <p className="mt-1.5 text-[clamp(0.9rem,1.4vw,1.05rem)] leading-snug">{project.services[lang].join(" · ")}</p>
              </div>
              <div className="min-w-[180px] max-w-[34ch]">
                <p className="text-xs font-bold uppercase tracking-[0.16em] opacity-60 font-display">{labels.deliverables}</p>
                <p className="mt-1.5 text-[clamp(0.9rem,1.4vw,1.05rem)] leading-snug">{project.deliverables[lang].join(" · ")}</p>
              </div>
            </div>
          </div>
        </FlowSection>

        {/* ===== STORY CHAPTERS ===== */}
        {chapters.map((c) => (
          <FlowSection key={c.num} aria-label={c.label} style={{ backgroundColor: c.bg, color: textOn(c.bg) }}>
            <p className={eyebrowCls}>{c.num} — {labels.story}</p>
            <Rule color={ruleOn(c.bg)} />
            <div>
              <h2 className={giantCls}><Stacked text={c.label} /></h2>
            </div>
            <Rule color={ruleOn(c.bg)} />
            <p className={`${bodyCls} mt-auto`}>{c.text}</p>
          </FlowSection>
        ))}

        {/* ===== IMPACT ===== */}
        {hasMetrics && sImpact && (
          <FlowSection aria-label={labels.impact} style={{ backgroundColor: sImpact, color: textOn(sImpact) }}>
            <p className={eyebrowCls}>{labels.impact}</p>
            <Rule color={ruleOn(sImpact)} />
            <div className="flex flex-wrap gap-x-[4vw] gap-y-[5vw]">
              {project.metrics!.map((m, i) => (
                <div key={i} className="min-w-[220px] flex-1">
                  <p className={`${disp} text-[clamp(3rem,8vw,7rem)] font-bold leading-[0.85] tracking-tight`}>{m.value}</p>
                  <p className="mt-3 text-[clamp(0.95rem,1.6vw,1.25rem)] leading-relaxed opacity-75 max-w-[28ch]">{m.label[lang]}</p>
                </div>
              ))}
            </div>
            <div />
          </FlowSection>
        )}

        {/* ===== IN THE WILD ===== */}
        <FlowSection aria-label={labels.wild} style={{ backgroundColor: sWild, color: textOn(sWild) }}>
          <p className={eyebrowCls}>{labels.wild}</p>
          <Rule color={ruleOn(sWild)} />
          <div>
            <h2 className={giantCls}><Stacked text={labels.wildSub} /></h2>
          </div>
          <Rule color={ruleOn(sWild)} />
          {hasGallery ? (
            <div className="grid grid-cols-2 gap-[1.5vw] md:grid-cols-3">
              {project.gallery!.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={src}
                  alt={`${project.name[lang]} ${i + 1}`}
                  loading="lazy"
                  className={`w-full rounded-xl object-cover ${i === 0 ? "col-span-2 h-[46vh] md:h-[56vh]" : "h-[34vh] md:h-[40vh]"}`}
                />
              ))}
            </div>
          ) : (
            <div
              className="flex min-h-[44vh] items-center justify-center rounded-2xl p-[6vw]"
              style={{ backgroundColor: project.color }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={project.logo}
                alt={project.name[lang]}
                className="max-h-[28vh] w-auto max-w-[60%] object-contain"
                style={project.keepLogoColor ? undefined : { filter: "brightness(0) invert(1)" }}
              />
            </div>
          )}
        </FlowSection>

        {/* ===== NEXT PROJECT ===== */}
        <FlowSection aria-label={labels.next} style={{ backgroundColor: sNext, color: textOn(sNext) }}>
          <p className={eyebrowCls}>{labels.next}</p>
          <Rule color={ruleOn(sNext)} />
          <Link href={`/work/${next.slug}`} className="group block no-underline" style={{ color: "inherit" }}>
            <h2 className={giantCls}>
              <Stacked text={next.name[lang]} />{" "}
              <span className="inline-block transition-transform duration-300 group-hover:translate-x-2">{arrow}</span>
            </h2>
          </Link>
          <Rule color={ruleOn(sNext)} />
          <div className="mt-auto flex flex-wrap items-center justify-between gap-4 text-[clamp(0.85rem,1.3vw,1rem)] opacity-80">
            <span>{t.footer.copy}</span>
            <span>{t.footer.contact.web}</span>
          </div>
        </FlowSection>
      </FlowArt>
    </div>
  );
}
