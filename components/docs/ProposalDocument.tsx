"use client";

// The studio's paged, print-first proposal — interactive on screen (language
// toggle, selectable plans with a live total, acceptance form) and clean A4
// pages in print/PDF. Rendered in the client portal and inside the admin
// builder's live preview.

import "./doc.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { rich } from "./rich";
import type { L, PriceGroup, ProposalDoc, ProposalSelection } from "@/lib/docs";

const LOGO_DARK = "/assets/logo-on-dark.png"; // for ink/orange backgrounds
const LOGO_LIGHT = "/assets/logo-primary-transparent.png"; // for paper/cream/white

export type ProposalAcceptedInfo = {
  at: string;
  by?: string;
  title?: string;
  notes?: string;
  selection?: ProposalSelection;
};

const UI = {
  en: {
    docLabel: "Proposal",
    confidential: "Confidential",
    exportPdf: "Export PDF",
    backPortal: "← Portal",
    selected: "Selected",
    selectionNote: "Selection note",
    perMo: "/mo",
    once: "one-time",
    monthly: "Monthly",
    oneTime: "One-time",
    selectedPlan: "Selected plan",
    fullName: "Full name",
    titleField: "Company / Handle",
    date: "Date",
    notes: "Notes (optional)",
    acceptBtn: "Accept proposal",
    acceptSmall: "Your acceptance and selection are recorded instantly — no payment is taken here.",
    acceptedTitle: "Proposal accepted",
    acceptedBy: "Accepted by",
    on: "on",
    draftNote: "Draft preview — the client can't see this yet.",
    sentNote: "Sent — awaiting acceptance",
    accepted: "Accepted",
    phase: "Phase",
  },
  ar: {
    docLabel: "مقترح",
    confidential: "سري",
    exportPdf: "تصدير PDF",
    backPortal: "البوابة ←",
    selected: "المختار",
    selectionNote: "ملاحظة الاختيار",
    perMo: "/ شهريًا",
    once: "دفعة واحدة",
    monthly: "شهريًا",
    oneTime: "دفعة واحدة",
    selectedPlan: "الخطة المختارة",
    fullName: "الاسم الكامل",
    titleField: "الشركة / الحساب",
    date: "التاريخ",
    notes: "ملاحظات (اختياري)",
    acceptBtn: "اقبل العرض",
    acceptSmall: "يُسجَّل قبولك واختيارك فورًا — لا تتم أي عملية دفع هنا.",
    acceptedTitle: "تم قبول العرض",
    acceptedBy: "قبله",
    on: "بتاريخ",
    draftNote: "معاينة مسودة — لا يراها العميل بعد.",
    sentNote: "أُرسل — بانتظار القبول",
    accepted: "مقبول",
    phase: "المرحلة",
  },
} as const;

