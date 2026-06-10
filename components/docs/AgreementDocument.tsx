"use client";

// The studio's paged service agreement — cover, at-a-glance summary, numbered
// terms flowing across A4 pages, and a signature page with an e-sign form.
// Bilingual EN/AR with the same theme system as the proposal.

import "./doc.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { rich } from "./rich";
import type { AgreementDoc, L } from "@/lib/docs";

const LOGO_DARK = "/assets/logo-on-dark.png";
const LOGO_LIGHT = "/assets/logo-primary-transparent.png";

const UI = {
  en: {
    confidential: "Confidential",
    exportPdf: "Export PDF",
    backPortal: "← Portal",
    total: "Total",
    studio: "For Marker Studio®",
    client: "For the Client",
    signedOn: "Signed on",
    awaiting: "Awaiting signature",
    agreeLabel: "I have read and accept the terms and conditions of this Agreement.",
    signLabel: "Type your full name to sign",
    signHint: "This serves as your electronic signature.",
    signBtn: "Sign & accept agreement",
    signedTitle: "Agreement signed",
    by: "Signed by",
    on: "on",
    draftNote: "Draft preview — the client can't see this yet.",
    sentNote: "Sent — awaiting signature",
    signed: "Signed",
    terms: "Terms",
  },
  ar: {
    confidential: "سري",
    exportPdf: "تصدير PDF",
    backPortal: "البوابة ←",
    total: "الإجمالي",
    studio: "عن Marker Studio®",
    client: "عن العميل",
    signedOn: "وُقّعت بتاريخ",
    awaiting: "بانتظار التوقيع",
    agreeLabel: "لقد قرأت وأوافق على شروط وأحكام هذه الاتفاقية.",
    signLabel: "اكتب اسمك الكامل للتوقيع",
    signHint: "يُعتبر هذا توقيعك الإلكتروني.",
    signBtn: "وقّع واقبل الاتفاقية",
    signedTitle: "تم توقيع الاتفاقية",
    by: "وقّعها",
    on: "بتاريخ",
    draftNote: "معاينة مسودة — لا يراها العميل بعد.",
    sentNote: "أُرسلت — بانتظار التوقيع",
    signed: "موقّعة",
    terms: "الشروط",
  },
} as const;

