"use client";

import { useState } from "react";
import { useLang } from "@/lib/useLang";
import { useRouter } from "next/navigation";
import { logout } from "@/app/admin/actions";
import { setPostApproval, addPostComment, requestDeliverable } from "@/app/portal-feedback-actions";
import SocialCalendar from "@/components/SocialCalendar";
import FileUpload from "@/components/FileUpload";
import EnablePushButton from "@/components/EnablePushButton";
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

// Short labels for the dock — six columns on a phone leave no room for long words.
const DOCK_LABELS: Record<string, { en: string; ar: string }> = {
  dashboard: { en: "Home", ar: "الرئيسية" },
  plan: { en: "Plan", ar: "الخطة" },
  social: { en: "Social", ar: "سوشال" },
  analysis: { en: "Analysis", ar: "التحليل" },
  invoices: { en: "Finance", ar: "المالية" },
  documents: { en: "Docs", ar: "مستندات" },
};

// Bottom-nav icons (mobile) — one simple stroke glyph per tab.
const TAB_ICONS: Record<string, React.ReactNode> = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
  ),
  plan: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 21V4a1 1 0 0 1 1-1h11l-2 4 2 4H5" /></svg>
  ),
  social: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>
  ),
  analysis: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 20V10M10 20V4M16 20v-7M21 20H3" /></svg>
  ),
  invoices: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h4" /></svg>
  ),
  documents: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2h8l5 5v15H6z" /><path d="M14 2v6h6" /></svg>
  ),
};

