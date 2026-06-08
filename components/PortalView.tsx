"use client";

import { useState } from "react";
import { useLang } from "@/lib/useLang";
import { logout, updateClientData } from "@/app/admin/actions";
import SocialCalendar from "@/components/SocialCalendar";
import type { Client, ClientData, LocalizedText } from "@/lib/clients";

const MARKER_LOGO = "/assets/logo-primary-transparent.png";

const TABS = [
  { id: "dashboard", en: "Dashboard", ar: "الرئيسية" },
  { id: "plan", en: "Plan", ar: "الخطة" },
  { id: "social", en: "Social", ar: "السوشال" },
  { id: "analysis", en: "Analysis", ar: "التحليل" },
  { id: "invoices", en: "Finance", ar: "المالية" },
  { id: "documents", en: "Documents", ar: "المستندات" },
] as const;

const STATUS_PILL: Record<string, string> = {
  paid: "ms-portal-pill--green",
  due: "ms-portal-pill--blue",
  overdue: "ms-portal-pill--red",
};

export default function PortalView({
  client,
  canEdit = false,
  initialEdit = false,
}: {
  client: Client;
  canEdit?: boolean;
  initialEdit?: boolean;
}) {
  const [lang, setLang] = useLang();
  const [tab, setTab] = useState<string>("dashboard");
  const [data, setData] = useState<ClientData>(client.data);
  const [edit, setEdit] = useState<boolean>(initialEdit && canEdit);
  const [saving, setSaving] = useState<"" | "saving" | "saved" | "error">("");

  const d = data;
  const tr = (b?: LocalizedText) => (b ? b[lang] : "");
  const ui = (en: string, ar: string) => (lang === "ar" ? ar : en);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const up = (fn: (c: any) => void) => setData((prev) => { const c = JSON.parse(JSON.stringify(prev)); fn(c); return c; });

  // Inline editor: returns plain text in view mode, an input/textarea in edit
  // mode. A function (not a component) so React keeps input focus on re-render.
  const f = (value: string, on: (s: string) => void, area = false, ph = "") =>
    !edit ? (
      <>{value}</>
    ) : area ? (
      <textarea className="ms-edit" rows={2} value={value} placeholder={ph} dir="auto" onChange={(e) => on(e.target.value)} />
    ) : (
      <input className="ms-edit" value={value} placeholder={ph} dir="auto" onChange={(e) => on(e.target.value)} />
    );
  const del = (on: () => void) => (edit ? <button type="button" className="ms-edit-del" onClick={on} aria-label="Remove">✕</button> : null);
  const add = (on: () => void, label: string) => (edit ? <button type="button" className="ms-edit-add" onClick={on}>+ {label}</button> : null);

  async function save() {
    setSaving("saving");
    const r = await updateClientData(client.slug, JSON.stringify(data));
    setSaving(r?.ok ? "saved" : "error");
    if (r?.ok) setTimeout(() => setSaving(""), 1600);
  }

  return (
    <div className="ms-portal" dir={lang === "ar" ? "rtl" : "ltr"}>
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
              <p className="ms-portal-hero__sub">{f(tr(d.hero), (v) => up((c) => (c.hero[lang] = v)), true, ui("Intro line…", "سطر تعريفي…"))}</p>
              {d.plan && (
                <div className="ms-portal-hero__meta">
                  <span className={`ms-portal-status ${d.plan.active ? "ms-portal-status--on" : "ms-portal-status--off"}`}>
                    {d.plan.active ? ui("Plan active", "الخطة نشطة") : ui("Plan paused", "الخطة متوقفة")}
                  </span>
                  <span className="ms-portal-dates">{d.plan.end ? `${d.plan.start} → ${d.plan.end}` : d.plan.start ? `${ui("Since", "منذ")} ${d.plan.start} · ${ui("Ongoing", "مستمرّة")}` : ui("Ongoing", "مستمرّة")}</span>
                </div>
              )}
            </div>
          </section>

          <section className="ms-section">
            <div className="ms-container">
              <div className="ms-section__header">
                <div>
                  <span className="ms-section__eyebrow">{ui("Overview", "نظرة عامة")}</span>
                  <h2 className="ms-section__title">{f(tr(d.dashboard?.headline), (v) => up((c) => (c.dashboard.headline[lang] = v)), false, ui("Headline…", "عنوان…"))}</h2>
                </div>
              </div>
              <div className="ms-portal-grid">
                {(d.dashboard?.cards ?? []).map((c, i) => (
                  <div key={i} className="ms-pcard ms-pcard--story pc-3">
                    {del(() => up((x) => x.dashboard.cards.splice(i, 1)))}
                    <span className="ms-portal-pill">{f(c.tag, (v) => up((x) => (x.dashboard.cards[i].tag = v)), false, "Tag")}</span>
                    <div>
                      <div className="ms-portal-big">{f(c.value, (v) => up((x) => (x.dashboard.cards[i].value = v)), false, "Value")}</div>
                      <p className="ms-pmuted">{f(c.desc, (v) => up((x) => (x.dashboard.cards[i].desc = v)), true, "Description")}</p>
                    </div>
                  </div>
                ))}
                {edit && <div className="pc-3" style={{ display: "flex", alignItems: "center" }}>{add(() => up((c) => c.dashboard.cards.push({ tag: "", value: "", desc: "" })), ui("Add card", "بطاقة"))}</div>}

                {(edit || tr(d.dashboard?.diagnosis)) && (
                  <div className="ms-pcard ms-pcard--dark pc-7">
                    <span className="ms-section__eyebrow">{ui("Diagnosis", "التشخيص")}</span>
                    <p className="ms-pmuted" style={{ fontSize: 17 }}>{f(tr(d.dashboard?.diagnosis), (v) => up((c) => (c.dashboard.diagnosis[lang] = v)), true, ui("Diagnosis…", "تشخيص…"))}</p>
                  </div>
                )}
                {(edit || (d.dashboard?.vitals ?? []).length > 0) && (
                  <div className="ms-pcard pc-5">
                    <span className="ms-section__eyebrow">{ui("Account vitals", "مؤشرات الحساب")}</span>
                    <div className="ms-portal-bars">
                      {(d.dashboard?.vitals ?? []).map((v, i) => (
                        <div key={i} className="ms-portal-bar" style={edit ? { gridTemplateColumns: "1fr", gap: 4 } : undefined}>
                          {edit ? (
                            <>
                              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                <input className="ms-edit" style={{ flex: 1 }} value={v.label} placeholder="Label" onChange={(e) => up((c) => (c.dashboard.vitals[i].label = e.target.value))} />
                                <input className="ms-edit" style={{ width: 90 }} value={v.note} placeholder="Note" onChange={(e) => up((c) => (c.dashboard.vitals[i].note = e.target.value))} />
                                {del(() => up((c) => c.dashboard.vitals.splice(i, 1)))}
                              </div>
                              <input type="range" min={0} max={100} value={v.pct} className="w-full accent-orange" onChange={(e) => up((c) => (c.dashboard.vitals[i].pct = Number(e.target.value)))} />
                            </>
                          ) : (
                            <>
                              <span>{v.label}</span>
                              <i><em style={{ width: `${v.pct}%` }} /></i>
                              <b>{v.note}</b>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                    {add(() => up((c) => c.dashboard.vitals.push({ label: "", pct: 50, note: "" })), ui("Add vital", "مؤشر"))}
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
                <h2 className="ms-section__title">{f(d.plan?.name ?? "", (v) => up((c) => (c.plan.name = v)), false, ui("Plan name…", "اسم الخطة…"))}</h2>
              </div>
              {edit ? (
                <label className="ms-portal-pill" style={{ gap: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={!!d.plan?.active} onChange={(e) => up((c) => (c.plan.active = e.target.checked))} /> {ui("Active", "نشطة")}
                </label>
              ) : (
                <span className={`ms-portal-pill ${d.plan?.active ? "ms-portal-pill--green" : "ms-portal-pill--red"}`}>
                  {d.plan?.active ? ui("Active", "نشطة") : ui("Paused", "متوقفة")}
                </span>
              )}
            </div>
            <div className="ms-portal-grid">
              <div className="ms-pcard pc-7">
                <span className="ms-portal-mini">{ui("Cycle", "الدورة")}</span>
                <div className="ms-portal-big" style={{ fontSize: 30, color: "var(--marker-ink)", marginTop: 6, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  {edit ? (
                    <>{f(d.plan?.start ?? "", (v) => up((c) => (c.plan.start = v)), false, "Start")} <span>→</span> {f(d.plan?.end ?? "", (v) => up((c) => (c.plan.end = v)), false, ui("End (blank = ongoing)", "النهاية"))}</>
                  ) : d.plan?.end ? (
                    `${d.plan.start} → ${d.plan.end}`
                  ) : (
                    `${d.plan?.start ? d.plan.start + " · " : ""}${ui("Ongoing", "مستمرّة")}`
                  )}
                </div>
                <p className="ms-pmuted" style={{ marginTop: 12 }}>{f(tr(d.plan?.note), (v) => up((c) => (c.plan.note[lang] = v)), true, ui("Note…", "ملاحظة…"))}</p>
              </div>
              <div className="ms-pcard ms-pcard--dark pc-5">
                <span className="ms-section__eyebrow">{ui("Plan document", "وثيقة الخطة")}</span>
                {edit ? (
                  <input className="ms-edit" value={d.plan?.notionUrl ?? ""} placeholder="https://notion.so/…" onChange={(e) => up((c) => (c.plan.notionUrl = e.target.value))} />
                ) : d.plan?.notionUrl ? (
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
                <h2 className="ms-section__title">{f(tr(d.social?.headline), (v) => up((c) => (c.social.headline[lang] = v)), false, ui("Headline…", "عنوان…"))}</h2>
              </div>
            </div>
            <SocialCalendar posts={d.social?.posts ?? []} editable={edit} lang={lang} onChange={(posts) => up((c) => (c.social.posts = posts))} />
            {edit && <p className="ms-pmuted" style={{ marginTop: 10, fontSize: 13 }}>{ui("Click a day to add or edit posts.", "اضغط على يوم لإضافة أو تعديل المنشورات.")}</p>}
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
                <h2 className="ms-section__title">{f(tr(d.analysis?.organic?.headline), (v) => up((c) => (c.analysis.organic.headline[lang] = v)), false, ui("Headline…", "عنوان…"))}</h2>
              </div>
            </div>
            <div className="ms-pcard">
              {(d.analysis?.organic?.metrics ?? []).map((m, i) => (
                <div key={i} className="ms-portal-metric" style={{ position: "relative" }}>
                  <div className="ms-portal-metric__title">{f(m.label, (v) => up((c) => (c.analysis.organic.metrics[i].label = v)), false, "Metric")}</div>
                  <div><span className="ms-portal-mini">{ui("Before", "قبل")}</span><div className="ms-portal-big" style={{ fontSize: 26, color: "var(--marker-ink)" }}>{f(m.before, (v) => up((c) => (c.analysis.organic.metrics[i].before = v)), false, "—")}</div></div>
                  <div><span className="ms-portal-mini">{ui("After", "بعد")}</span><div className="ms-portal-big" style={{ fontSize: 26 }}>{f(m.after, (v) => up((c) => (c.analysis.organic.metrics[i].after = v)), false, "—")}</div></div>
                  <div className="ms-pmuted ms-portal-metric__note">{f(m.note, (v) => up((c) => (c.analysis.organic.metrics[i].note = v)), true, "Note")}{del(() => up((c) => c.analysis.organic.metrics.splice(i, 1)))}</div>
                </div>
              ))}
              <div style={{ marginTop: 12 }}>{add(() => up((c) => c.analysis.organic.metrics.push({ label: "", before: "", after: "", note: "" })), ui("Add metric", "مؤشر"))}</div>
            </div>
            {(edit || tr(d.analysis?.organic?.reading)) && (
              <div className="ms-portal-grid" style={{ marginTop: 16 }}>
                <div className="ms-pcard pc-12">
                  <span className="ms-section__eyebrow">{ui("Reading", "قراءة")}</span>
                  <p className="ms-pmuted" style={{ fontSize: 17 }}>{f(tr(d.analysis?.organic?.reading), (v) => up((c) => (c.analysis.organic.reading[lang] = v)), true, ui("Reading…", "قراءة…"))}</p>
                </div>
              </div>
            )}

            <div className="ms-section__header" style={{ marginTop: 40 }}>
              <div>
                <span className="ms-section__eyebrow">{ui("Paid campaigns", "الحملات المدفوعة")}</span>
                <h2 className="ms-section__title">{ui("What each campaign did.", "شو عملت كل حملة.")}</h2>
              </div>
              <span className="ms-portal-pill ms-portal-pill--orange">{ui("Total spend", "الإنفاق")}: {f(d.analysis?.paid?.spend ?? "", (v) => up((c) => (c.analysis.paid.spend = v)), false, "$0")}</span>
            </div>
            <p className="ms-pmuted" style={{ marginBottom: 14 }}>{f(tr(d.analysis?.paid?.note), (v) => up((c) => (c.analysis.paid.note[lang] = v)), true, ui("Note…", "ملاحظة…"))}</p>
            <div>
              {(d.analysis?.paid?.campaigns ?? []).map((c, i) => (
                <div key={i} className="ms-portal-campaign" style={{ position: "relative" }}>
                  {del(() => up((x) => x.analysis.paid.campaigns.splice(i, 1)))}
                  <div className="ms-portal-campaign__head">
                    <div>
                      <b style={{ fontSize: 16 }}>{f(c.name, (v) => up((x) => (x.analysis.paid.campaigns[i].name = v)), false, "Campaign")}</b>
                      <div className="ms-pmuted" style={{ fontSize: 12, fontWeight: 700 }}>{f(c.period, (v) => up((x) => (x.analysis.paid.campaigns[i].period = v)), false, "Period")} · {f(c.type, (v) => up((x) => (x.analysis.paid.campaigns[i].type = v)), false, "Type")}</div>
                    </div>
                    <span className="ms-portal-pill ms-portal-pill--orange">{f(c.spend, (v) => up((x) => (x.analysis.paid.campaigns[i].spend = v)), false, "$")}</span>
                  </div>
                  <p className="ms-pmuted" style={{ marginTop: 10 }}>{f(c.desc, (v) => up((x) => (x.analysis.paid.campaigns[i].desc = v)), true, "Description")}</p>
                  <div className="ms-portal-stats">
                    {([["reach", ui("Reach", "وصول")], ["impressions", ui("Impressions", "ظهور")], ["freq", ui("Frequency", "تكرار")], ["cpm", "CPM"], ["spend", ui("Spent", "صُرف")]] as const).map(([k, labelText]) => (
                      <div className="ms-portal-stat" key={k}>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        <strong>{f((c as any)[k], (v) => up((x) => (x.analysis.paid.campaigns[i][k] = v)), false, "")}</strong>
                        <span>{labelText}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 12 }}>{add(() => up((c) => c.analysis.paid.campaigns.push({ name: "", period: "", type: "", spend: "", reach: "", impressions: "", freq: "", cpm: "", desc: "" })), ui("Add campaign", "حملة"))}</div>
            </div>
          </div>
        </section>
      )}

      {/* FINANCE */}
      {tab === "invoices" && (
        <section className="ms-section">
          <div className="ms-container">
            <div className="ms-section__header">
              <div>
                <span className="ms-section__eyebrow">{ui("Finance", "المالية")}</span>
                <h2 className="ms-section__title">{ui("Payments & balance.", "المدفوعات والرصيد.")}</h2>
              </div>
            </div>

            <div className="ms-portal-grid">
              <div className="ms-pcard pc-4">
                <span className="ms-portal-mini">{ui("Money left", "المبلغ المتبقّي")}</span>
                <div className="ms-portal-big" style={{ marginTop: 8 }}>{f(d.plan?.balance ?? "", (v) => up((c) => (c.plan.balance = v)), false, "—")}</div>
              </div>
              <div className="ms-pcard pc-4">
                <span className="ms-portal-mini">{ui("Paid to date", "المدفوع حتى الآن")}</span>
                <div className="ms-portal-big" style={{ marginTop: 8, color: "var(--marker-ink)" }}>{f(d.finance?.paid ?? "", (v) => up((c) => { if (!c.finance) c.finance = { paid: "", progress: 0 }; c.finance.paid = v; }), false, "—")}</div>
              </div>
              <div className="ms-pcard pc-4">
                <span className="ms-portal-mini">{ui("Progress", "نسبة السداد")}</span>
                {edit ? (
                  <input type="range" min={0} max={100} value={d.finance?.progress ?? 0} className="w-full accent-orange" style={{ marginTop: 12 }} onChange={(e) => up((c) => { if (!c.finance) c.finance = { paid: "", progress: 0 }; c.finance.progress = Number(e.target.value); })} />
                ) : (
                  <>
                    <div className="ms-portal-big" style={{ marginTop: 8 }}>{d.finance?.progress ?? 0}%</div>
                    <div style={{ height: 6, background: "var(--marker-charcoal-10)", borderRadius: 999, overflow: "hidden", marginTop: 10 }}>
                      <div style={{ height: "100%", width: `${d.finance?.progress ?? 0}%`, background: "var(--marker-orange)", borderRadius: 999 }} />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="ms-section__header" style={{ marginTop: 40 }}>
              <div><span className="ms-section__eyebrow">{ui("Payment history", "سجلّ المدفوعات")}</span></div>
            </div>
            <div>
              {(d.invoices ?? []).map((inv, i) => (
                <div key={i} className="ms-portal-invoice" style={{ position: "relative" }}>
                  {del(() => up((c) => c.invoices.splice(i, 1)))}
                  <div>
                    <b>{f(inv.cycle, (v) => up((c) => (c.invoices[i].cycle = v)), false, "Cycle")}</b>
                    <div className="ms-pmuted">{f(inv.desc, (v) => up((c) => (c.invoices[i].desc = v)), false, "Description")}</div>
                  </div>
                  <div className="ms-portal-big" style={{ fontSize: 24, color: "var(--marker-ink)" }}>{f(inv.amount, (v) => up((c) => (c.invoices[i].amount = v)), false, "0")}</div>
                  {edit ? (
                    <select className="ms-edit" value={inv.status} onChange={(e) => up((c) => (c.invoices[i].status = e.target.value))}>
                      <option value="paid">{ui("Paid", "مدفوعة")}</option>
                      <option value="due">{ui("Due", "مستحقة")}</option>
                      <option value="overdue">{ui("Overdue", "متأخرة")}</option>
                    </select>
                  ) : (
                    <span className={`ms-portal-pill ${STATUS_PILL[inv.status] || ""}`}>
                      {inv.status === "paid" ? ui("Paid", "مدفوعة") : inv.status === "overdue" ? ui("Overdue", "متأخرة") : ui("Due", "مستحقة")}
                    </span>
                  )}
                </div>
              ))}
              <div style={{ marginTop: 12 }}>{add(() => up((c) => c.invoices.push({ cycle: "", desc: "", amount: "", status: "due" })), ui("Add payment", "دفعة"))}</div>
            </div>
          </div>
        </section>
      )}

      {/* DOCUMENTS */}
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
                <div key={i} className="ms-pcard pc-4" style={{ display: "flex", flexDirection: "column", gap: 14, position: "relative" }}>
                  {del(() => up((c) => c.documents.splice(i, 1)))}
                  <span className="ms-portal-pill ms-portal-pill--orange" style={{ alignSelf: "flex-start" }}>{f(doc.type || "DOC", (v) => up((c) => (c.documents[i].type = v)), false, "PDF")}</span>
                  <h3 className="ms-pcard__h" style={{ margin: 0 }}>{f(doc.title, (v) => up((c) => (c.documents[i].title = v)), false, "Title")}</h3>
                  {edit ? (
                    <input className="ms-edit" value={doc.url} placeholder="https://…" onChange={(e) => up((c) => (c.documents[i].url = e.target.value))} />
                  ) : doc.url ? (
                    <a href={doc.url} target="_blank" rel="noreferrer" className="ms-btn ms-btn-outline" style={{ alignSelf: "flex-start" }}>{ui("Open", "فتح")} <span>↗</span></a>
                  ) : (
                    <span className="ms-pmuted">{ui("Shared soon.", "ستُشارك قريباً.")}</span>
                  )}
                </div>
              ))}
              {edit && <div className="pc-4" style={{ display: "flex", alignItems: "center" }}>{add(() => up((c) => c.documents.push({ title: "", type: "PDF", url: "" })), ui("Add document", "مستند"))}</div>}
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

      {/* Admin edit controls */}
      {canEdit && (
        <div className="ms-edit-bar" dir="ltr">
          {edit ? (
            <>
              <span>Editing — change any text, drag sliders, use + / ✕</span>
              <button className="ms-btn ms-btn-primary" onClick={save}>
                {saving === "saving" ? "Saving…" : saving === "saved" ? "Saved ✓" : saving === "error" ? "Retry" : "Save"}
              </button>
              <button className="ms-btn ms-btn-ghost" style={{ color: "#fff" }} onClick={() => { setData(client.data); setEdit(false); setSaving(""); }}>Done</button>
            </>
          ) : (
            <button className="ms-btn ms-btn-primary" onClick={() => setEdit(true)}>Edit portal</button>
          )}
        </div>
      )}
    </div>
  );
}