export default function AgreementDocument({
  doc,
  clientName,
  clientSlug,
  mode = "portal",
  status = "draft",
  signed = null,
  onSign,
  initialLang = "en",
}: {
  doc: AgreementDoc;
  clientName: string;
  clientSlug?: string;
  mode?: "portal" | "preview";
  status?: "draft" | "sent" | "signed";
  signed?: { at: string; by: string } | null;
  onSign?: (fd: FormData) => Promise<void>;
  initialLang?: "en" | "ar";
}) {
  const [lang, setLang] = useState<"en" | "ar">(initialLang);
  const t = UI[lang];
  const tr = useCallback((x: L) => (x ? x[lang] || x.en : ""), [lang]);

  // fit-to-width scaling (same approach as the proposal)
  const viewportRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const vp = viewportRef.current;
    const dc = docRef.current;
    if (!vp || !dc) return;
    const probe = document.createElement("div");
    probe.style.cssText = "width:210mm;position:absolute;visibility:hidden";
    document.body.appendChild(probe);
    const nat = probe.offsetWidth;
    probe.remove();
    const fit = () => {
      if (window.innerWidth <= 760) {
        dc.style.transform = "none";
        return;
      }
      const avail = vp.clientWidth - 36;
      dc.style.transform = `scale(${Math.min(1, avail / nat)})`;
    };
    fit();
    const t1 = setTimeout(fit, 150);
    window.addEventListener("resize", fit);
    const before = () => (dc.style.transform = "none");
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", fit);
    return () => {
      clearTimeout(t1);
      window.removeEventListener("resize", fit);
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", fit);
    };
  }, [mode]);

  const [agree, setAgree] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSign(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!onSign || mode === "preview" || signed) return;
    const fd = new FormData(e.currentTarget);
    fd.set("slug", clientSlug || "");
    fd.set("agree", agree ? "on" : "");
    setSubmitting(true);
    try {
      await onSign(fd);
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

  // Distribute the numbered sections across flow pages by rough text weight so
  // each printed page stays comfortably inside A4.
  const weight = (s: AgreementDoc["sections"][number]) =>
    60 + tr(s.title).length + s.body.reduce((n, b) => n + tr(b).length, 0) + s.list.reduce((n, b) => n + tr(b).length + 30, 0);
  const pagesOfSections: number[][] = [];
  {
    let cur: number[] = [];
    let acc = 0;
    const LIMIT = 2800;
    doc.sections.forEach((s, i) => {
      const w = weight(s);
      if (cur.length && acc + w > LIMIT) {
        pagesOfSections.push(cur);
        cur = [];
        acc = 0;
      }
      cur.push(i);
      acc += w;
    });
    if (cur.length) pagesOfSections.push(cur);
  }

  const totalPages = 2 + pagesOfSections.length + 1; // cover + summary + terms + signature
  const num = (n: number) => String(n).padStart(2, "0");
  const scheduleTotal = doc.schedule.items.reduce((s, it) => s + (parseFloat((it.amount || "").replace(/[^0-9.]/g, "")) || 0), 0);

  const header = (
    <header className="ph">
      <div className="pl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_LIGHT} alt="" />
        <span>{tr(doc.cover.eyebrow)}</span>
      </div>
      <div className="phr">{clientName} · Marker Studio®</div>
    </header>
  );
  const footer = (page: number) => (
    <footer className="pf">
      <div className="pl2">{t.confidential} · marker.ps</div>
      <div className="pg">
        <b>{num(page)}</b> / {num(totalPages)}
      </div>
    </footer>
  );

  const signedInfo = signed;

  return (
    <div
      className="mdoc"
      data-cover={doc.theme.cover}
      data-accent={doc.theme.accent}
      data-display={doc.theme.display}
      data-nums={doc.theme.nums}
      data-brush={doc.theme.brush ? "on" : "off"}
      data-lang={lang}
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <div className="mdoc-viewport" ref={viewportRef}>
        <div className="mdoc-doc" ref={docRef}>
          {/* ============ COVER ============ */}
          <section className="page cover ink">
            <div className="grid-bg" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="mark" src={doc.theme.cover === "paper" ? LOGO_LIGHT : LOGO_DARK} alt="" />
            <div className="cover-in">
              <div className="cover-top">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={doc.theme.cover === "paper" ? LOGO_LIGHT : LOGO_DARK}
                  alt="Marker Studio"
                  className="cover-logo"
                />
                <div className="cover-docid">
                  DOC · {doc.docId}
                  <br />
                  {t.confidential}
                </div>
              </div>
              <div className="cover-mid">
                <div className="cover-eyebrow">{tr(doc.cover.eyebrow)}</div>
                <h1 className="cover-title">{rich(tr(doc.cover.title))}</h1>
                <div className="cover-rule" />
                <p className="cover-sub">{tr(doc.cover.sub)}</p>
                <div className="cover-meta">
                  {doc.cover.meta.map((m, i) => (
                    <div className="mi" key={i}>
                      <div className="ml">{tr(m.label)}</div>
                      <div className="mv">{tr(m.value)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ============ SUMMARY ============ */}
          <section className="page cream">
            {header}
            <div className="pbody">
              <div className="head">
                <div className="num">01</div>
                <div className="ttl">
                  <div className="kicker">{tr(doc.summary.kicker)}</div>
                  <h2 className="title">{rich(tr(doc.summary.title))}</h2>
                </div>
                <div className="pager">
                  <b>02</b>/ {num(totalPages)}
                </div>
              </div>
              <p className="scope-intro">{tr(doc.summary.intro)}</p>
              <div className="ag-summary">
                {doc.summary.rows.map((r, i) => (
                  <div className="row" key={i}>
                    <div className="rl">{tr(r.label)}</div>
                    <div className="rv">{tr(r.value)}</div>
                  </div>
                ))}
              </div>
              {doc.schedule.enabled && doc.schedule.items.length > 0 && (
                <div style={{ marginTop: 22 }}>
                  <div className="gtitle">
                    <b>{tr(doc.schedule.title)}</b>
                    <span>{doc.currency}</span>
                  </div>
                  <div className="sched">
                    {doc.schedule.items.map((it, i) => (
                      <div className="srow" key={i}>
                        <span>{tr(it.label)}</span>
                        <b>{it.amount}</b>
                      </div>
                    ))}
                    {scheduleTotal > 0 && (
                      <div className="srow total">
                        <span>{t.total}</span>
                        <b>
                          {scheduleTotal.toLocaleString("en-US")} {doc.currency}
                        </b>
                      </div>
                    )}
                  </div>
                  <p className="pricing-note">{tr(doc.schedule.note)}</p>
                </div>
              )}
            </div>
            {footer(2)}
          </section>

          {/* ============ TERMS (flow pages) ============ */}
          {pagesOfSections.map((idxs, pi) => (
            <section className="page white flow" key={pi}>
              {header}
              <div className="pbody">
                {pi === 0 && (
                  <div className="head">
                    <div className="num">02</div>
                    <div className="ttl">
                      <div className="kicker">{t.terms}</div>
                      <h2 className="title">{t.terms === "Terms" ? "Terms & conditions." : "الشروط والأحكام."}</h2>
                    </div>
                    <div className="pager">
                      <b>{num(3 + pi)}</b>/ {num(totalPages)}
                    </div>
                  </div>
                )}
                {idxs.map((si) => {
                  const s = doc.sections[si];
                  return (
                    <div className="ag-sec" key={si}>
                      <h3>
                        <span className="n">{num(si + 1)}</span> {tr(s.title)}
                      </h3>
                      {s.body.map((b, bi) => (
                        <p key={bi}>{tr(b)}</p>
                      ))}
                      {s.list.length > 0 && (
                        <ul>
                          {s.list.map((li, lii) => (
                            <li key={lii}>{tr(li)}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
              {footer(3 + pi)}
            </section>
          ))}

          {/* ============ SIGNATURE ============ */}
          <section className="page cream">
            {header}
            <div className="pbody">
              <div className="head">
                <div className="num">03</div>
                <div className="ttl">
                  <div className="kicker">{tr(doc.acceptance.kicker)}</div>
                  <h2 className="title">{rich(tr(doc.acceptance.title))}</h2>
                </div>
                <div className="pager">
                  <b>{num(totalPages)}</b>/ {num(totalPages)}
                </div>
              </div>
              <div className="accept">
                <div>
                  <p className="ab">{rich(tr(doc.acceptance.body))}</p>
                  <div className="sig-grid">
                    <div className="sig-block">
                      <div className="sg-l">{t.studio}</div>
                      <div className="sg-n">Marker Studio®</div>
                      <div className="sg-s">Beit Sahour, Palestine</div>
                    </div>
                    <div className="sig-block">
                      <div className="sg-l">{t.client}</div>
                      <div className="sg-n">{signedInfo?.by || clientName}</div>
                      <div className="sg-s">
                        {signedInfo
                          ? `${t.signedOn} ${new Date(signedInfo.at).toLocaleDateString(lang === "ar" ? "ar" : "en-GB")}`
                          : t.awaiting}
                      </div>
                    </div>
                  </div>
                  <div className="stamp-row">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={LOGO_LIGHT} alt="Marker Studio" />
                    <div className="stamp-meta">
                      <b>Marker Studio®</b>
                      <span>{tr(doc.acceptance.stampLine)}</span>
                    </div>
                  </div>
                </div>
                <aside className="acard">
                  {signedInfo || submitted ? (
                    <div className="signed-box">
                      <div className="sb-l">{t.signedTitle} ✓</div>
                      <div className="sb-name">{signedInfo?.by || name}</div>
                      <div className="sb-meta">
                        {signedInfo
                          ? `${t.on} ${new Date(signedInfo.at).toLocaleString(lang === "ar" ? "ar" : "en-GB")}`
                          : t.signedTitle}
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSign}>
                      <label className="acheck">
                        <input
                          type="checkbox"
                          checked={agree}
                          onChange={(e) => setAgree(e.target.checked)}
                          disabled={mode === "preview"}
                        />
                        <span>{t.agreeLabel}</span>
                      </label>
                      <div className="field">
                        <label htmlFor="mdoc-sign-name">{t.signLabel}</label>
                        <input
                          id="mdoc-sign-name"
                          name="signedName"
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          disabled={mode === "preview"}
                        />
                      </div>
                      {name.trim().length >= 2 && (
                        <div className="signed-box">
                          <div className="sb-l">{t.signHint}</div>
                          <div className="sb-name">{name}</div>
                        </div>
                      )}
                      <button
                        className="submit"
                        type="submit"
                        disabled={mode === "preview" || submitting || !agree || name.trim().length < 2}
                      >
                        {submitting ? "…" : t.signBtn}
                      </button>
                      <div className="smallnote">{t.signHint}</div>
                    </form>
                  )}
                </aside>
              </div>
            </div>
            {footer(totalPages)}
          </section>
        </div>
      </div>

      {/* floating controls */}
      {mode === "portal" && clientSlug && (
        <a className="mdoc-back" href={`/portal/${clientSlug}`}>
          {t.backPortal}
        </a>
      )}
      {mode === "portal" && (
        <div className="mdoc-statusbar">
          <span className={`dot ${status === "signed" ? "green" : ""}`} />
          {status === "signed" ? t.signed : status === "sent" ? t.sentNote : t.draftNote}
        </div>
      )}
      <div className="mdoc-langchip" role="group" aria-label="Language">
        <button type="button" className={lang === "en" ? "active" : ""} onClick={() => setLang("en")}>
          EN
        </button>
        <button type="button" className={lang === "ar" ? "active" : ""} onClick={() => setLang("ar")}>
          AR
        </button>
      </div>
      {mode === "portal" && (
        <button type="button" className="mdoc-pdfbtn" onClick={() => window.print()}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16" />
          </svg>
          {t.exportPdf}
        </button>
      )}
    </div>
  );
}
