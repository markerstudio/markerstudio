"use client";

import { useState } from "react";
import { useLang } from "@/lib/useLang";
import { logout } from "@/app/admin/actions";
import type { Client, LocalizedText } from "@/lib/clients";

const MARKER_LOGO = "/assets/logo-primary-transparent.png";

const TABS = [
  { id: "dashboard", en: "Dashboard", ar: "الرئيسية" },
  { id: "plan", en: "Plan", ar: "الخطة" },
  { id: "social", en: "Social", ar: "السوشال" },
  { id: "analysis", en: "Analysis", ar: "التحليل" },
  { id: "invoices", en: "Invoices", ar: "الفواتير" },
  { id: "documents", en: "Documents", ar: "المستندات" },
] as const;

const STATUS_PILL: Record<string, string> = {
  paid: "ms-portal-pill--green",
  due: "ms-portal-pill--blue",
  overdue: "ms-portal-pill--red",
};

export default function PortalView({ client }: { client: Client }) {
  const [lang, setLang] = useLang();
  const [tab, setTab] = useState<string>("dashboard");
  const d = client.data || ({} as Client["data"]);
  const tr = (t?: LocalizedText) => (t ? t[lang] : "");
  const ui = (en: string, ar: string) => (lang === "ar" ? ar : en);

  return (
    <div className="ms-portal" dir={lang === "ar" ? "rtl" : "ltr"}>
      {/* Site-style header */}
      <header className="ms-header">
        <div className="ms-container ms-header__inner">
          <button className="ms-logo" onClick={() => setTab("dashboard")} aria-label="Dashboard" style={{ border: 0, background: "none", cursor: "pointer" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={MARKER_LOGO} alt="Marker Studio" />
          </button>
          <span className="ms-portal-name">{client.name} · {ui("Portal", "البوابة")}</span>
          <nav className="ms-portal-tabs">
            {TABS.map((t) => (
              <button key={t.id} className={`ms-portal-tab ${tab === t.id ? "is-active" : ""}`} onClick={() => setTab(t.id)}>
                {ui(t.en, t.ar)}
              </button>
            ))}
          </nav>
          <div className="ms-actions">
            <div className="ms-lang" role="group" aria-label="Language">
              <button className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>EN</button>
              <button className={lang === "ar" ? "on" : ""} onClick={() => setLang("ar")}>ع</button>
            </div>
            <form action={logout}>
              <button className="ms-btn ms-btn-outline ms-portal-signout">{ui("Sign out", "خروج")}</button>
            </form>
          </div>
        </div>
      </header>

      {/* DASHBOARD */}
      {tab === "dashboard" && (
        <>
          <section className="ms-portal-hero">
            <div className="ms-container">
              <span className="ms-portal-hero__eyebrow">{ui("Private client portal", "بوابة العميل الخاصة")}</span>
              <h1 className="ms-portal-hero__title">{client.name}</h1>
              <p className="ms-portal-hero__sub">{tr(d.hero)}</p>
              {d.plan && (
                <div className="ms-portal-hero__meta">
                  <span className={`ms-portal-status ${d.plan.active ? "ms-portal-status--on" : "ms-portal-status--off"}`}>
                    {d.plan.active ? ui("Plan active", "الخطة نشطة") : ui("Plan paused", "الخطة متوقفة")}
                  </span>
                  {(d.plan.start || d.plan.end) && <span className="ms-portal-dates">{d.plan.start} → {d.plan.end}</span>}
                </div>
              )}
            </div>
          </section>

          <section className="ms-section">
            <div className="ms-container">
              <div className="ms-section__header">
                <div>
                  <span className="ms-section__eyebrow">{ui("Overview", "نظرة عامة")}</span>
                  <h2 className="ms-section__title">{tr(d.dashboard?.headline)}</h2>
                </div>
              </div>
              <div className="ms-portal-grid">
                {(d.dashboard?.cards ?? []).map((c, i) => (
                  <div key={i} className="ms-pcard ms-pcard--story pc-3">
                    <span className={`ms-portal-pill ${i % 2 ? "ms-portal-pill--orange" : ""}`}>{c.tag}</span>
                    <div>
                      <div className="ms-portal-big">{c.value}</div>
                      <p className="ms-pmuted">{c.desc}</p>
                    </div>
                  </div>
                ))}
                {d.dashboard?.diagnosis && (
                  <div className="ms-pcard ms-pcard--dark pc-7">
                    <span className="ms-section__eyebrow">{ui("Diagnosis", "التشخيص")}</span>
                    <p className="ms-pmuted" style={{ fontSize: 17 }}>{tr(d.dashboard.diagnosis)}</p>
                  </div>
                )}
                {(d.dashboard?.vitals ?? []).length > 0 && (
                  <div className="ms-pcard pc-5">
                    <span className="ms-section__eyebrow">{ui("Account vitals", "مؤشرات الحساب")}</span>
                    <div className="ms-portal-bars">
                      {(d.dashboard?.vitals ?? []).map((v, i) => (
                        <div key={i} className="ms-portal-bar">
                          <span>{v.label}</span>
                          <i><em style={{ width: `${v.pct}%` }} /></i>
                          <b>{v.note}</b>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </>
      )}

      {/* PLAN */}
      {tab === "plan" && (
        <section className="ms-section">
          <div className="ms-container">
            <div className="ms-section__header">
              <div>
                <span className="ms-section__eyebrow">{ui("Marker Plan", "خطة ماركر")}</span>
                <h2 className="ms-section__title">{d.plan?.name}</h2>
              </div>
              <span className={`ms-portal-pill ${d.plan?.active ? "ms-portal-pill--green" : "ms-portal-pill--red"}`}>
                {d.plan?.active ? ui("Active", "نشطة") : ui("Paused", "متوقفة")}
              </span>
            </div>
            <div className="ms-portal-grid">
              <div className="ms-pcard pc-7">
                <span className="ms-portal-mini">{ui("Cycle", "الدورة")}</span>
                <div className="ms-portal-big" style={{ fontSize: 30, color: "var(--marker-ink)", marginTop: 6 }}>
                  {d.plan?.start} → {d.plan?.end}
                </div>
                {d.plan?.note && <p className="ms-pmuted" style={{ marginTop: 12 }}>{tr(d.plan.note)}</p>}
              </div>
              <div className="ms-pcard ms-pcard--dark pc-5">
                <span className="ms-section__eyebrow">{ui("Plan document", "وثيقة الخطة")}</span>
                {d.plan?.notionUrl ? (
                  <a href={d.plan.notionUrl} target="_blank" rel="noreferrer" className="ms-btn ms-btn-primary" style={{ marginTop: 12 }}>
                    {ui("Open in Notion", "افتح في نوشن")} <span>↗</span>
                  </a>
                ) : (
                  <p className="ms-pmuted">{ui("The full plan will be shared here.", "ستُشارك الخطة الكاملة هنا.")}</p>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* SOCIAL */}
      {tab === "social" && (
        <section className="ms-section">
          <div className="ms-container">
            <div className="ms-section__header">
              <div>
                <span className="ms-section__eyebrow">{ui("Social Media Plan", "خطة السوشال ميديا")}</span>
                <h2 className="ms-section__title">{tr(d.social?.headline)}</h2>
              </div>
            </div>
            <div className="ms-portal-grid">
              {(d.social?.items ?? []).map((s, i) => (
                <div key={i} className="ms-pcard ms-pcard--story pc-3">
                  {s.tag && <span className="ms-portal-pill ms-portal-pill--orange">{s.tag}</span>}
                  <div>
                    <h3 className="ms-pcard__h">{s.title}</h3>
                    <p className="ms-pmuted">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ANALYSIS */}
      {tab === "analysis" && (
        <section className="ms-section">
          <div className="ms-container">
            <div className="ms-section__header">
              <div>
                <span className="ms-section__eyebrow">{ui("Organic content", "المحتوى العضوي")}</span>
                <h2 className="ms-section__title">{tr(d.analysis?.organic?.headline)}</h2>
              </div>
            </div>
            <div className="ms-pcard">
              {(d.analysis?.organic?.metrics ?? []).map((m, i) => (
                <div key={i} className="ms-portal-metric">
                  <div className="ms-portal-metric__title">{m.label}</div>
                  <div><span className="ms-portal-mini">{ui("Before", "قبل")}</span><div className="ms-portal-big" style={{ fontSize: 26, color: "var(--marker-ink)" }}>{m.before}</div></div>
                  <div><span className="ms-portal-mini">{ui("After", "بعد")}</span><div className="ms-portal-big" style={{ fontSize: 26 }}>{m.after}</div></div>
                  <div className="ms-pmuted ms-portal-metric__note">{m.note}</div>
                </div>
              ))}
            </div>
            {d.analysis?.organic?.reading && (
              <div className="ms-portal-grid" style={{ marginTop: 16 }}>
                <div className="ms-pcard pc-12">
                  <span className="ms-section__eyebrow">{ui("Reading", "قراءة")}</span>
                  <p className="ms-pmuted" style={{ fontSize: 17 }}>{tr(d.analysis.organic.reading)}</p>
                </div>
              </div>
            )}

            <div className="ms-section__header" style={{ marginTop: 40 }}>
              <div>
                <span className="ms-section__eyebrow">{ui("Paid campaigns", "الحملات المدفوعة")}</span>
                <h2 className="ms-section__title">{ui("What each campaign did.", "شو عملت كل حملة.")}</h2>
              </div>
              {d.analysis?.paid?.spend && <span className="ms-portal-pill ms-portal-pill--orange">{ui("Total spend", "الإنفاق")}: {d.analysis.paid.spend}</span>}
            </div>
            {d.analysis?.paid?.note && <p className="ms-pmuted" style={{ marginBottom: 14 }}>{tr(d.analysis.paid.note)}</p>}
            <div>
              {(d.analysis?.paid?.campaigns ?? []).map((c, i) => (
                <div key={i} className="ms-portal-campaign">
                  <div className="ms-portal-campaign__head">
                    <div>
                      <b style={{ fontSize: 16 }}>{c.name}</b>
                      <div className="ms-pmuted" style={{ fontSize: 12, fontWeight: 700 }}>{c.period} · {c.type}</div>
                    </div>
                    <span className="ms-portal-pill ms-portal-pill--orange">{c.spend}</span>
                  </div>
                  <p className="ms-pmuted" style={{ marginTop: 10 }}>{c.desc}</p>
                  <div className="ms-portal-stats">
                    <div className="ms-portal-stat"><strong>{c.reach}</strong><span>{ui("Reach", "وصول")}</span></div>
                    <div className="ms-portal-stat"><strong>{c.impressions}</strong><span>{ui("Impressions", "ظهور")}</span></div>
                    <div className="ms-portal-stat"><strong>{c.freq}</strong><span>{ui("Frequency", "تكرار")}</span></div>
                    <div className="ms-portal-stat"><strong>{c.cpm}</strong><span>CPM</span></div>
                    <div className="ms-portal-stat"><strong>{c.spend}</strong><span>{ui("Spent", "صُرف")}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* INVOICES */}
      {tab === "invoices" && (
        <section className="ms-section">
          <div className="ms-container">
            <div className="ms-section__header">
              <div>
                <span className="ms-section__eyebrow">{ui("Invoices", "الفواتير")}</span>
                <h2 className="ms-section__title">{ui("Billing cycles.", "دورات الفوترة.")}</h2>
              </div>
            </div>
            <div>
              {(d.invoices ?? []).map((inv, i) => (
                <div key={i} className="ms-portal-invoice">
                  <div>
                    <b>{inv.cycle}</b>
                    <div className="ms-pmuted">{inv.desc}</div>
                  </div>
                  <div className="ms-portal-big" style={{ fontSize: 24, color: "var(--marker-ink)" }}>{inv.amount}</div>
                  <span className={`ms-portal-pill ${STATUS_PILL[inv.status] || ""}`}>
                    {inv.status === "paid" ? ui("Paid", "مدفوعة") : inv.status === "overdue" ? ui("Overdue", "متأخرة") : ui("Due", "مستحقة")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {tab === "documents" && (
        <section className="ms-section">
          <div className="ms-container">
            <div className="ms-section__header">
              <div>
                <span className="ms-section__eyebrow">{ui("Documents", "المستندات")}</span>
                <h2 className="ms-section__title">{ui("Proposals & agreements.", "العروض والاتفاقيات.")}</h2>
              </div>
            </div>
            <div className="ms-portal-grid">
              {(d.documents ?? []).map((doc, i) => (
                <div key={i} className="ms-pcard pc-4" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <span className="ms-portal-pill ms-portal-pill--orange" style={{ alignSelf: "flex-start" }}>{doc.type || "DOC"}</span>
                  <h3 className="ms-pcard__h" style={{ margin: 0 }}>{doc.title}</h3>
                  {doc.url ? (
                    <a href={doc.url} target="_blank" rel="noreferrer" className="ms-btn ms-btn-outline" style={{ alignSelf: "flex-start" }}>
                      {ui("Open", "فتح")} <span>↗</span>
                    </a>
                  ) : (
                    <span className="ms-pmuted">{ui("Shared soon.", "ستُشارك قريباً.")}</span>
                  )}
                </div>
              ))}
              {(d.documents ?? []).length === 0 && (
                <div className="ms-pcard pc-12"><p className="ms-pmuted">{ui("No documents yet.", "لا مستندات بعد.")}</p></div>
              )}
            </div>
          </div>
        </section>
      )}

      <footer className="ms-footer">
        <div className="ms-container">
          <div className="ms-footer__bottom" style={{ borderTop: "none", paddingTop: 0 }}>
            <span>{ui("We mark the brands that matter.", "نعلّم على العلامات التي تستحقّ.")}</span>
            <span>{client.name} · {ui("Private portal", "بوابة خاصة")}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
