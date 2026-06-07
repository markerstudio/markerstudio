"use client";

import { useState } from "react";
import { useLang } from "@/lib/useLang";
import { logout } from "@/app/admin/actions";
import type { Client, LocalizedText } from "@/lib/clients";
import styles from "./PortalView.module.css";

const MARKER_LOGO = "/assets/logo-primary-transparent.png";

const TABS = [
  { id: "dashboard", en: "Dashboard", ar: "الرئيسية" },
  { id: "plan", en: "Plan", ar: "الخطة" },
  { id: "social", en: "Social", ar: "السوشال" },
  { id: "analysis", en: "Analysis", ar: "التحليل" },
  { id: "invoices", en: "Invoices", ar: "الفواتير" },
] as const;

const STATUS_PILL: Record<string, string> = {
  paid: styles.pillGreen,
  due: styles.pillBlue,
  overdue: styles.pillRed,
};

export default function PortalView({ client }: { client: Client }) {
  const [lang, setLang] = useLang();
  const [tab, setTab] = useState<string>("dashboard");
  const d = client.data || ({} as Client["data"]);
  const tr = (t?: LocalizedText) => (t ? t[lang] : "");
  const ui = (en: string, ar: string) => (lang === "ar" ? ar : en);

  return (
    <main
      className={styles.app}
      dir={lang === "ar" ? "rtl" : "ltr"}
      style={{ fontFamily: lang === "ar" ? "var(--font-arabic)" : "var(--font-display)" }}
    >
      <div className={styles.topbar}>
        <button className={styles.brand} onClick={() => setTab("dashboard")} aria-label="Home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MARKER_LOGO} alt="Marker Studio" />
        </button>
        <div className={styles.portalTitle}>{client.name}</div>
        <div className={styles.tabs}>
          {TABS.map((t) => (
            <button key={t.id} className={`${styles.tab} ${tab === t.id ? styles.active : ""}`} onClick={() => setTab(t.id)}>
              {ui(t.en, t.ar)}
            </button>
          ))}
        </div>
        <div className={styles.lang} role="group" aria-label="Language">
          <button className={lang === "en" ? styles.on : ""} onClick={() => setLang("en")}>EN</button>
          <button className={lang === "ar" ? styles.on : ""} onClick={() => setLang("ar")}>ع</button>
        </div>
        <form action={logout}>
          <button className={styles.toolbtn}>{ui("Sign out", "خروج")}</button>
        </form>
      </div>

      {tab === "dashboard" && (
        <section className={styles.view}>
          <div className={styles.hero}>
            {d.accent && <div className={styles.heroWatermark}>{d.accent}</div>}
            <div className={styles.heroGrid}>
              <div>
                <div className={styles.kicker}>{ui("Private Client Portal", "بوابة العميل الخاصة")}</div>
                <div className={styles.h1}>{client.name}</div>
                <p className={styles.heroSub}>{tr(d.hero)}</p>
              </div>
              {d.plan && (
                <div className={styles.planChip}>
                  <span className={styles.mini} style={{ color: "rgba(255,255,255,.7)" }}>{ui("Marker plan", "خطة ماركر")}</span>
                  <div className={styles.big} style={{ fontSize: 26, marginTop: 6 }}>
                    {d.plan.active ? ui("Active", "نشطة") : ui("Paused", "متوقفة")}
                  </div>
                  <p className="muted" style={{ color: "rgba(255,255,255,.66)", marginTop: 8, fontSize: 13 }}>
                    {d.plan.start} → {d.plan.end}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className={styles.sectionHead}>
            <div>
              <span className={styles.label}>{ui("Overview", "نظرة عامة")}</span>
              <h2 className={styles.h2}>{tr(d.dashboard?.headline)}</h2>
            </div>
          </div>
          <div className={styles.grid}>
            {(d.dashboard?.cards ?? []).map((c, i) => (
              <div key={i} className={`${styles.card} ${styles.story} ${styles.span3}`}>
                <span className={`${styles.pill} ${i % 2 ? styles.pillHot : ""}`}>{c.tag}</span>
                <div>
                  <div className={styles.big}>{c.value}</div>
                  <p className={styles.muted}>{c.desc}</p>
                </div>
              </div>
            ))}
            {d.dashboard?.diagnosis && (
              <div className={`${styles.card} ${styles.dark} ${styles.span7}`}>
                <span className={styles.label}>{ui("Diagnosis", "التشخيص")}</span>
                <p className={styles.muted} style={{ fontSize: 17 }}>{tr(d.dashboard.diagnosis)}</p>
              </div>
            )}
            {(d.dashboard?.vitals ?? []).length > 0 && (
              <div className={`${styles.card} ${styles.span5}`}>
                <span className={styles.label}>{ui("Account vitals", "مؤشرات الحساب")}</span>
                <div className={styles.bars}>
                  {(d.dashboard?.vitals ?? []).map((v, i) => (
                    <div key={i} className={styles.barline}>
                      <span>{v.label}</span>
                      <i><em style={{ width: `${v.pct}%` }} /></i>
                      <b>{v.note}</b>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {tab === "plan" && (
        <section className={styles.view}>
          <div className={styles.sectionHead}>
            <div>
              <span className={styles.label}>{ui("Marker Plan", "خطة ماركر")}</span>
              <h2 className={styles.h2}>{d.plan?.name}</h2>
            </div>
            <span className={`${styles.pill} ${d.plan?.active ? styles.pillGreen : styles.pillRed}`}>
              {d.plan?.active ? ui("Active", "نشطة") : ui("Paused", "متوقفة")}
            </span>
          </div>
          <div className={styles.grid}>
            <div className={`${styles.card} ${styles.span7}`}>
              <span className={styles.label}>{ui("Cycle", "الدورة")}</span>
              <div className={styles.big} style={{ fontSize: 30, color: "var(--marker-charcoal)" }}>
                {d.plan?.start} → {d.plan?.end}
              </div>
              {d.plan?.note && <p className={styles.muted} style={{ marginTop: 12 }}>{tr(d.plan.note)}</p>}
            </div>
            <div className={`${styles.card} ${styles.span5} ${styles.dark}`}>
              <span className={styles.label}>{ui("Plan document", "وثيقة الخطة")}</span>
              {d.plan?.notionUrl ? (
                <a href={d.plan.notionUrl} target="_blank" rel="noreferrer" className={styles.pill} style={{ background: "var(--marker-orange)", color: "#181818", marginTop: 10 }}>
                  {ui("Open in Notion ↗", "افتح في نوشن ↗")}
                </a>
              ) : (
                <p className={styles.muted}>{ui("The full plan will be shared here.", "ستُشارك الخطة الكاملة هنا.")}</p>
              )}
            </div>
          </div>
        </section>
      )}

      {tab === "social" && (
        <section className={styles.view}>
          <div className={styles.sectionHead}>
            <div>
              <span className={styles.label}>{ui("Social Media Plan", "خطة السوشال ميديا")}</span>
              <h2 className={styles.h2}>{tr(d.social?.headline)}</h2>
            </div>
          </div>
          <div className={styles.grid}>
            {(d.social?.items ?? []).map((s, i) => (
              <div key={i} className={`${styles.card} ${styles.socialItem} ${styles.span3}`}>
                {s.tag && <span className={`${styles.pill} ${styles.pillHot}`}>{s.tag}</span>}
                <h3 style={{ fontSize: 20, letterSpacing: "-.02em" }}>{s.title}</h3>
                <p className={styles.muted}>{s.desc}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "analysis" && (
        <section className={styles.view}>
          <div className={styles.sectionHead}>
            <div>
              <span className={styles.label}>{ui("Organic", "المحتوى العضوي")}</span>
              <h2 className={styles.h2}>{tr(d.analysis?.organic?.headline)}</h2>
            </div>
          </div>
          <div className={styles.card}>
            {(d.analysis?.organic?.metrics ?? []).map((m, i) => (
              <div key={i} className={styles.metricRow}>
                <div className={styles.metricTitle}>{m.label}</div>
                <div><span className={styles.mini}>{ui("Before", "قبل")}</span><div className={styles.big} style={{ fontSize: 26, color: "var(--marker-charcoal)" }}>{m.before}</div></div>
                <div><span className={styles.mini}>{ui("After", "بعد")}</span><div className={styles.big} style={{ fontSize: 26 }}>{m.after}</div></div>
                <div className={`${styles.muted} explain`}>{m.note}</div>
              </div>
            ))}
          </div>
          {d.analysis?.organic?.reading && (
            <div className={styles.grid} style={{ marginTop: 16 }}>
              <div className={`${styles.card} ${styles.span12}`}>
                <span className={styles.label}>{ui("Reading", "قراءة")}</span>
                <p className={styles.muted} style={{ fontSize: 17 }}>{tr(d.analysis.organic.reading)}</p>
              </div>
            </div>
          )}

          <div className={styles.sectionHead}>
            <div>
              <span className={styles.label}>{ui("Paid Campaigns", "الحملات المدفوعة")}</span>
              <h2 className={styles.h2}>{ui("What each campaign did.", "شو عملت كل حملة.")}</h2>
            </div>
            {d.analysis?.paid?.spend && <span className={`${styles.pill} ${styles.pillHot}`}>{ui("Total spend", "الإنفاق")}: {d.analysis.paid.spend}</span>}
          </div>
          {d.analysis?.paid?.note && <p className={styles.muted} style={{ marginBottom: 14 }}>{tr(d.analysis.paid.note)}</p>}
          <div style={{ display: "grid", gap: 12 }}>
            {(d.analysis?.paid?.campaigns ?? []).map((c, i) => (
              <div key={i} className={styles.campaign}>
                <div className={styles.campaignHead}>
                  <div>
                    <b style={{ fontSize: 16 }}>{c.name}</b>
                    <div className={styles.muted} style={{ fontSize: 12, fontWeight: 700 }}>{c.period} · {c.type}</div>
                  </div>
                  <span className={`${styles.pill} ${styles.pillHot}`}>{c.spend}</span>
                </div>
                <p className={styles.muted} style={{ marginTop: 10 }}>{c.desc}</p>
                <div className={styles.campaignStats}>
                  <div className={styles.statbox}><strong>{c.reach}</strong><span>{ui("Reach", "وصول")}</span></div>
                  <div className={styles.statbox}><strong>{c.impressions}</strong><span>{ui("Impressions", "ظهور")}</span></div>
                  <div className={styles.statbox}><strong>{c.freq}</strong><span>{ui("Frequency", "تكرار")}</span></div>
                  <div className={styles.statbox}><strong>{c.cpm}</strong><span>CPM</span></div>
                  <div className={styles.statbox}><strong>{c.spend}</strong><span>{ui("Spent", "صُرف")}</span></div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "invoices" && (
        <section className={styles.view}>
          <div className={styles.sectionHead}>
            <div>
              <span className={styles.label}>{ui("Invoices", "الفواتير")}</span>
              <h2 className={styles.h2}>{ui("Billing cycles.", "دورات الفوترة.")}</h2>
            </div>
          </div>
          <div className={styles.card}>
            {(d.invoices ?? []).map((inv, i) => (
              <div key={i} className={styles.invoice}>
                <div>
                  <b>{inv.cycle}</b>
                  <div className={styles.muted}>{inv.desc}</div>
                </div>
                <div className={styles.big} style={{ fontSize: 24 }}>{inv.amount}</div>
                <span className={`${styles.pill} ${STATUS_PILL[inv.status] || ""}`}>
                  {inv.status === "paid" ? ui("Paid", "مدفوعة") : inv.status === "overdue" ? ui("Overdue", "متأخرة") : ui("Due", "مستحقة")}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <footer className={styles.footer}>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MARKER_LOGO} alt="Marker" /><br />
          {ui("We mark the brands that matter.", "نعلّم على العلامات التي تستحقّ.")}
        </div>
        <div>{client.name} · {ui("Private portal", "بوابة خاصة")}</div>
      </footer>
    </main>
  );
}