export default function ProposalDocument({
  doc,
  clientName,
  clientSlug,
  mode = "portal",
  status = "draft",
  accepted = null,
  onAccept,
  initialLang = "en",
}: {
  doc: ProposalDoc;
  clientName: string;
  clientSlug?: string;
  mode?: "portal" | "preview";
  status?: "draft" | "sent" | "accepted";
  accepted?: ProposalAcceptedInfo | null;
  onAccept?: (fd: FormData) => Promise<void>;
  initialLang?: "en" | "ar";
}) {
  const [lang, setLang] = useState<"en" | "ar">(initialLang);
  const t = UI[lang];
  const tr = useCallback((x: L) => (x ? x[lang] || x.en : ""), [lang]);

  // ---- selection (plans) ----------------------------------------------------
  const initialSel = useMemo(() => {
    const sel: Record<number, string[]> = {};
    doc.investment.groups.forEach((g, gi) => {
      const picked = g.plans.filter((p) => p.selected).map((p) => p.key);
      if (g.mode === "single" && picked.length === 0 && g.plans[0]) picked.push(g.plans[0].key);
      sel[gi] = picked;
    });
    return sel;
  }, [doc]);
  const [sel, setSel] = useState<Record<number, string[]>>(initialSel);
  useEffect(() => setSel(initialSel), [initialSel]);

  const toggle = (gi: number, g: PriceGroup, key: string) => {
    if (accepted) return; // selection is frozen once accepted
    setSel((prev) => {
      const cur = prev[gi] || [];
      if (g.mode === "single") {
        if (cur.includes(key)) return prev; // always exactly one
        return { ...prev, [gi]: [key] };
      }
      return { ...prev, [gi]: cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key] };
    });
  };

  const selection: ProposalSelection = useMemo(() => {
    const items: ProposalSelection["items"] = [];
    let monthly = 0;
    let once = 0;
    doc.investment.groups.forEach((g, gi) => {
      for (const p of g.plans) {
        if (!(sel[gi] || []).includes(p.key)) continue;
        items.push({ label: tr(p.title), price: p.price, period: p.period });
        if (p.period === "mo") monthly += p.price;
        else once += p.price;
      }
    });
    return { items, monthly, once, currency: doc.currency };
  }, [doc, sel, tr]);

  const fmt = (n: number) => n.toLocaleString("en-US");
  const totalLine = (s: ProposalSelection) =>
    [
      s.monthly ? `${fmt(s.monthly)} ${s.currency}${t.perMo}` : "",
      s.once ? `${fmt(s.once)} ${s.currency} ${t.once}` : "",
    ]
      .filter(Boolean)
      .join(" + ") || `0 ${s.currency}`;

  // ---- fit-to-width scaling (screen only) -----------------------------------
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
        vp.style.height = "auto";
        return;
      }
      const avail = vp.clientWidth - 36;
      const scale = Math.min(1, avail / nat);
      dc.style.transform = `scale(${scale})`;
    };
    fit();
    const t1 = setTimeout(fit, 150);
    const t2 = setTimeout(fit, 600);
    window.addEventListener("resize", fit);
    const before = () => (dc.style.transform = "none");
    const after = () => fit();
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("resize", fit);
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, [mode]);

  // ---- acceptance form -------------------------------------------------------
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  async function handleAccept(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!onAccept || mode === "preview" || accepted) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("slug", clientSlug || "");
    fd.set("selection", JSON.stringify(selection));
    setSubmitting(true);
    try {
      await onAccept(fd);
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

  // ---- page assembly ---------------------------------------------------------
  const dark = doc.theme.cover === "ink" || doc.theme.cover === "orange";
  type Sec = "overview" | "understanding" | "scope" | "workplan" | "investment" | "why";
  const secs: Sec[] = (["overview", "understanding", "scope", "workplan", "investment", "why"] as Sec[]).filter(
    (s) => doc[s].enabled
  );
  const totalPages = secs.length + 2; // cover + sections + acceptance
  const num = (i: number) => String(i).padStart(2, "0");
  const docTitle = `${clientName} · Marker Studio®`;

  const header = (
    <header className="ph">
      <div className="pl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_LIGHT} alt="" />
        <span>{tr(doc.cover.eyebrow) || t.docLabel}</span>
      </div>
      <div className="phr">{docTitle}</div>
    </header>
  );
  const headerDark = (
    <header className="ph">
      <div className="pl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_DARK} alt="" />
        <span>{tr(doc.cover.eyebrow) || t.docLabel}</span>
      </div>
      <div className="phr">{docTitle}</div>
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

  const sectionHead = (idx: number, kicker: L, title: L) => (
    <div className="head">
      <div className="num">{num(idx)}</div>
      <div className="ttl">
        <div className="kicker">{tr(kicker)}</div>
        <h2 className="title">{rich(tr(title))}</h2>
      </div>
      <div className="pager">
        <b>{num(idx)}</b>/ {num(secs.length + 1)}
      </div>
    </div>
  );

  const acceptedInfo = accepted;
  const selForDisplay = acceptedInfo?.selection || selection;

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
            <img className="mark" src={dark ? LOGO_DARK : LOGO_LIGHT} alt="" />
            <div className="cover-in">
              <div className="cover-top">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={dark ? LOGO_DARK : LOGO_LIGHT} alt="Marker Studio" className="cover-logo" />
                <div className="cover-docid">
                  DOC · {doc.docId}
                  <br />
                  {t.confidential}
                </div>
              </div>
              <div className="cover-mid">
                <div className="cover-eyebrow">{tr(doc.cover.eyebrow)}</div>
                <div className="cover-prepared">{rich(tr(doc.cover.preparedFor))}</div>
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

          {/* ============ OVERVIEW ============ */}
          {doc.overview.enabled && (
            <section className="page cream">
              {header}
              <div className="pbody">
                {sectionHead(secs.indexOf("overview") + 1, doc.overview.kicker, doc.overview.title)}
                <div className="grid-2">
                  <div>
                    {doc.overview.paras.map((p, i) => (
                      <p className="lead" key={i}>
                        {rich(tr(p))}
                      </p>
                    ))}
                    {doc.overview.team.length > 0 && (
                      <div className="team">
                        {doc.overview.team.map((m, i) => (
                          <div className="tc" key={i}>
                            <div className="tn">{m.name}</div>
                            <div className="tr">{tr(m.role)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="sign">
                      <div className="sl">{tr(doc.overview.signLabel)}</div>
                      <div className="snm">{doc.overview.signNames}</div>
                      <div className="sr">{tr(doc.overview.signRole)}</div>
                      <div className="sc">{doc.overview.contact}</div>
                    </div>
                  </div>
                  <aside className="glance">
                    <div className="gt">{tr(doc.overview.glanceTitle)}</div>
                    {doc.overview.stats.map((s, i) => (
                      <div className="stat" key={i}>
                        <div className="sn">{tr(s.n)}</div>
                        <div className="sd">{tr(s.d)}</div>
                      </div>
                    ))}
                  </aside>
                </div>
              </div>
              {footer(secs.indexOf("overview") + 2)}
            </section>
          )}

          {/* ============ UNDERSTANDING ============ */}
          {doc.understanding.enabled && (
            <section className="page white">
              {header}
              <div className="pbody">
                {sectionHead(secs.indexOf("understanding") + 1, doc.understanding.kicker, doc.understanding.title)}
                <div className="cards">
                  {doc.understanding.cards.map((c, i) => (
                    <article className="card" key={i}>
                      <div className="cno">{c.no}</div>
                      <div className="cttl">{tr(c.title)}</div>
                      <div className="car">{tr(c.sub)}</div>
                      <ul>
                        {c.bullets.map((b, j) => (
                          <li key={j}>{rich(tr(b))}</li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              </div>
              {footer(secs.indexOf("understanding") + 2)}
            </section>
          )}

          {/* ============ SCOPE ============ */}
          {doc.scope.enabled && (
            <section className="page cream">
              {header}
              <div className="pbody">
                {sectionHead(secs.indexOf("scope") + 1, doc.scope.kicker, doc.scope.title)}
                <p className="scope-intro">{tr(doc.scope.intro)}</p>
                <div className="scope-grid">
                  {doc.scope.cards.map((sc, i) => (
                    <article className={`scope ${tr(sc.flag) ? "lead-card" : ""}`} key={i}>
                      {tr(sc.flag) && <div className="flag">{tr(sc.flag)}</div>}
                      <div className="stop">
                        <span className="sno">{sc.no}</span>
                        <span className="stt">{tr(sc.title)}</span>
                      </div>
                      {tr(sc.sub) && <div className="sar">{tr(sc.sub)}</div>}
                      <p>{tr(sc.desc)}</p>
                      <ul>
                        {sc.bullets.map((b, j) => (
                          <li key={j}>{tr(b)}</li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              </div>
              {footer(secs.indexOf("scope") + 2)}
            </section>
          )}

          {/* ============ WORK PLAN ============ */}
          {doc.workplan.enabled && (
            <section className="page">
              {header}
              <div className="pbody">
                {sectionHead(secs.indexOf("workplan") + 1, doc.workplan.kicker, doc.workplan.title)}
                <div className="tl-wrap">
                  <div className="tl-scroll">
                    <table className="tl">
                      <thead>
                        <tr>
                          <th>{t.phase}</th>
                          {Array.from({ length: doc.workplan.weeks }, (_, w) => (
                            <th key={w}>W{w + 1}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {doc.workplan.phases.map((ph, i) => (
                          <tr key={i}>
                            <td className="phase">
                              {tr(ph.name)}
                              {tr(ph.alt) && <span>{tr(ph.alt)}</span>}
                            </td>
                            {Array.from({ length: doc.workplan.weeks }, (_, w) => (
                              <td key={w}>
                                {ph.cells[w] === 1 && <div className="bar" />}
                                {ph.cells[w] === 2 && <div className="bar soft" />}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {doc.workplan.foot.length > 0 && (
                    <div className="tl-foot">
                      {doc.workplan.foot.map((f, i) => (
                        <div className="tf" key={i}>
                          <div className="tfl">{tr(f.label)}</div>
                          <div className="tfv">{tr(f.value)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {footer(secs.indexOf("workplan") + 2)}
            </section>
          )}

          {/* ============ INVESTMENT ============ */}
          {doc.investment.enabled && (
            <section className="page white">
              {header}
              <div className="pbody">
                {sectionHead(secs.indexOf("investment") + 1, doc.investment.kicker, doc.investment.title)}
                <div className="summary">
                  <div>
                    <div className="sl">{t.selected}</div>
                    <div className="si">{selForDisplay.items.map((i) => i.label).join(" · ") || "—"}</div>
                  </div>
                  <div>
                    <div className="sl">{t.selectionNote}</div>
                    <div className="si">{tr(doc.investment.hint)}</div>
                  </div>
                  <div className="stot">
                    <div className="sv">{totalLine(selForDisplay)}</div>
                    <div className="sn2">{t.confidential}</div>
                  </div>
                </div>
                {doc.investment.groups.map((g, gi) => {
                  const richCards = g.plans.some((p) => p.features.length > 0 || tr(p.desc));
                  return (
                    <div key={gi}>
                      <div className="gtitle">
                        <b>{tr(g.title)}</b>
                        <span>{tr(g.sub)}</span>
                      </div>
                      <div className={richCards ? `plan-cols ${g.plans.length === 1 ? "solo" : ""}` : ""}>
                        {g.plans.map((p) => {
                          const isSel = (sel[gi] || []).includes(p.key);
                          const badge = tr(p.badge);
                          return richCards ? (
                            <div
                              key={p.key}
                              className={`pi plan-card ${badge ? "rec" : ""} ${isSel ? "selected" : ""}`}
                              onClick={() => toggle(gi, g, p.key)}
                              role="button"
                              tabIndex={0}
                            >
                              {badge && <span className="plan-badge">{badge}</span>}
                              <div className="plan-top">
                                <div className="ck" />
                                <div className="plan-name">
                                  <div className="pt">{tr(p.title)}</div>
                                  {tr(p.sub) && <div className="plan-ar">{tr(p.sub)}</div>}
                                </div>
                                <div className="pp">
                                  {p.oldPrice ? <div className="old">{fmt(p.oldPrice)}</div> : null}
                                  <div className="amt">{fmt(p.price)}</div>
                                  <div className="unit">
                                    {doc.currency} {p.period === "mo" ? t.perMo : t.once}
                                  </div>
                                </div>
                              </div>
                              {tr(p.desc) && <p className="plan-desc">{tr(p.desc)}</p>}
                              {p.features.length > 0 && (
                                <ul className="plan-feats">
                                  {p.features.map((f, fi) => (
                                    <li key={fi}>{tr(f)}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ) : (
                            <div
                              key={p.key}
                              className={`pi ${isSel ? "selected" : ""}`}
                              onClick={() => toggle(gi, g, p.key)}
                              role="button"
                              tabIndex={0}
                            >
                              <div className="ck" />
                              <div>
                                {badge && <span className="badge">{badge}</span>}
                                <div className="pt">{tr(p.title)}</div>
                                {tr(p.desc) && <div className="ps">{tr(p.desc)}</div>}
                              </div>
                              <div className="pp">
                                {p.oldPrice ? <div className="old">{fmt(p.oldPrice)}</div> : null}
                                <div className="amt">{fmt(p.price)}</div>
                                <div className="unit">
                                  {doc.currency} {p.period === "mo" ? t.perMo : t.once}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                <p className="pricing-note">{tr(doc.investment.note)}</p>
              </div>
              {footer(secs.indexOf("investment") + 2)}
            </section>
          )}

          {/* ============ WHY ============ */}
          {doc.why.enabled && (
            <section className="page ink">
              {headerDark}
              <div className="pbody">
                {sectionHead(secs.indexOf("why") + 1, doc.why.kicker, doc.why.title)}
                <div className="why-grid">
                  <div>
                    {doc.why.paras.map((p, i) => (
                      <p key={i}>{rich(tr(p))}</p>
                    ))}
                  </div>
                  <div className="quote">
                    <p>{tr(doc.why.quote)}</p>
                    <div className="qa">{tr(doc.why.quoteSub)}</div>
                    <div className="qm">{doc.why.quoteMark}</div>
                  </div>
                </div>
              </div>
              {footer(secs.indexOf("why") + 2)}
            </section>
          )}

          {/* ============ ACCEPTANCE ============ */}
          <section className="page cream">
            {header}
            <div className="pbody">
              {sectionHead(secs.length + 1, doc.acceptance.kicker, doc.acceptance.title)}
              <div className="accept">
                <div>
                  <p className="ab">{rich(tr(doc.acceptance.body))}</p>
                  <div className="terms">
                    {doc.acceptance.terms.map((term, i) => (
                      <div className="tr2" key={i}>
                        <b>{num(i + 1)}</b>
                        <span>{tr(term)}</span>
                      </div>
                    ))}
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
                  <div className="pv">
                    <b>{t.selectedPlan}</b>
                    <div className="chl">
                      {selForDisplay.items.length ? (
                        selForDisplay.items.map((i, idx) => (
                          <div key={idx}>
                            {i.label} — {fmt(i.price)} {selForDisplay.currency}
                            {i.period === "mo" ? t.perMo : ` ${t.once}`}
                          </div>
                        ))
                      ) : (
                        <div>—</div>
                      )}
                      <div style={{ marginTop: 8 }}>
                        <strong>
                          {t.selected}: {totalLine(selForDisplay)}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {acceptedInfo || submitted ? (
                    <div className="signed-box">
                      <div className="sb-l">{t.acceptedTitle} ✓</div>
                      {acceptedInfo?.by && <div className="sb-name">{acceptedInfo.by}</div>}
                      <div className="sb-meta">
                        {acceptedInfo
                          ? `${t.on} ${new Date(acceptedInfo.at).toLocaleDateString(lang === "ar" ? "ar" : "en-GB")}`
                          : t.acceptedTitle}
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleAccept}>
                      <div className="field">
                        <label htmlFor="mdoc-name">{t.fullName}</label>
                        <input id="mdoc-name" name="name" type="text" required disabled={mode === "preview"} />
                      </div>
                      <div className="field">
                        <label htmlFor="mdoc-title">{t.titleField}</label>
                        <input id="mdoc-title" name="title" type="text" disabled={mode === "preview"} />
                      </div>
                      <div className="field">
                        <label htmlFor="mdoc-date">{t.date}</label>
                        <input id="mdoc-date" name="date" type="date" defaultValue={today} disabled={mode === "preview"} />
                      </div>
                      <div className="field">
                        <label htmlFor="mdoc-notes">{t.notes}</label>
                        <textarea id="mdoc-notes" name="notes" disabled={mode === "preview"} />
                      </div>
                      <button className="submit" type="submit" disabled={mode === "preview" || submitting}>
                        {submitting ? "…" : t.acceptBtn}
                      </button>
                      <div className="smallnote">{t.acceptSmall}</div>
                    </form>
                  )}
                </aside>
              </div>
            </div>
            {footer(totalPages)}
          </section>
        </div>
      </div>

      {/* floating controls (screen only) */}
      {mode === "portal" && clientSlug && (
        <a className="mdoc-back" href={`/portal/${clientSlug}`}>
          {t.backPortal}
        </a>
      )}
      {mode === "portal" && status !== "draft" && (
        <div className="mdoc-statusbar">
          <span className={`dot ${status === "accepted" ? "green" : ""}`} />
          {status === "accepted" ? t.accepted : t.sentNote}
        </div>
      )}
      {mode === "portal" && status === "draft" && (
        <div className="mdoc-statusbar">
          <span className="dot" />
          {t.draftNote}
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