export default function PortalView({
  client,
  metaLive = false,
}: {
  client: Client;
  metaLive?: boolean;
}) {
  const [lang, setLang] = useLang();
  const [tab, setTab] = useState<string>("dashboard");
  const [data, setData] = useState<ClientData>(client.data);
  const [postBusy, setPostBusy] = useState<number | null>(null);
  const [reqTitle, setReqTitle] = useState("");
  const [reqDue, setReqDue] = useState("");
  const [reqDetail, setReqDetail] = useState("");
  const [reqBusy, setReqBusy] = useState(false);
  const [reqMsg, setReqMsg] = useState("");
  const router = useRouter();
  // The portal is view-only — content is edited in admin client Settings. `edit`
  // stays a const so the shared view/edit field helpers below render read-only.
  const edit = false;

  const d = data;
  const tr = (b?: LocalizedText) => (b ? b[lang] : "");
  const ui = (en: string, ar: string) => (lang === "ar" ? ar : en);

  // Dashboard quick-view: derive a few highlights from the other sections.
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (d.social?.posts ?? []).filter((p) => p.date && p.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1));
  const nextPost = upcoming[0];
  const topMetric = (d.analysis?.organic?.metrics ?? []).find((m) => m.value || m.after);
  // Auto stats — always populated from the client's (Notion-synced) data so the
  // dashboard is informative even with zero hand-entered content.
  const allPosts = d.social?.posts ?? [];
  const monthPrefix = today.slice(0, 7);
  const postsThisMonth = allPosts.filter((p) => p.date?.startsWith(monthPrefix)).length;
  const invoiceList = d.invoices ?? [];
  const paidInvoices = invoiceList.filter((i) => i.status === "paid").length;
  const overdueInvoices = invoiceList.filter((i) => i.status === "overdue").length;
  const autoStats: { label: string; value: string; sub?: string; tone?: "good" | "warn" }[] = [
    { label: ui("Plan", "الخطة"), value: d.plan?.name || "—", sub: d.plan?.active ? ui("Active", "نشطة") : ui("Paused", "متوقّفة"), tone: d.plan?.active ? "good" : undefined },
    { label: ui("Cycle", "الدورة"), value: d.plan?.end ? `${d.plan?.start || ""} → ${d.plan?.end}` : d.plan?.start || ui("Ongoing", "مستمرّة") },
    { label: ui("Money left", "المبلغ المتبقّي"), value: d.plan?.balance || "—" },
    { label: ui("Paid", "نسبة السداد"), value: `${d.finance?.progress ?? 0}%` },
    { label: ui("Monthly fee", "الاشتراك الشهري"), value: d.finance?.monthlyFee || "—" },
    { label: ui("Posts this month", "منشورات هذا الشهر"), value: String(postsThisMonth) },
    { label: ui("Next post", "المنشور القادم"), value: nextPost ? nextPost.date : ui("None scheduled", "لا يوجد"), sub: nextPost?.platform || "" },
    { label: ui("Invoices", "الفواتير"), value: String(invoiceList.length), sub: overdueInvoices ? `${overdueInvoices} ${ui("overdue", "متأخرة")}` : `${paidInvoices} ${ui("paid", "مدفوعة")}`, tone: overdueInvoices ? "warn" : undefined },
  ];
  if (topMetric) autoStats.push({ label: topMetric.label || ui("Top result", "أبرز نتيجة"), value: topMetric.value || topMetric.after || "—", sub: topMetric.delta || "" });
  if (d.analysis?.paid?.spend) autoStats.push({ label: ui("Ad spend", "الإنفاق الإعلاني"), value: d.analysis.paid.spend });
  if (d.finance?.brandingFee) autoStats.push({ label: ui("Branding fee", "رسوم الهوية"), value: d.finance.brandingFee });

  // Photography — the client only sees shoots when the studio shared them.
  const photo = d.photo;
  const shootsShared = !!photo?.showToClient;
  const sessions = shootsShared ? [...(photo?.sessions ?? [])].sort((a, b) => (a.date < b.date ? -1 : 1)) : [];
  const shots = shootsShared ? photo?.shots ?? [] : [];
  const hasShoots = sessions.length > 0 || shots.length > 0;
  const sessionStatusLabel: Record<string, { en: string; ar: string; cls: string }> = {
    planned: { en: "Planned", ar: "مُخطّط", cls: "" },
    confirmed: { en: "Confirmed", ar: "مؤكّد", cls: "ms-portal-pill--blue" },
    shot: { en: "Shot", ar: "تم التصوير", cls: "ms-portal-pill--blue" },
    delivered: { en: "Delivered", ar: "تم التسليم", cls: "ms-portal-pill--green" },
  };
  const fmtShootDate = (iso: string) => {
    if (!iso) return "";
    const dt = new Date(`${iso}T00:00:00`);
    return Number.isNaN(dt.getTime()) ? iso : dt.toLocaleDateString(lang === "ar" ? "ar" : "en-GB", { weekday: "short", day: "2-digit", month: "short" });
  };
  const shotsDone = shots.filter((t) => t.status === "done").length;

  // Deliverables — the client sees progress when shared, and can request tasks
  // when requests are enabled. Pending requests are excluded from the progress list.
  const dlvShared = !!d.deliverables?.showToClient;
  const dlvRequestsOn = !!d.deliverables?.allowClientRequests;
  const dlvItems = dlvShared ? [...(d.deliverables?.items ?? [])].filter((x) => !x.pending).sort((a, b) => ((a.due || "9999") < (b.due || "9999") ? -1 : 1)) : [];
  const myRequests = dlvRequestsOn ? (d.deliverables?.items ?? []).filter((x) => x.requestedByClient) : [];
  const dlvDone = dlvItems.filter((x) => x.status === "done").length;
  const dlvPct = dlvItems.length ? Math.round((dlvDone / dlvItems.length) * 100) : 0;
  const dlvStatusLabel: Record<string, { en: string; ar: string; cls: string }> = {
    todo: { en: "To do", ar: "قيد الانتظار", cls: "" },
    doing: { en: "In progress", ar: "قيد التنفيذ", cls: "ms-portal-pill--blue" },
    review: { en: "In review", ar: "قيد المراجعة", cls: "ms-portal-pill--blue" },
    done: { en: "Delivered", ar: "تم التسليم", cls: "ms-portal-pill--green" },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const up = (fn: (c: any) => void) => setData((prev) => { const c = JSON.parse(JSON.stringify(prev)); fn(c); return c; });

  async function submitRequest() {
    const title = reqTitle.trim();
    if (!title || reqBusy) return;
    setReqBusy(true);
    setReqMsg("");
    const res = await requestDeliverable(client.slug, { title, due: reqDue, detail: reqDetail });
    setReqBusy(false);
    if (res.ok) {
      up((c) => {
        c.deliverables = c.deliverables || {};
        c.deliverables.items = [...(c.deliverables.items ?? []), { id: `tmp_${Date.now()}`, title, due: reqDue || undefined, detail: reqDetail || undefined, status: "todo", kind: "milestone", source: "client", requestedByClient: true, pending: true }];
      });
      setReqTitle(""); setReqDue(""); setReqDetail("");
      setReqMsg(ui("Request sent — pending approval.", "تم إرسال الطلب — بانتظار الموافقة."));
    } else {
      setReqMsg(ui("Couldn't send the request. Try again.", "تعذّر إرسال الطلب. حاول مرة أخرى."));
    }
  }

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

  // Client feedback on a planned post. Updates locally for instant feedback,
  // then persists; the server is the source of truth on refresh.
  const viewerRole: "studio" | "client" = "client";
  async function approvePost(idx: number, approval: "approved" | "changes") {
    setPostBusy(idx);
    up((c) => { if (c.social?.posts?.[idx]) c.social.posts[idx].approval = approval; });
    await setPostApproval(client.slug, idx, approval);
    setPostBusy(null);
    router.refresh();
  }
  async function commentPost(idx: number, text: string) {
    setPostBusy(idx);
    up((c) => { if (c.social?.posts?.[idx]) (c.social.posts[idx].comments ||= []).push({ by: ui("You", "أنت"), role: viewerRole, text, at: new Date().toISOString() }); });
    await addPostComment(client.slug, idx, text);
    setPostBusy(null);
    router.refresh();
  }
  const aiData = d.analysis?.ai;

  return (
    <div className="ms-portal ms-portal--side" dir={lang === "ar" ? "rtl" : "ltr"}>
      <aside className="ms-side">
        <button className="ms-side__logo" onClick={() => setTab("dashboard")} aria-label="Dashboard">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MARKER_LOGO} alt="Marker Studio" />
        </button>
        <div className="ms-side__client">
          <b>{client.name}</b>
          <span className={`ms-side__status ${d.plan?.active ? "is-on" : "is-off"}`}>{d.plan?.active ? ui("Active", "نشطة") : ui("Paused", "متوقفة")}</span>
        </div>
        <nav className="ms-side__nav">
          {TABS.map((t) => (
            <button key={t.id} className={`ms-side__link ${tab === t.id ? "is-active" : ""}`} onClick={() => { setTab(t.id); window.scrollTo({ top: 0 }); }}>
              <i className="ms-side__icon" aria-hidden>{TAB_ICONS[t.id]}</i>
              <span>{ui(t.en, t.ar)}</span>
            </button>
          ))}
        </nav>
        <div className="ms-side__foot">
          <div className="ms-lang" role="group" aria-label="Language">
            <button className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>EN</button>
            <button className={lang === "ar" ? "on" : ""} onClick={() => setLang("ar")}>ع</button>
          </div>
          <a href="/account/security" className="ms-side__signout" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
            {ui("Face ID / Touch ID", "بصمة الوجه / اللمس")}
          </a>
          <form action={logout}>
            <button className="ms-side__signout">{ui("Sign out", "خروج")}</button>
          </form>
        </div>
      </aside>

      <div className="ms-portal-main">
        <header className="ms-side-topbar">
          <button className="ms-logo" onClick={() => setTab("dashboard")} aria-label="Dashboard" style={{ border: 0, background: "none", cursor: "pointer" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={MARKER_LOGO} alt="Marker Studio" />
          </button>
          <div className="ms-actions">
            <EnablePushButton lang={lang} />
            <div className="ms-lang" role="group" aria-label="Language">
              <button className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>EN</button>
              <button className={lang === "ar" ? "on" : ""} onClick={() => setLang("ar")}>ع</button>
            </div>
            <form action={logout}>
              <button className="ms-btn ms-btn-outline ms-portal-signout">{ui("Sign out", "خروج")}</button>
            </form>
          </div>
        </header>

      {/* DASHBOARD */}
      {tab === "dashboard" && (
        <>
          <section className="ms-portal-hero">
            {(d.accent || client.name) && !edit && (
              <span className="ms-portal-watermark" aria-hidden>
                {d.accent || client.name.split(" ")[0]}
              </span>
            )}
            <div className="ms-container">
              <span className="ms-portal-hero__eyebrow">{ui("Marker Studio · Client report", "ماركر استديو · تقرير العميل")}</span>
              <h1 className="ms-portal-hero__title">{client.name}</h1>
              <p className="ms-portal-hero__sub">{f(tr(d.hero), (v) => up((c) => (c.hero[lang] = v)), true, ui("Intro line…", "سطر تعريفي…"))}</p>
              {edit && (
                <div style={{ marginTop: 10, maxWidth: 320 }}>
                  <input
                    className="ms-edit"
                    value={d.accent ?? ""}
                    placeholder={ui("Watermark word (e.g. JACK)", "كلمة الخلفية")}
                    onChange={(e) => up((c) => (c.accent = e.target.value))}
                  />
                </div>
              )}
            </div>
          </section>

          {/* Auto overview — always populated from the client's data. */}
          <section className="ms-section ms-rise" style={{ paddingTop: 8 }}>
            <div className="ms-container">
              <span className="ms-section__eyebrow">{ui("At a glance", "نظرة سريعة")}</span>
              <div className="ms-stat-grid" style={{ marginTop: 14 }}>
                {autoStats.map((s, i) => (
                  <div key={i} className="ms-stat">
                    <span className="ms-stat__label">{s.label}</span>
                    <span className="ms-stat__value">{s.value}</span>
                    {s.sub && <span className={`ms-stat__sub ${s.tone === "good" ? "is-good" : s.tone === "warn" ? "is-warn" : ""}`}>{s.sub}</span>}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {(edit || tr(d.dashboard?.headline) || (d.dashboard?.vitals ?? []).length > 0 || (d.dashboard?.cards ?? []).length > 0) && (
            <section className="ms-section ms-rise">
              <div className="ms-container">
                <span className="ms-section__eyebrow">{ui("Overview", "نظرة عامة")}</span>
                <h2 className="ms-ed-statement" style={{ marginTop: 10 }}>{f(tr(d.dashboard?.headline), (v) => up((c) => (c.dashboard.headline[lang] = v)), false, ui("One-line summary…", "ملخّص بسطر…"))}</h2>
                {(edit || (d.dashboard?.cards ?? []).length > 0) && (
                  <div className="ms-story-grid">
                    {(d.dashboard?.cards ?? []).map((sc, i) => (
                      <div key={i} className="ms-story-card ms-rise" style={{ animationDelay: `${80 + i * 70}ms`, position: "relative" }}>
                        {del(() => up((c) => c.dashboard.cards.splice(i, 1)))}
                        <span className="tag">{f(sc.tag, (v) => up((c) => (c.dashboard.cards[i].tag = v)), false, ui("Tag", "وسم"))}</span>
                        <div className="value">{f(sc.value, (v) => up((c) => (c.dashboard.cards[i].value = v)), false, "—")}</div>
                        <p className="desc">{f(sc.desc, (v) => up((c) => (c.dashboard.cards[i].desc = v)), true, ui("Story…", "وصف…"))}</p>
                      </div>
                    ))}
                    {edit && (
                      <div style={{ display: "flex", alignItems: "center" }}>
                        {add(() => up((c) => c.dashboard.cards.push({ tag: "", value: "", desc: "" })), ui("Add card", "بطاقة"))}
                      </div>
                    )}
                  </div>
                )}
                {(edit || tr(d.dashboard?.diagnosis)) && (
                  <div className="ms-pcard ms-pcard--dark ms-rise" style={{ marginTop: 28, maxWidth: 760, animationDelay: "180ms" }}>
                    <span className="ms-section__eyebrow">{ui("Our reading", "قراءتنا")}</span>
                    <p className="ms-pmuted" style={{ fontSize: 16, marginTop: 8 }}>
                      {f(tr(d.dashboard?.diagnosis), (v) => up((c) => { if (!c.dashboard.diagnosis) c.dashboard.diagnosis = { en: "", ar: "" }; c.dashboard.diagnosis[lang] = v; }), true, ui("What the numbers mean…", "ماذا تعني الأرقام…"))}
                    </p>
                  </div>
                )}
                {(edit || (d.dashboard?.vitals ?? []).length > 0) && (
                  <div className="ms-pcard" style={{ marginTop: 28, maxWidth: 680 }}>
                    <span className="ms-section__eyebrow">{ui("Account health", "صحة الحساب")}</span>
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
            </section>
          )}

          {(edit || (d.updates ?? []).length > 0) && (
            <section className="ms-section ms-rise" style={{ paddingTop: 0 }}>
              <div className="ms-container">
                <span className="ms-section__eyebrow">{ui("Latest activity", "آخر التحديثات")}</span>
                <h2 className="ms-section__title" style={{ marginTop: 10 }}>{ui("What's moved recently.", "ما الذي تحرّك مؤخّراً.")}</h2>
                <div className="ms-feed" style={{ marginTop: 18 }}>
                  {(d.updates ?? []).map((u, i) => (
                    <div key={i} className={`ms-feed-item ms-feed-item--${u.kind || "note"}`} style={{ position: "relative" }}>
                      {del(() => up((c) => c.updates!.splice(i, 1)))}
                      <span className="ms-feed-when">{(u.at || "").slice(0, 10)}</span>
                      <div className="ms-feed-body">
                        <b>{f(tr(u.title), (v) => up((c) => (c.updates![i].title[lang] = v)), false, ui("Update title…", "عنوان التحديث…"))}</b>
                        {(edit || tr(u.body)) && (
                          <p className="ms-pmuted">{f(tr(u.body), (v) => up((c) => { if (!c.updates![i].body) c.updates![i].body = { en: "", ar: "" }; c.updates![i].body![lang] = v; }), true, ui("Details…", "تفاصيل…"))}</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {!edit && (d.updates ?? []).length === 0 && <p className="ms-pmuted">{ui("No activity yet.", "لا نشاط بعد.")}</p>}
                </div>
                {add(() => up((c) => { c.updates = [{ at: new Date().toISOString().slice(0, 10), kind: "note", title: { en: "", ar: "" }, body: { en: "", ar: "" } }, ...(c.updates ?? [])]; }), ui("Add update", "تحديث"))}
              </div>
            </section>
          )}
        </>
      )}

      {/* PLAN */}
      {tab === "plan" && (
        <section className="ms-section ms-rise">
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

            {/* Photo sessions — only when the studio shared shoots with the client. */}
            {!edit && shootsShared && hasShoots && (
              <div style={{ marginTop: 36 }}>
                <div className="ms-section__header">
                  <div>
                    <span className="ms-section__eyebrow">{ui("Photo sessions", "جلسات التصوير")}</span>
                    <h2 className="ms-section__title">{ui("Your shoots", "جلساتك")}</h2>
                  </div>
                  {shots.length > 0 && (
                    <span className="ms-portal-pill">{shotsDone}/{shots.length} {ui("shots ready", "لقطة جاهزة")}</span>
                  )}
                </div>

                {sessions.length > 0 && (
                  <div style={{ display: "grid", gap: 12, marginTop: 8 }}>
                    {sessions.map((s, i) => {
                      const st = sessionStatusLabel[s.status] ?? sessionStatusLabel.planned;
                      return (
                        <div key={i} className="ms-pcard">
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                            <div>
                              <div className="ms-portal-mini">{fmtShootDate(s.date)}{s.time ? ` · ${s.time}` : ""}</div>
                              <div style={{ fontWeight: 700, marginTop: 4 }}>{s.title || ui("Shoot", "جلسة")}</div>
                              {s.location && <div className="ms-pmuted" style={{ marginTop: 2 }}>{s.location}</div>}
                            </div>
                            <span className={`ms-portal-pill ${st.cls}`}>{ui(st.en, st.ar)}</span>
                          </div>
                          {tr(s.brief) && <p className="ms-pmuted" style={{ marginTop: 10 }}>{tr(s.brief)}</p>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {shots.length > 0 && (
                  <div className="ms-pcard" style={{ marginTop: 12 }}>
                    <span className="ms-section__eyebrow">{ui("Shot list", "قائمة اللقطات")}</span>
                    <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0" }}>
                      {shots.map((t, i) => (
                        <li key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: i ? "1px solid var(--marker-line, #eee)" : "none" }}>
                          <span aria-hidden style={{ color: t.status === "done" ? "var(--marker-orange, #FF9100)" : "#bbb" }}>{t.status === "done" ? "✓" : "○"}</span>
                          <span style={{ flex: 1, textDecoration: t.status === "done" ? "line-through" : "none", opacity: t.status === "done" ? 0.6 : 1 }}>{t.title}</span>
                          {t.status === "doing" && <span className="ms-portal-pill ms-portal-pill--blue">{ui("In progress", "قيد التنفيذ")}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Deliverables — progress (when shared) and/or task requests (when enabled). */}
            {!edit && (dlvShared || dlvRequestsOn) && (
              <div style={{ marginTop: 36 }}>
                <div className="ms-section__header">
                  <div>
                    <span className="ms-section__eyebrow">{ui("Deliverables", "المخرجات")}</span>
                    <h2 className="ms-section__title">{ui("Where we are", "أين وصلنا")}</h2>
                  </div>
                  {dlvShared && dlvItems.length > 0 && (
                    <span className="ms-portal-pill">{dlvDone}/{dlvItems.length} {ui("delivered", "تم تسليمه")}</span>
                  )}
                </div>

                {dlvShared && dlvItems.length > 0 && (
                  <div className="ms-pcard" style={{ marginTop: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                      <span className="ms-portal-mini">{ui("Progress", "نسبة الإنجاز")}</span>
                      <span style={{ fontWeight: 800 }}>{dlvPct}%</span>
                    </div>
                    <div style={{ height: 6, background: "var(--marker-charcoal-10)", borderRadius: 999, overflow: "hidden", marginTop: 10 }}>
                      <div style={{ height: "100%", width: `${dlvPct}%`, background: "var(--marker-orange)", borderRadius: 999 }} />
                    </div>
                    <ul style={{ listStyle: "none", padding: 0, margin: "14px 0 0" }}>
                      {dlvItems.map((it, i) => {
                        const st = dlvStatusLabel[it.status] ?? dlvStatusLabel.todo;
                        return (
                          <li key={it.id ?? i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: i ? "1px solid var(--marker-line, #eee)" : "none" }}>
                            <span aria-hidden style={{ color: it.status === "done" ? "var(--marker-orange, #FF9100)" : "#bbb" }}>{it.status === "done" ? "✓" : "○"}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, textDecoration: it.status === "done" ? "line-through" : "none", opacity: it.status === "done" ? 0.6 : 1 }}>{it.title}</div>
                              {it.due && <div className="ms-pmuted" style={{ fontSize: 12 }}>{fmtShootDate(it.due)}</div>}
                            </div>
                            <span className={`ms-portal-pill ${st.cls}`}>{ui(st.en, st.ar)}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {dlvRequestsOn && (
                  <div className="ms-pcard" style={{ marginTop: 12 }}>
                    <span className="ms-section__eyebrow">{ui("Request a task", "اطلب مهمة")}</span>
                    <p className="ms-pmuted" style={{ marginTop: 4 }}>{ui("Need something specific? Send a request with a date — we'll review and confirm it.", "تحتاج شيئًا محددًا؟ أرسل طلبًا مع تاريخ — سنراجعه ونؤكده.")}</p>
                    <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                      <input value={reqTitle} onChange={(e) => setReqTitle(e.target.value)} placeholder={ui("What do you need?", "ما الذي تحتاجه؟")} style={{ width: "100%", border: "1px solid var(--marker-line, #e5e5e5)", borderRadius: 10, padding: "10px 12px", fontSize: 14, fontFamily: "inherit" }} />
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <input type="date" value={reqDue} onChange={(e) => setReqDue(e.target.value)} style={{ border: "1px solid var(--marker-line, #e5e5e5)", borderRadius: 10, padding: "10px 12px", fontSize: 14, fontFamily: "inherit" }} />
                        <input value={reqDetail} onChange={(e) => setReqDetail(e.target.value)} placeholder={ui("Any details (optional)", "تفاصيل إضافية (اختياري)")} style={{ flex: 1, minWidth: 160, border: "1px solid var(--marker-line, #e5e5e5)", borderRadius: 10, padding: "10px 12px", fontSize: 14, fontFamily: "inherit" }} />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                        <button type="button" onClick={submitRequest} disabled={reqBusy || !reqTitle.trim()} className="ms-portal-pill ms-portal-pill--orange" style={{ border: "none", cursor: reqBusy || !reqTitle.trim() ? "not-allowed" : "pointer", opacity: reqBusy || !reqTitle.trim() ? 0.6 : 1 }}>
                          {reqBusy ? ui("Sending…", "جارٍ الإرسال…") : ui("Send request", "إرسال الطلب")}
                        </button>
                        {reqMsg && <span className="ms-pmuted">{reqMsg}</span>}
                      </div>
                    </div>

                    {myRequests.length > 0 && (
                      <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0" }}>
                        {myRequests.map((it, i) => {
                          const label = it.pending ? ui("Pending approval", "بانتظار الموافقة") : it.status === "done" ? ui("Delivered", "تم التسليم") : ui("Approved", "تمت الموافقة");
                          const cls = it.pending ? "" : it.status === "done" ? "ms-portal-pill--green" : "ms-portal-pill--blue";
                          return (
                            <li key={it.id ?? i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: i ? "1px solid var(--marker-line, #eee)" : "none" }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600 }}>{it.title}</div>
                                {it.due && <div className="ms-pmuted" style={{ fontSize: 12 }}>{fmtShootDate(it.due)}</div>}
                              </div>
                              <span className={`ms-portal-pill ${cls}`}>{label}</span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* SOCIAL */}
      {tab === "social" && (
        <section className="ms-section ms-rise">
          <div className="ms-container">
            <div className="ms-section__header">
              <div>
                <span className="ms-section__eyebrow">{ui("Social Media Plan", "خطة السوشال ميديا")}</span>
                <h2 className="ms-section__title">{f(tr(d.social?.headline), (v) => up((c) => (c.social.headline[lang] = v)), false, ui("Headline…", "عنوان…"))}</h2>
              </div>
            </div>
            <SocialCalendar
              posts={d.social?.posts ?? []}
              editable={edit}
              lang={lang}
              onChange={(posts) => up((c) => (c.social.posts = posts))}
              feedback={edit ? undefined : { role: viewerRole, onApprove: approvePost, onComment: commentPost, busy: postBusy }}
            />
            {edit ? (
              <p className="ms-pmuted" style={{ marginTop: 10, fontSize: 13 }}>{ui("Click a day to add or edit posts.", "اضغط على يوم لإضافة أو تعديل المنشورات.")}</p>
            ) : (
              <p className="ms-pmuted" style={{ marginTop: 10, fontSize: 13 }}>{ui("Open a post to approve it, request changes, or leave a comment.", "افتح المنشور للموافقة عليه أو طلب تعديل أو ترك تعليق.")}</p>
            )}
          </div>
        </section>
      )}

      {/* ANALYSIS */}
      {tab === "analysis" && (
        <section className="ms-section ms-rise">
          <div className="ms-container">
            {/* AI analysis — the AI designs the whole thing (cards, charts);
                generated by the studio, sanitized, shown to the client. */}
            {tr(aiData?.html) && (
              <div className="ms-ai-wrap" style={{ marginBottom: 28 }}>
                <span className="ms-ai__badge">{ui("AI reading", "قراءة الذكاء الاصطناعي")}</span>
                <div className="ms-ai-html" dir={lang === "ar" ? "rtl" : "ltr"} dangerouslySetInnerHTML={{ __html: tr(aiData?.html) }} />
              </div>
            )}

            <div className="ms-section__header">
              <div>
                <span className="ms-section__eyebrow">{ui("Organic content", "المحتوى العضوي")}</span>
                <h2 className="ms-section__title">{f(tr(d.analysis?.organic?.headline), (v) => up((c) => (c.analysis.organic.headline[lang] = v)), false, ui("Headline…", "عنوان…"))}</h2>
              </div>
              {metaLive && !edit && (
                <span className="ms-portal-pill ms-portal-pill--green ms-live-pill" title={ui("Updated automatically from Facebook & Instagram", "يُحدَّث تلقائياً من فيسبوك وإنستغرام")}>
                  {ui("Live from Meta", "مباشر من Meta")}
                </span>
              )}
            </div>
            <div className="ms-pcard" style={{ background: "transparent", border: 0, padding: 0, boxShadow: "none" }}>
              {!edit && (d.analysis?.organic?.metrics ?? []).length === 0 && <p className="ms-pmuted">{ui("No organic results yet.", "لا نتائج عضوية بعد.")}</p>}
              <div className="ms-metric-grid">
                {(d.analysis?.organic?.metrics ?? []).map((m, i) => {
                  const value = m.value || m.after || "";
                  // Old before/after rows: derive the change badge so legacy
                  // data still reads as "the number + how it moved".
                  let delta = m.delta || "";
                  if (!delta && m.before && m.after) {
                    const b = parseFloat(m.before.replace(/[^0-9.]/g, ""));
                    const a = parseFloat(m.after.replace(/[^0-9.]/g, ""));
                    if (Number.isFinite(b) && Number.isFinite(a) && b > 0) {
                      const ratio = a / b;
                      delta = ratio >= 2 ? `×${Math.round(ratio)}` : `${a >= b ? "+" : ""}${Math.round(((a - b) / b) * 100)}%`;
                    }
                  }
                  const down = /^[−-]/.test(delta.trim());
                  return (
                    <div key={i} className="ms-metric-card ms-rise" style={{ animationDelay: `${60 + i * 60}ms` }}>
                      {del(() => up((c) => c.analysis.organic.metrics.splice(i, 1)))}
                      {edit ? (
                        <div style={{ display: "grid", gap: 6 }}>
                          <input className="ms-edit" value={m.label} placeholder={ui("Metric (e.g. Views)", "المؤشر")} onChange={(e) => up((c) => (c.analysis.organic.metrics[i].label = e.target.value))} />
                          <div style={{ display: "flex", gap: 6 }}>
                            <input className="ms-edit" style={{ flex: 1 }} value={m.value ?? ""} placeholder={ui("Number (301,274)", "الرقم")} onChange={(e) => up((c) => (c.analysis.organic.metrics[i].value = e.target.value))} />
                            <input className="ms-edit" style={{ width: 90 }} value={m.delta ?? ""} placeholder="+312%" onChange={(e) => up((c) => (c.analysis.organic.metrics[i].delta = e.target.value))} />
                          </div>
                          <textarea className="ms-edit" rows={2} value={m.note} placeholder={ui("What does it mean?", "ماذا يعني؟")} onChange={(e) => up((c) => (c.analysis.organic.metrics[i].note = e.target.value))} />
                        </div>
                      ) : (
                        <>
                          {delta && <span className={`ms-metric-delta ${down ? "down" : "up"}`}>{delta}</span>}
                          <div className="ms-metric-value">{value || "—"}</div>
                          <div className="ms-metric-label">{m.label}</div>
                          {m.note && <p className="ms-metric-note">{m.note}</p>}
                        </>
                      )}
                    </div>
                  );
                })}
                {edit && (
                  <div style={{ display: "flex", alignItems: "center" }}>
                    {add(() => up((c) => c.analysis.organic.metrics.push({ label: "", value: "", delta: "", note: "" })), ui("Add metric", "مؤشر"))}
                  </div>
                )}
              </div>
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
              {!edit && (d.analysis?.paid?.campaigns ?? []).length === 0 && <p className="ms-pmuted">{ui("No paid campaigns yet.", "لا حملات مدفوعة بعد.")}</p>}
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
        <section className="ms-section ms-rise">
          <div className="ms-container">
            <div className="ms-section__header">
              <div>
                <span className="ms-section__eyebrow">{ui("Finance", "المالية")}</span>
                <h2 className="ms-section__title">{ui("Payments & balance.", "المدفوعات والرصيد.")}</h2>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <a className="ms-btn ms-btn-primary" href={`/portal/${client.slug}/statement`}>
                  {ui("Download statement", "تنزيل كشف حساب")} <span>↓</span>
                </a>
                <a className="ms-btn ms-btn-outline" href={`/portal/${client.slug}/invoices`}>
                  {ui("All invoices", "كل الفواتير")} <span>→</span>
                </a>
              </div>
            </div>

            <div className="ms-portal-grid">
              {(edit || d.finance?.monthlyFee) && (
                <div className="ms-pcard pc-4">
                  <span className="ms-portal-mini">{ui("Monthly fee (marketing)", "الاشتراك الشهري (تسويق)")}</span>
                  <div className="ms-portal-big" style={{ marginTop: 8, color: "var(--marker-ink)" }}>{f(d.finance?.monthlyFee ?? "", (v) => up((c) => { if (!c.finance) c.finance = { monthlyFee: "", progress: 0 }; c.finance.monthlyFee = v; }), false, "—")}</div>
                </div>
              )}
              {(edit || d.plan?.balance) && (
                <div className="ms-pcard pc-4">
                  <span className="ms-portal-mini">{ui("Money left", "المبلغ المتبقّي")}</span>
                  <div className="ms-portal-big" style={{ marginTop: 8 }}>{f(d.plan?.balance ?? "", (v) => up((c) => (c.plan.balance = v)), false, "—")}</div>
                </div>
              )}
              {(edit || d.finance?.monthlyFee || (d.finance?.progress ?? 0) > 0) && (
                <div className="ms-pcard pc-4">
                  <span className="ms-portal-mini">{ui("Paid", "نسبة السداد")}</span>
                  {edit ? (
                    <input type="range" min={0} max={100} value={d.finance?.progress ?? 0} className="w-full accent-orange" style={{ marginTop: 12 }} onChange={(e) => up((c) => { if (!c.finance) c.finance = { monthlyFee: "", progress: 0 }; c.finance.progress = Number(e.target.value); })} />
                  ) : (
                    <>
                      <div className="ms-portal-big" style={{ marginTop: 8 }}>{d.finance?.progress ?? 0}%</div>
                      <div style={{ height: 6, background: "var(--marker-charcoal-10)", borderRadius: 999, overflow: "hidden", marginTop: 10 }}>
                        <div style={{ height: "100%", width: `${d.finance?.progress ?? 0}%`, background: "var(--marker-orange)", borderRadius: 999 }} />
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Branding fee is shown for reference only — the "Money left"
                  figure above is the single combined balance (branding +
                  marketing + extras − paid). No separate branding balance. */}
              {(edit || d.finance?.brandingFee) && (
                <div className="ms-pcard pc-4">
                  <span className="ms-portal-mini">{ui("Branding fee (fixed)", "رسوم الهوية (ثابتة)")}</span>
                  <div className="ms-portal-big" style={{ marginTop: 8, color: "var(--marker-ink)" }}>{f(d.finance?.brandingFee ?? "", (v) => up((c) => { if (!c.finance) c.finance = { monthlyFee: "", progress: 0 }; c.finance.brandingFee = v; }), false, "—")}</div>
                </div>
              )}
            </div>

            <div className="ms-section__header" style={{ marginTop: 40 }}>
              <div><span className="ms-section__eyebrow">{ui("Payment history", "سجلّ المدفوعات")}</span></div>
            </div>
            <div>
              {!edit && (d.invoices ?? []).length === 0 && <p className="ms-pmuted">{ui("No payments recorded yet.", "لا مدفوعات مسجّلة بعد.")}</p>}
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
        <section className="ms-section ms-rise">
          <div className="ms-container">
            <div className="ms-section__header">
              <div>
                <span className="ms-section__eyebrow">{ui("Documents", "المستندات")}</span>
                <h2 className="ms-section__title">{ui("Proposals & agreements.", "العروض والاتفاقيات.")}</h2>
              </div>
            </div>

            {/* Live studio documents — shown once the studio has sent them. */}
            {(client.data.proposal?.published || client.data.agreement?.published) && (
              <div className="ms-portal-grid" style={{ marginBottom: 20 }}>
                {client.data.proposal?.published && (
                  <a className="ms-doc-card pc-6 ms-rise" href={`/portal/${client.slug}/proposal`}>
                    <span className="ms-doc-kicker">{ui("Interactive document", "مستند تفاعلي")}</span>
                    <h3>{ui("Your proposal", "عرضك")}</h3>
                    <p>
                      {client.data.proposal?.acceptedAt
                        ? ui("Accepted — thank you. You can reopen and export it any time.", "تم القبول — شكرًا لك. يمكنك فتحه وتصديره في أي وقت.")
                        : client.data.proposal?.published
                        ? ui("Review the scope, pick your plan and accept — all inside the document.", "راجع النطاق، اختر خطتك واقبل — كل ذلك داخل المستند.")
                        : ui("Draft — only the studio can see this for now.", "مسودة — يراها الاستوديو فقط حاليًا.")}
                    </p>
                    <div className="ms-doc-foot">
                      <span className={`ms-portal-pill ${client.data.proposal?.acceptedAt ? "ms-portal-pill--green" : "ms-portal-pill--orange"}`}>
                        {client.data.proposal?.acceptedAt ? ui("Accepted", "مقبول") : client.data.proposal?.published ? ui("Awaiting your review", "بانتظار مراجعتك") : ui("Draft", "مسودة")}
                      </span>
                      <span style={{ fontWeight: 700 }}>{ui("Open", "افتح")} →</span>
                    </div>
                  </a>
                )}
                {client.data.agreement?.published && (
                  <a className="ms-doc-card pc-6 ms-rise" style={{ animationDelay: "90ms" }} href={`/portal/${client.slug}/agreement`}>
                    <span className="ms-doc-kicker">{ui("E-sign document", "مستند للتوقيع الإلكتروني")}</span>
                    <h3>{ui("Service agreement", "اتفاقية الخدمة")}</h3>
                    <p>
                      {client.data.agreement?.acceptedAt
                        ? ui("Signed and in force. Reopen or export it any time.", "موقّعة وسارية. افتحها أو صدّرها في أي وقت.")
                        : client.data.agreement?.published
                        ? ui("Read the terms and sign electronically when you're ready.", "اقرأ الشروط ووقّع إلكترونيًا عندما تكون جاهزًا.")
                        : ui("Draft — only the studio can see this for now.", "مسودة — يراها الاستوديو فقط حاليًا.")}
                    </p>
                    <div className="ms-doc-foot">
                      <span className={`ms-portal-pill ${client.data.agreement?.acceptedAt ? "ms-portal-pill--green" : "ms-portal-pill--orange"}`}>
                        {client.data.agreement?.acceptedAt ? ui("Signed", "موقّعة") : client.data.agreement?.published ? ui("Awaiting signature", "بانتظار التوقيع") : ui("Draft", "مسودة")}
                      </span>
                      <span style={{ fontWeight: 700 }}>{ui("Open", "افتح")} →</span>
                    </div>
                  </a>
                )}
              </div>
            )}
            <div className="ms-portal-grid">
              {(d.documents ?? []).map((doc, i) => (
                <div key={i} className="ms-pcard pc-4" style={{ display: "flex", flexDirection: "column", gap: 14, position: "relative" }}>
                  {del(() => up((c) => c.documents.splice(i, 1)))}
                  <span className="ms-portal-pill ms-portal-pill--orange" style={{ alignSelf: "flex-start" }}>{f(doc.type || "DOC", (v) => up((c) => (c.documents[i].type = v)), false, "PDF")}</span>
                  <h3 className="ms-pcard__h" style={{ margin: 0 }}>{f(doc.title, (v) => up((c) => (c.documents[i].title = v)), false, "Title")}</h3>
                  {edit ? (
                    <>
                      <input className="ms-edit" value={doc.url} placeholder="https://…" onChange={(e) => up((c) => (c.documents[i].url = e.target.value))} />
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <FileUpload accept="application/pdf,image/*" label={ui("Upload PDF", "رفع PDF")} compact
                          onUploaded={({ url, name, contentType }) => up((c) => {
                            c.documents[i].url = url;
                            if (!c.documents[i].title) c.documents[i].title = name.replace(/\.[^.]+$/, "");
                            c.documents[i].type = contentType.includes("pdf") ? "PDF" : c.documents[i].type || "File";
                          })} />
                        {doc.url && <a href={doc.url} target="_blank" rel="noreferrer" className="ms-pmuted" style={{ fontSize: 12 }}>{ui("Open", "فتح")} ↗</a>}
                      </div>
                    </>
                  ) : doc.url ? (
                    <a href={doc.url} target="_blank" rel="noreferrer" className="ms-btn ms-btn-outline" style={{ alignSelf: "flex-start" }}>{ui("Open", "فتح")} <span>↗</span></a>
                  ) : (
                    <span className="ms-pmuted">{ui("Shared soon.", "ستُشارك قريباً.")}</span>
                  )}
                </div>
              ))}
              {edit && <div className="pc-4" style={{ display: "flex", alignItems: "center" }}>{add(() => up((c) => c.documents.push({ title: "", type: "PDF", url: "" })), ui("Add document", "مستند"))}</div>}
            </div>

            {/* Brand assets — final creative deliverables to download. */}
            <div className="ms-section__header" style={{ marginTop: 44 }}>
              <div>
                <span className="ms-section__eyebrow">{ui("Brand assets", "أصول العلامة")}</span>
                <h2 className="ms-section__title">{ui("Your deliverables.", "مُسلّماتك.")}</h2>
              </div>
            </div>
            <div className="ms-portal-grid">
              {!edit && (d.assets ?? []).length === 0 && (
                <p className="ms-pmuted pc-12">{ui("Final files — logos, exports, guidelines — will appear here to download.", "ستظهر الملفات النهائية — الشعارات والتصاميم والأدلّة — هنا للتنزيل.")}</p>
              )}
              {(d.assets ?? []).map((a, i) => (
                <div key={i} className="ms-pcard pc-4" style={{ display: "flex", flexDirection: "column", gap: 14, position: "relative" }}>
                  {del(() => up((c) => c.assets!.splice(i, 1)))}
                  <span className="ms-portal-pill ms-portal-pill--orange" style={{ alignSelf: "flex-start" }}>{f(a.type || "FILE", (v) => up((c) => (c.assets![i].type = v)), false, "PNG")}</span>
                  <h3 className="ms-pcard__h" style={{ margin: 0 }}>{f(a.title, (v) => up((c) => (c.assets![i].title = v)), false, "Title")}</h3>
                  {a.size && !edit && <span className="ms-pmuted" style={{ fontSize: 12 }}>{a.size}</span>}
                  {edit ? (
                    <>
                      <input className="ms-edit" value={a.url} placeholder="https://…" onChange={(e) => up((c) => (c.assets![i].url = e.target.value))} />
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <FileUpload accept="image/*,application/pdf,application/zip" label={ui("Upload file", "رفع ملف")} compact
                          onUploaded={({ url, name, contentType }) => up((c) => {
                            c.assets![i].url = url;
                            if (!c.assets![i].title) c.assets![i].title = name.replace(/\.[^.]+$/, "");
                            c.assets![i].type = contentType.includes("pdf") ? "PDF" : contentType.includes("zip") ? "ZIP" : contentType.startsWith("image/") ? "IMG" : c.assets![i].type || "File";
                          })} />
                        {a.url && <a href={a.url} target="_blank" rel="noreferrer" className="ms-pmuted" style={{ fontSize: 12 }}>{ui("Open", "فتح")} ↗</a>}
                      </div>
                    </>
                  ) : a.url ? (
                    <a href={a.url} target="_blank" rel="noreferrer" download className="ms-btn ms-btn-outline" style={{ alignSelf: "flex-start" }}>{ui("Download", "تنزيل")} <span>↓</span></a>
                  ) : (
                    <span className="ms-pmuted">{ui("Shared soon.", "ستُشارك قريباً.")}</span>
                  )}
                </div>
              ))}
              {edit && <div className="pc-4" style={{ display: "flex", alignItems: "center" }}>{add(() => up((c) => { c.assets = [...(c.assets ?? []), { title: "", type: "PNG", url: "" }]; }), ui("Add asset", "أصل"))}</div>}
            </div>
          </div>
        </section>
      )}

      {/* Mobile bottom navigation — replaces the header tab row on phones. */}
      <nav className="ms-bottomnav" aria-label={ui("Portal sections", "أقسام البوابة")}>
        {TABS.map((tb) => (
          <button
            key={tb.id}
            className={tab === tb.id ? "on" : ""}
            onClick={() => {
              setTab(tb.id);
              window.scrollTo({ top: 0 });
            }}
          >
            {TAB_ICONS[tb.id]}
            <span>{ui(DOCK_LABELS[tb.id]?.en || tb.en, DOCK_LABELS[tb.id]?.ar || tb.ar)}</span>
          </button>
        ))}
      </nav>

      <footer className="ms-footer">
        <div className="ms-container">
          <div className="ms-footer__bottom" style={{ borderTop: "none", paddingTop: 0 }}>
            <span>{ui("We mark the brands that matter.", "نعلّم على العلامات التي تستحقّ.")}</span>
            <span>{client.name} · {ui("Private portal", "بوابة خاصة")}</span>
          </div>
        </div>
      </footer>
      </div>
    </div>
  );
}
