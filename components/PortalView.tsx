"use client";

import { useState } from "react";
import Link from "next/link";
import { useLang } from "@/lib/useLang";
import { useRouter } from "next/navigation";
import { logout } from "@/app/admin/actions";
import { setPostApproval, addPostComment, requestDeliverable } from "@/app/portal-feedback-actions";
import SocialCalendar from "@/components/SocialCalendar";
import FileUpload from "@/components/FileUpload";
import EnablePushButton from "@/components/EnablePushButton";
import type { Client, ClientData, LocalizedText } from "@/lib/clients";
import { clientMonthlyFeeLabel } from "@/lib/money";

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
  paid: "lq-chip--green",
  due: "lq-chip--blue",
  overdue: "lq-chip--red",
};

// Short labels for the tab bar — six columns on a phone leave no room for long words.
const DOCK_LABELS: Record<string, { en: string; ar: string }> = {
  dashboard: { en: "Home", ar: "الرئيسية" },
  plan: { en: "Plan", ar: "الخطة" },
  social: { en: "Social", ar: "سوشال" },
  analysis: { en: "Analysis", ar: "التحليل" },
  invoices: { en: "Finance", ar: "المالية" },
  documents: { en: "Docs", ar: "مستندات" },
};

// Nav icons — one simple stroke glyph per tab (rail + mobile tab bar).
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

// Spec micro-label — the tiny uppercase eyebrow used across the glass system.
const MICRO = "text-[11px] font-display font-bold uppercase tracking-[0.14em] text-charcoal-60";
const MICRO_TILE = "text-[10px] font-display font-bold uppercase tracking-[0.12em] text-charcoal-60";

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
  // Time-ish facts feed the "Lately" zone; plan facts sit as a caption in the
  // hero, and the money picture lives on the Finance tab only.
  const postsThisMonth = (d.social?.posts ?? []).filter((p) => p.date?.startsWith(today.slice(0, 7))).length;

  // The client sees ONE monthly figure — marketing + stories combined; the
  // split never reaches this side of the portal.
  const monthlyFeeShown = clientMonthlyFeeLabel(d.finance);

  // Photography — the client only sees shoots when the studio shared them.
  const photo = d.photo;
  const shootsShared = !!photo?.showToClient;
  const sessions = shootsShared ? [...(photo?.sessions ?? [])].sort((a, b) => (a.date < b.date ? -1 : 1)) : [];
  const shots = shootsShared ? photo?.shots ?? [] : [];
  const hasShoots = sessions.length > 0 || shots.length > 0;
  // Shots group under their shoot via sessionId; legacy/loose shots (no sessionId,
  // or their shoot is gone) show in a trailing "General shot list".
  const shootIds = new Set(sessions.map((s) => s.id).filter(Boolean));
  const generalShots = shots.filter((t) => !t.sessionId || !shootIds.has(t.sessionId));
  const sessionStatusLabel: Record<string, { en: string; ar: string; cls: string }> = {
    planned: { en: "Planned", ar: "مُخطّط", cls: "" },
    confirmed: { en: "Confirmed", ar: "مؤكّد", cls: "lq-chip--blue" },
    shot: { en: "Shot", ar: "تم التصوير", cls: "lq-chip--blue" },
    delivered: { en: "Delivered", ar: "تم التسليم", cls: "lq-chip--green" },
  };
  const fmtShootDate = (iso: string) => {
    if (!iso) return "";
    const dt = new Date(`${iso}T00:00:00`);
    return Number.isNaN(dt.getTime()) ? iso : dt.toLocaleDateString(lang === "ar" ? "ar" : "en-GB", { weekday: "short", day: "2-digit", month: "short" });
  };
  const shotsDone = shots.filter((t) => t.status === "done").length;
  // Next upcoming shoot — a "Lately" row on the dashboard (sessions are already
  // gated on showToClient and sorted by date).
  const nextShootSession = sessions.find((s) => s.date >= today && s.status !== "delivered");

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
    doing: { en: "In progress", ar: "قيد التنفيذ", cls: "lq-chip--blue" },
    review: { en: "In review", ar: "قيد المراجعة", cls: "lq-chip--blue" },
    done: { en: "Delivered", ar: "تم التسليم", cls: "lq-chip--green" },
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

  const goTab = (id: string) => {
    setTab(id);
    window.scrollTo({ top: 0 });
  };

  const langSeg = (
    <div className="lq-seg" role="group" aria-label="Language">
      <button type="button" className={`lq-seg__opt ${lang === "en" ? "is-on" : ""}`} onClick={() => setLang("en")}>EN</button>
      <button type="button" className={`lq-seg__opt ${lang === "ar" ? "is-on" : ""}`} onClick={() => setLang("ar")}>ع</button>
    </div>
  );

  return (
    <div className="lq-app" dir={lang === "ar" ? "rtl" : "ltr"}>
      {/* ---------- Desktop rail (floating glass, inline-start — flips in RTL) ---------- */}
      <aside className="lq-rail lq-chrome" aria-label={ui("Portal sections", "أقسام البوابة")}>
        <button
          type="button"
          onClick={() => goTab("dashboard")}
          aria-label="Dashboard"
          className="lq-press flex items-center px-2.5 pb-3 bg-transparent border-0 cursor-pointer rounded-2xl"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MARKER_LOGO} alt="Marker Studio" className="h-8 w-auto" />
        </button>

        <nav className="lq-rail__nav">
          <div className="lq-rail__group">{ui("Your portal", "بوابتك")}</div>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-current={tab === t.id ? "page" : undefined}
              className={`lq-navlink w-full text-start ${tab === t.id ? "is-active" : ""}`}
              onClick={() => goTab(t.id)}
            >
              {TAB_ICONS[t.id]}
              {ui(t.en, t.ar)}
            </button>
          ))}
        </nav>

        {/* Bottom cluster — client, language, security, sign out */}
        <div className="pt-3 mt-1 border-t border-charcoal/5 flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2 px-1">
            <b className="font-display font-bold text-[13px] text-ink truncate" title={client.name}>{client.name}</b>
            <span className={`lq-chip ${d.plan?.active ? "lq-chip--green" : ""} !px-2 !py-1 uppercase !text-[9.5px] shrink-0`}>
              {d.plan?.active ? ui("Active", "نشطة") : ui("Paused", "متوقفة")}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 px-1">
            {langSeg}
            <EnablePushButton lang={lang} />
          </div>
          <div className="flex items-center gap-1.5 px-1 pb-1">
            <a href="/account/security" className="lq-btn lq-btn--glass lq-btn--sm flex-1 no-underline">
              {ui("Face ID / Touch ID", "بصمة الوجه / اللمس")}
            </a>
            <form action={logout} className="shrink-0">
              <button className="lq-btn lq-btn--ghost lq-btn--sm text-rose-700">{ui("Sign out", "خروج")}</button>
            </form>
          </div>
        </div>
      </aside>

      {/* ---------- Mobile floating pill cluster (top-end) ---------- */}
      <div
        className="fixed z-40 lq-chrome rounded-full p-1.5 flex items-center gap-1.5 min-[900px]:hidden"
        style={{ insetInlineEnd: 12, top: 12 }}
      >
        <EnablePushButton lang={lang} />
        {langSeg}
        <form action={logout}>
          <button className="lq-btn lq-btn--ghost lq-btn--sm">{ui("Sign out", "خروج")}</button>
        </form>
      </div>

      {/* ---------- Main column ---------- */}
      <main className="lq-main">
        <div className="mx-auto max-w-[1080px] pt-11 min-[900px]:pt-0">

          {/* DASHBOARD */}
          {tab === "dashboard" && (
            <div className="space-y-5">
              {/* Hero — the one dark emphasis panel on this tab */}
              <section className="lq-dark lq-rise relative overflow-hidden p-6 sm:p-8">
                {(d.accent || client.name) && !edit && (
                  <span
                    aria-hidden
                    className="pointer-events-none select-none absolute -top-8 -end-2 font-display font-black uppercase tracking-tight leading-none text-white/[0.05] text-[110px] sm:text-[160px] whitespace-nowrap"
                  >
                    {d.accent || client.name.split(" ")[0]}
                  </span>
                )}
                <div className="relative">
                  <p className="text-[12px] font-display font-bold tracking-[0.04em] text-orange-soft">
                    {(() => {
                      const h = new Date().getHours();
                      return h < 12 ? ui("Good morning", "صباح الخير") : h < 18 ? ui("Good afternoon", "نهارك سعيد") : ui("Good evening", "مساء الخير");
                    })()}
                    {" · "}
                    <span className="text-white/55 uppercase tracking-[0.14em] text-[10.5px]">{ui("Marker Studio", "ماركر استديو")}</span>
                  </p>
                  <h1 className="font-display font-extrabold text-[30px] sm:text-[38px] tracking-tight leading-tight mt-1.5">{client.name}</h1>
                  <p className="text-white/70 text-[15px] leading-relaxed mt-2 max-w-[560px]">
                    {f(tr(d.hero), (v) => up((c) => (c.hero[lang] = v)), true, ui("Intro line…", "سطر تعريفي…"))}
                  </p>
                  {/* Plan facts — a quiet caption, not a stat tile. */}
                  {(d.plan?.name || d.plan?.start || d.plan?.end) && (
                    <p className="text-white/45 text-[12.5px] font-medium tracking-wide mt-3">
                      {[
                        d.plan?.name,
                        d.plan?.end
                          ? `${d.plan?.start ? `${d.plan.start} → ` : ""}${d.plan.end}`
                          : d.plan?.start
                          ? `${d.plan.start} · ${ui("Ongoing", "مستمرّة")}`
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
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

              {/* Your next step — one thing, computed from the data. */}
              {(() => {
                const inv = (d.invoices ?? []).find((x) => x.status === "due" || x.status === "overdue");
                const pendingPost = (d.social?.posts ?? []).find((p) => p.approval === "pending");
                const nextShoot = d.photo?.showToClient
                  ? (d.photo.sessions ?? []).find((s) => s.date >= today && s.status !== "delivered")
                  : undefined;
                const step = d.proposal?.published && !d.proposal.acceptedAt
                  ? { text: ui("Your proposal is ready — review and accept it.", "عرضنا جاهز — راجعه واعتمده."), cta: ui("Review proposal", "مراجعة العرض"), href: `/portal/${client.slug}/proposal` }
                  : d.agreement?.published && !d.agreement.acceptedAt
                  ? { text: ui("Your agreement is ready for your signature.", "الاتفاقية جاهزة لتوقيعك."), cta: ui("Sign agreement", "توقيع الاتفاقية"), href: `/portal/${client.slug}/agreement` }
                  : inv
                  ? { text: ui(`An invoice is ${inv.status === "overdue" ? "overdue" : "due"} — ${inv.amount}.`, `لديك فاتورة ${inv.status === "overdue" ? "متأخرة" : "مستحقة"} — ${inv.amount}.`), cta: ui("View & settle", "عرض وتسوية"), tab: "invoices" }
                  : pendingPost
                  ? { text: ui(`"${pendingPost.title}" is waiting for your approval.`, `"${pendingPost.title}" بانتظار موافقتك.`), cta: ui("Review post", "مراجعة المنشور"), tab: "social" }
                  : nextShoot
                  ? { text: ui(`Your shoot "${nextShoot.title}" is coming up — ${nextShoot.date}.`, `جلسة التصوير "${nextShoot.title}" قادمة — ${nextShoot.date}.`), cta: ui("See the plan", "عرض الخطة"), tab: "plan" }
                  : null;
                return (
                  <section className="lq-card lq-rise flex flex-wrap items-center gap-3.5 p-4 sm:px-5" style={{ animationDelay: "60ms" }}>
                    <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.45),0_6px_14px_-4px_rgba(255,145,0,.55)] ${step ? "bg-gradient-to-br from-[#FFA226] to-[#F57F00]" : "bg-gradient-to-br from-emerald-400 to-emerald-600"}`}>
                      {step ? (
                        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                      ) : (
                        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-display font-bold uppercase tracking-[0.14em] text-charcoal-60">{ui("Your next step", "خطوتك التالية")}</p>
                      <p className="text-[14px] font-semibold text-ink leading-snug mt-0.5">
                        {step ? step.text : ui("You're all caught up — we're on it. Anything new lands here first.", "كل شيء تمام — نحن نعمل. أي جديد يظهر هنا أولاً.")}
                      </p>
                    </div>
                    {step &&
                      ("href" in step && step.href ? (
                        <Link href={step.href} className="lq-btn lq-btn--primary lq-btn--sm no-underline shrink-0">{step.cta}</Link>
                      ) : (
                        <button type="button" className="lq-btn lq-btn--primary lq-btn--sm shrink-0" onClick={() => setTab((step as { tab: string }).tab)}>
                          {step.cta}
                        </button>
                      ))}
                  </section>
                );
              })()}

              {(edit || tr(d.dashboard?.headline) || (d.dashboard?.vitals ?? []).length > 0 || (d.dashboard?.cards ?? []).length > 0 || tr(d.dashboard?.diagnosis)) && (
                <section className="lq-rise" style={{ animationDelay: "100ms" }}>
                  <p className={MICRO}>{ui("Where things stand", "أين وصلنا")}</p>
                  {/* One surface tells the whole story: the studio's headline
                      leads, the story figures follow as divided rows, vitals
                      and the reading sit under hairlines — never sub-cards. */}
                  <div className="lq-card p-5 sm:p-6 mt-3">
                    <h2 className="font-display font-extrabold text-[22px] sm:text-[26px] tracking-tight text-ink leading-snug max-w-[720px]">
                      {f(tr(d.dashboard?.headline), (v) => up((c) => (c.dashboard.headline[lang] = v)), false, ui("One-line summary…", "ملخّص بسطر…"))}
                    </h2>
                    {(edit || (d.dashboard?.cards ?? []).length > 0) && (
                      <div className="mt-5 border-t border-charcoal/5 divide-y divide-charcoal/5 lq-stagger">
                        {(d.dashboard?.cards ?? []).map((sc, i) => (
                          <div key={i} className="relative flex flex-wrap items-center gap-x-4 gap-y-1 py-3.5" style={{ "--i": i } as React.CSSProperties}>
                            {del(() => up((c) => c.dashboard.cards.splice(i, 1)))}
                            <span className="lq-chip lq-chip--orange !px-2.5 !py-1 uppercase !text-[9.5px] shrink-0">{f(sc.tag, (v) => up((c) => (c.dashboard.cards[i].tag = v)), false, ui("Tag", "وسم"))}</span>
                            <span className="font-display font-extrabold text-[24px] tracking-tight tabular-nums text-ink">{f(sc.value, (v) => up((c) => (c.dashboard.cards[i].value = v)), false, "—")}</span>
                            <span className="flex-1 min-w-[180px] text-sm text-charcoal-60 leading-relaxed">{f(sc.desc, (v) => up((c) => (c.dashboard.cards[i].desc = v)), true, ui("Story…", "وصف…"))}</span>
                          </div>
                        ))}
                        {edit && (
                          <div style={{ display: "flex", alignItems: "center", paddingTop: 10, paddingBottom: 10 }}>
                            {add(() => up((c) => c.dashboard.cards.push({ tag: "", value: "", desc: "" })), ui("Add card", "بطاقة"))}
                          </div>
                        )}
                      </div>
                    )}
                    {(edit || (d.dashboard?.vitals ?? []).length > 0) && (
                      <div className="mt-5 pt-5 border-t border-charcoal/5 max-w-[680px]">
                        <p className={MICRO_TILE}>{ui("Account health", "صحة الحساب")}</p>
                        <div className="mt-3 space-y-3.5">
                          {(d.dashboard?.vitals ?? []).map((v, i) => (
                            <div key={i}>
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
                                  <div className="flex items-center justify-between gap-3 text-sm">
                                    <span className="font-medium text-charcoal-80">{v.label}</span>
                                    <b className="text-ink font-semibold">{v.note}</b>
                                  </div>
                                  <div className="h-1.5 rounded-full bg-charcoal/10 overflow-hidden mt-1.5">
                                    <div className="h-full rounded-full bg-gradient-to-r from-[#FFA226] to-[#F57F00]" style={{ width: `${v.pct}%` }} />
                                  </div>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                        {add(() => up((c) => c.dashboard.vitals.push({ label: "", pct: 50, note: "" })), ui("Add vital", "مؤشر"))}
                      </div>
                    )}
                    {(edit || tr(d.dashboard?.diagnosis)) && (
                      <div className="mt-5 pt-5 border-t border-charcoal/5 max-w-[760px]">
                        <p className="text-[11px] font-display font-bold uppercase tracking-[0.14em] text-orange-deep">{ui("Our reading", "قراءتنا")}</p>
                        <p className="text-[15.5px] text-charcoal-80 leading-relaxed mt-2">
                          {f(tr(d.dashboard?.diagnosis), (v) => up((c) => { if (!c.dashboard.diagnosis) c.dashboard.diagnosis = { en: "", ar: "" }; c.dashboard.diagnosis[lang] = v; }), true, ui("What the numbers mean…", "ماذا تعني الأرقام…"))}
                        </p>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {(edit || (d.updates ?? []).length > 0 || nextPost || nextShootSession) && (
                <section className="lq-rise" style={{ animationDelay: "180ms" }}>
                  <p className={MICRO}>{ui("Lately", "آخر المستجدات")}</p>
                  <h2 className="font-display font-bold text-[18px] tracking-tight text-ink mt-1.5">{ui("What's moved — and what's next.", "ما الذي تحرّك — وما القادم.")}</h2>
                  {/* One surface: what's coming up first, then what's moved. */}
                  <div className="lq-card p-5 mt-3">
                    <ul className="divide-y divide-charcoal/5">
                      {!edit && nextPost && (
                        <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                          <span className="mt-1.5 w-2 h-2 rounded-full bg-charcoal-20 shrink-0" aria-hidden />
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-baseline gap-x-2">
                              <b className="text-sm font-semibold text-ink">
                                {ui("Next post", "المنشور القادم")}
                                {nextPost.platform ? ` · ${nextPost.platform}` : ""}
                              </b>
                              <span className="text-[11px] text-charcoal-40 tabular-nums">{nextPost.date}</span>
                            </div>
                            {postsThisMonth > 0 && (
                              <p className="text-sm text-charcoal-60 leading-relaxed mt-0.5">
                                {ui(`${postsThisMonth} post${postsThisMonth === 1 ? "" : "s"} planned this month.`, `${postsThisMonth} منشور مخطّط هذا الشهر.`)}
                              </p>
                            )}
                          </div>
                        </li>
                      )}
                      {!edit && nextShootSession && (
                        <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                          <span className="mt-1.5 w-2 h-2 rounded-full bg-charcoal-20 shrink-0" aria-hidden />
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-baseline gap-x-2">
                              <b className="text-sm font-semibold text-ink">
                                {ui("Next shoot", "جلسة التصوير القادمة")}
                                {nextShootSession.title ? ` · ${nextShootSession.title}` : ""}
                              </b>
                              <span className="text-[11px] text-charcoal-40 tabular-nums">
                                {fmtShootDate(nextShootSession.date)}
                                {nextShootSession.time ? ` · ${nextShootSession.time}` : ""}
                              </span>
                            </div>
                            {nextShootSession.location && (
                              <p className="text-sm text-charcoal-60 leading-relaxed mt-0.5">{nextShootSession.location}</p>
                            )}
                          </div>
                        </li>
                      )}
                      {(d.updates ?? []).map((u, i) => (
                        <li key={i} className="relative flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                          {del(() => up((c) => c.updates!.splice(i, 1)))}
                          <span className="mt-1.5 w-2 h-2 rounded-full bg-orange shrink-0" aria-hidden />
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-baseline gap-x-2">
                              <b className="text-sm font-semibold text-ink">{f(tr(u.title), (v) => up((c) => (c.updates![i].title[lang] = v)), false, ui("Update title…", "عنوان التحديث…"))}</b>
                              <span className="text-[11px] text-charcoal-40 tabular-nums">{(u.at || "").slice(0, 10)}</span>
                            </div>
                            {(edit || tr(u.body)) && (
                              <p className="text-sm text-charcoal-60 leading-relaxed mt-0.5">{f(tr(u.body), (v) => up((c) => { if (!c.updates![i].body) c.updates![i].body = { en: "", ar: "" }; c.updates![i].body![lang] = v; }), true, ui("Details…", "تفاصيل…"))}</p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                    {!edit && (d.updates ?? []).length === 0 && !nextPost && !nextShootSession && (
                      <p className="text-sm text-charcoal-40 py-2 text-center">{ui("No activity yet.", "لا نشاط بعد.")}</p>
                    )}
                    {add(() => up((c) => { c.updates = [{ at: new Date().toISOString().slice(0, 10), kind: "note", title: { en: "", ar: "" }, body: { en: "", ar: "" } }, ...(c.updates ?? [])]; }), ui("Add update", "تحديث"))}
                  </div>
                </section>
              )}
            </div>
          )}

          {/* PLAN */}
          {tab === "plan" && (
            <div className="space-y-5 lq-rise">
              <header className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className={MICRO}>{ui("Marker Plan", "خطة ماركر")}</p>
                  <h2 className="font-display font-extrabold text-[26px] tracking-tight text-ink leading-tight mt-1">
                    {f(d.plan?.name ?? "", (v) => up((c) => (c.plan.name = v)), false, ui("Plan name…", "اسم الخطة…"))}
                  </h2>
                </div>
                {edit ? (
                  <label className="lq-chip" style={{ gap: 8, cursor: "pointer" }}>
                    <input type="checkbox" checked={!!d.plan?.active} onChange={(e) => up((c) => (c.plan.active = e.target.checked))} /> {ui("Active", "نشطة")}
                  </label>
                ) : (
                  <span className={`lq-chip ${d.plan?.active ? "lq-chip--green" : "lq-chip--red"}`}>
                    {d.plan?.active ? ui("Active", "نشطة") : ui("Paused", "متوقفة")}
                  </span>
                )}
              </header>

              <div className="grid gap-4 md:grid-cols-12">
                <div className="lq-card p-5 md:col-span-7">
                  <span className={MICRO_TILE}>{ui("Cycle", "الدورة")}</span>
                  <div className="font-display font-extrabold text-[24px] sm:text-[28px] tracking-tight text-ink mt-2 flex gap-2 items-center flex-wrap">
                    {edit ? (
                      <>{f(d.plan?.start ?? "", (v) => up((c) => (c.plan.start = v)), false, "Start")} <span>→</span> {f(d.plan?.end ?? "", (v) => up((c) => (c.plan.end = v)), false, ui("End (blank = ongoing)", "النهاية"))}</>
                    ) : d.plan?.end ? (
                      `${d.plan.start} → ${d.plan.end}`
                    ) : (
                      `${d.plan?.start ? d.plan.start + " · " : ""}${ui("Ongoing", "مستمرّة")}`
                    )}
                  </div>
                  <p className="text-sm text-charcoal-60 leading-relaxed mt-3">{f(tr(d.plan?.note), (v) => up((c) => (c.plan.note[lang] = v)), true, ui("Note…", "ملاحظة…"))}</p>
                </div>
                {/* The one dark emphasis panel on this tab */}
                <div className="lq-dark p-5 md:col-span-5">
                  <p className="text-[11px] font-display font-bold uppercase tracking-[0.14em] text-white/55">{ui("Plan document", "وثيقة الخطة")}</p>
                  {edit ? (
                    <input className="ms-edit" value={d.plan?.notionUrl ?? ""} placeholder="https://notion.so/…" onChange={(e) => up((c) => (c.plan.notionUrl = e.target.value))} />
                  ) : d.plan?.notionUrl ? (
                    <a href={d.plan.notionUrl} target="_blank" rel="noreferrer" className="lq-btn lq-btn--primary no-underline mt-4">
                      {ui("Open in Notion", "افتح في نوشن")} <span>↗</span>
                    </a>
                  ) : (
                    <p className="text-sm text-white/65 leading-relaxed mt-2">{ui("The full plan will be shared here.", "ستُشارك الخطة الكاملة هنا.")}</p>
                  )}
                </div>
              </div>

              {/* Photo sessions — only when the studio shared shoots with the client. */}
              {!edit && shootsShared && hasShoots && (
                <div className="pt-3 space-y-3">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className={MICRO}>{ui("Photo sessions", "جلسات التصوير")}</p>
                      <h3 className="font-display font-bold text-[18px] tracking-tight text-ink mt-1">{ui("Your shoots", "جلساتك")}</h3>
                    </div>
                    {shots.length > 0 && (
                      <span className="lq-chip">{shotsDone}/{shots.length} {ui("shots ready", "لقطة جاهزة")}</span>
                    )}
                  </div>

                  {/* One surface: session rows, then the shot list under a divider. */}
                  <div className="lq-card p-5">
                    {sessions.length > 0 && (
                      <div className="divide-y divide-charcoal/5 lq-stagger">
                        {sessions.map((s, i) => {
                          const st = sessionStatusLabel[s.status] ?? sessionStatusLabel.planned;
                          const own = s.id ? shots.filter((t) => t.sessionId === s.id) : [];
                          return (
                            <div key={s.id ?? i} className="py-3.5 first:pt-0 last:pb-0" style={{ "--i": i } as React.CSSProperties}>
                              <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div className="min-w-0">
                                  <div className={MICRO_TILE}>{fmtShootDate(s.date)}{s.time ? ` · ${s.time}` : ""}</div>
                                  <div className="font-display font-bold text-[15.5px] text-ink mt-1">{s.title || ui("Shoot", "جلسة")}</div>
                                  {s.location && <div className="text-sm text-charcoal-60 mt-0.5">{s.location}</div>}
                                </div>
                                <span className={`lq-chip ${st.cls}`}>{ui(st.en, st.ar)}</span>
                              </div>
                              {tr(s.brief) && <p className="text-sm text-charcoal-60 leading-relaxed mt-2">{tr(s.brief)}</p>}
                              {own.length > 0 && (
                                <ul className="mt-3 pt-3 border-t border-charcoal/5 space-y-1.5">
                                  {own.map((t, j) => (
                                    <li key={t.id ?? j} className="flex items-center gap-3">
                                      <span aria-hidden className={t.status === "done" ? "text-orange" : "text-charcoal-20"}>{t.status === "done" ? "✓" : "○"}</span>
                                      <span className={`flex-1 text-sm ${t.status === "done" ? "line-through text-charcoal-40" : "text-charcoal-80"}`}>{t.title}</span>
                                      {t.status === "doing" && <span className="lq-chip lq-chip--blue">{ui("In progress", "قيد التنفيذ")}</span>}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {generalShots.length > 0 && (
                      <div className={sessions.length > 0 ? "mt-4 pt-4 border-t border-charcoal/5" : ""}>
                        <p className={MICRO}>{ui("General shot list", "قائمة اللقطات العامة")}</p>
                        <ul className="mt-2 divide-y divide-charcoal/5">
                          {generalShots.map((t, i) => (
                            <li key={t.id ?? i} className="flex items-center gap-3 py-2.5">
                              <span aria-hidden className={t.status === "done" ? "text-orange" : "text-charcoal-20"}>{t.status === "done" ? "✓" : "○"}</span>
                              <span className={`flex-1 text-sm ${t.status === "done" ? "line-through text-charcoal-40" : "text-charcoal-80"}`}>{t.title}</span>
                              {t.status === "doing" && <span className="lq-chip lq-chip--blue">{ui("In progress", "قيد التنفيذ")}</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Deliverables — progress (when shared) and/or task requests (when enabled). */}
              {!edit && (dlvShared || dlvRequestsOn) && (
                <div className="pt-3 space-y-3">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className={MICRO}>{ui("Deliverables", "المخرجات")}</p>
                      <h3 className="font-display font-bold text-[18px] tracking-tight text-ink mt-1">{ui("Where we are", "أين وصلنا")}</h3>
                    </div>
                    {dlvShared && dlvItems.length > 0 && (
                      <span className="lq-chip">{dlvDone}/{dlvItems.length} {ui("delivered", "تم تسليمه")}</span>
                    )}
                  </div>

                  {dlvShared && dlvItems.length > 0 && (
                    <div className="lq-card p-5">
                      <div className="flex items-center justify-between gap-3">
                        <span className={MICRO_TILE}>{ui("Progress", "نسبة الإنجاز")}</span>
                        <span className="font-display font-extrabold text-ink tabular-nums">{dlvPct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-charcoal/10 overflow-hidden mt-2.5">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#FFA226] to-[#F57F00]" style={{ width: `${dlvPct}%` }} />
                      </div>
                      <ul className="mt-3 divide-y divide-charcoal/5">
                        {dlvItems.map((it, i) => {
                          const st = dlvStatusLabel[it.status] ?? dlvStatusLabel.todo;
                          return (
                            <li key={it.id ?? i} className="flex items-center gap-3 py-3">
                              <span aria-hidden className={it.status === "done" ? "text-orange" : "text-charcoal-20"}>{it.status === "done" ? "✓" : "○"}</span>
                              <div className="flex-1 min-w-0">
                                <div className={`text-sm font-semibold ${it.status === "done" ? "line-through text-charcoal-40" : "text-ink"}`}>{it.title}</div>
                                {it.due && <div className="text-xs text-charcoal-60 mt-0.5">{fmtShootDate(it.due)}</div>}
                              </div>
                              <span className={`lq-chip ${st.cls}`}>{ui(st.en, st.ar)}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  {dlvRequestsOn && (
                    <div className="lq-card p-5">
                      <p className={MICRO}>{ui("Request a task", "اطلب مهمة")}</p>
                      <p className="text-sm text-charcoal-60 leading-relaxed mt-1">{ui("Need something specific? Send a request with a date — we'll review and confirm it.", "تحتاج شيئًا محددًا؟ أرسل طلبًا مع تاريخ — سنراجعه ونؤكده.")}</p>
                      <div className="grid gap-2.5 mt-3.5">
                        <input className="lq-input" value={reqTitle} onChange={(e) => setReqTitle(e.target.value)} placeholder={ui("What do you need?", "ما الذي تحتاجه؟")} />
                        <div className="flex gap-2.5 flex-wrap">
                          <input type="date" className="lq-input" style={{ width: "auto" }} value={reqDue} onChange={(e) => setReqDue(e.target.value)} />
                          <input className="lq-input" style={{ flex: 1, minWidth: 160, width: "auto" }} value={reqDetail} onChange={(e) => setReqDetail(e.target.value)} placeholder={ui("Any details (optional)", "تفاصيل إضافية (اختياري)")} />
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <button type="button" onClick={submitRequest} disabled={reqBusy || !reqTitle.trim()} className="lq-btn lq-btn--primary lq-press">
                            {reqBusy ? ui("Sending…", "جارٍ الإرسال…") : ui("Send request", "إرسال الطلب")}
                          </button>
                          {reqMsg && <span className="text-sm text-charcoal-60">{reqMsg}</span>}
                        </div>
                      </div>

                      {myRequests.length > 0 && (
                        <ul className="mt-4 divide-y divide-charcoal/5 border-t border-charcoal/5">
                          {myRequests.map((it, i) => {
                            const label = it.pending ? ui("Pending approval", "بانتظار الموافقة") : it.status === "done" ? ui("Delivered", "تم التسليم") : ui("Approved", "تمت الموافقة");
                            const cls = it.pending ? "" : it.status === "done" ? "lq-chip--green" : "lq-chip--blue";
                            return (
                              <li key={it.id ?? i} className="flex items-center gap-3 py-3">
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-semibold text-ink">{it.title}</div>
                                  {it.due && <div className="text-xs text-charcoal-60 mt-0.5">{fmtShootDate(it.due)}</div>}
                                </div>
                                <span className={`lq-chip ${cls}`}>{label}</span>
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
          )}

          {/* SOCIAL */}
          {tab === "social" && (
            <div className="space-y-4 lq-rise">
              <header>
                <p className={MICRO}>{ui("Social Media Plan", "خطة السوشال ميديا")}</p>
                <h2 className="font-display font-extrabold text-[26px] tracking-tight text-ink leading-tight mt-1">
                  {f(tr(d.social?.headline), (v) => up((c) => (c.social.headline[lang] = v)), false, ui("Headline…", "عنوان…"))}
                </h2>
              </header>
              <SocialCalendar
                posts={d.social?.posts ?? []}
                editable={edit}
                lang={lang}
                onChange={(posts) => up((c) => (c.social.posts = posts))}
                feedback={edit ? undefined : { role: viewerRole, onApprove: approvePost, onComment: commentPost, busy: postBusy }}
              />
              {edit ? (
                <p className="text-[13px] text-charcoal-60">{ui("Click a day to add or edit posts.", "اضغط على يوم لإضافة أو تعديل المنشورات.")}</p>
              ) : (
                <p className="text-[13px] text-charcoal-60">{ui("Open a post to approve it, request changes, or leave a comment.", "افتح المنشور للموافقة عليه أو طلب تعديل أو ترك تعليق.")}</p>
              )}
            </div>
          )}

          {/* ANALYSIS */}
          {tab === "analysis" && (
            <div className="lq-rise">
              {/* AI analysis — the AI designs the whole thing (cards, charts);
                  generated by the studio, sanitized, shown to the client. */}
              {/* `ms-portal` re-scopes the .ms-ai-* CSS here (bg/min-height neutralized). */}
              {tr(aiData?.html) && (
                <div className="ms-portal ms-ai-wrap !bg-transparent !min-h-0" style={{ marginBottom: 28 }}>
                  <span className="ms-ai__badge">{ui("AI reading", "قراءة الذكاء الاصطناعي")}</span>
                  <div className="ms-ai-html" dir={lang === "ar" ? "rtl" : "ltr"} dangerouslySetInnerHTML={{ __html: tr(aiData?.html) }} />
                </div>
              )}

              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className={MICRO}>{ui("Organic content", "المحتوى العضوي")}</p>
                  <h2 className="font-display font-extrabold text-[26px] tracking-tight text-ink leading-tight mt-1">
                    {f(tr(d.analysis?.organic?.headline), (v) => up((c) => (c.analysis.organic.headline[lang] = v)), false, ui("Headline…", "عنوان…"))}
                  </h2>
                </div>
                {metaLive && !edit && (
                  <span className="lq-chip lq-chip--green ms-live-pill" title={ui("Updated automatically from Facebook & Instagram", "يُحدَّث تلقائياً من فيسبوك وإنستغرام")}>
                    {ui("Live from Meta", "مباشر من Meta")}
                  </span>
                )}
              </div>

              <div className="mt-4">
                {!edit && (d.analysis?.organic?.metrics ?? []).length === 0 && <p className="text-sm text-charcoal-40">{ui("No organic results yet.", "لا نتائج عضوية بعد.")}</p>}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5 lq-stagger">
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
                      <div key={i} className="lq-card p-5 relative" style={{ "--i": i } as React.CSSProperties}>
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
                            {delta && <span className={`lq-chip ${down ? "lq-chip--red" : "lq-chip--green"} absolute top-4 end-4 !px-2 !py-1 tabular-nums`}>{delta}</span>}
                            <div className="font-display font-extrabold text-[24px] tracking-tight tabular-nums text-ink">{value || "—"}</div>
                            <div className={`${MICRO_TILE} mt-1`}>{m.label}</div>
                            {m.note && <p className="text-xs text-charcoal-60 leading-relaxed mt-1.5">{m.note}</p>}
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
                <div className="lq-card p-5 mt-4">
                  <p className={MICRO}>{ui("Reading", "قراءة")}</p>
                  <p className="text-[16px] text-charcoal-80 leading-relaxed mt-2">{f(tr(d.analysis?.organic?.reading), (v) => up((c) => (c.analysis.organic.reading[lang] = v)), true, ui("Reading…", "قراءة…"))}</p>
                </div>
              )}

              <div className="flex flex-wrap items-end justify-between gap-3 mt-10">
                <div>
                  <p className={MICRO}>{ui("Paid campaigns", "الحملات المدفوعة")}</p>
                  <h2 className="font-display font-extrabold text-[22px] tracking-tight text-ink leading-tight mt-1">{ui("What each campaign did.", "شو عملت كل حملة.")}</h2>
                </div>
                <span className="lq-chip lq-chip--orange">{ui("Total spend", "الإنفاق")}: {f(d.analysis?.paid?.spend ?? "", (v) => up((c) => (c.analysis.paid.spend = v)), false, "$0")}</span>
              </div>
              <p className="text-sm text-charcoal-60 leading-relaxed mt-2 mb-4 max-w-[720px]">{f(tr(d.analysis?.paid?.note), (v) => up((c) => (c.analysis.paid.note[lang] = v)), true, ui("Note…", "ملاحظة…"))}</p>
              <div>
                {!edit && (d.analysis?.paid?.campaigns ?? []).length === 0 && <p className="text-sm text-charcoal-40">{ui("No paid campaigns yet.", "لا حملات مدفوعة بعد.")}</p>}
                <div className="space-y-3.5 lq-stagger">
                  {(d.analysis?.paid?.campaigns ?? []).map((c, i) => (
                    <div key={i} className="lq-card p-5 relative" style={{ "--i": i } as React.CSSProperties}>
                      {del(() => up((x) => x.analysis.paid.campaigns.splice(i, 1)))}
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <b className="font-display font-bold text-[16px] tracking-tight text-ink">{f(c.name, (v) => up((x) => (x.analysis.paid.campaigns[i].name = v)), false, "Campaign")}</b>
                          <div className="text-xs font-semibold text-charcoal-60 mt-0.5">{f(c.period, (v) => up((x) => (x.analysis.paid.campaigns[i].period = v)), false, "Period")} · {f(c.type, (v) => up((x) => (x.analysis.paid.campaigns[i].type = v)), false, "Type")}</div>
                        </div>
                        <span className="lq-chip lq-chip--orange tabular-nums">{f(c.spend, (v) => up((x) => (x.analysis.paid.campaigns[i].spend = v)), false, "$")}</span>
                      </div>
                      <p className="text-sm text-charcoal-60 leading-relaxed mt-2.5">{f(c.desc, (v) => up((x) => (x.analysis.paid.campaigns[i].desc = v)), true, "Description")}</p>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mt-4">
                        {([["reach", ui("Reach", "وصول")], ["impressions", ui("Impressions", "ظهور")], ["freq", ui("Frequency", "تكرار")], ["cpm", "CPM"], ["spend", ui("Spent", "صُرف")]] as const).map(([k, labelText]) => (
                          <div className="lq-well px-3 py-2.5 text-center" key={k}>
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            <strong className="block font-display font-bold text-[15px] tabular-nums text-ink">{f((c as any)[k], (v) => up((x) => (x.analysis.paid.campaigns[i][k] = v)), false, "")}</strong>
                            <span className={`block ${MICRO_TILE} mt-0.5`}>{labelText}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 12 }}>{add(() => up((c) => c.analysis.paid.campaigns.push({ name: "", period: "", type: "", spend: "", reach: "", impressions: "", freq: "", cpm: "", desc: "" })), ui("Add campaign", "حملة"))}</div>
              </div>
            </div>
          )}

          {/* FINANCE */}
          {tab === "invoices" && (
            <div className="space-y-5 lq-rise">
              <header className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className={MICRO}>{ui("Finance", "المالية")}</p>
                  <h2 className="font-display font-extrabold text-[26px] tracking-tight text-ink leading-tight mt-1">{ui("Payments & balance.", "المدفوعات والرصيد.")}</h2>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <a className="lq-btn lq-btn--primary no-underline" href={`/portal/${client.slug}/statement`}>
                    {ui("Download statement", "تنزيل كشف حساب")} <span>↓</span>
                  </a>
                  <a className="lq-btn lq-btn--glass no-underline" href={`/portal/${client.slug}/invoices`}>
                    {ui("All invoices", "كل الفواتير")} <span>→</span>
                  </a>
                </div>
              </header>

              {/* One money panel — the tab's single dark emphasis surface:
                  balance as the hero number, paid progress beside it, fees in a
                  divided strip below. */}
              {(edit || d.plan?.balance || d.finance?.monthlyFee || (d.finance?.progress ?? 0) > 0 || d.finance?.brandingFee) && (
                <section className="lq-dark lq-rise p-5 sm:p-6" style={{ animationDelay: "60ms" }}>
                  <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
                    {(edit || d.plan?.balance) && (
                      <div className="min-w-0">
                        <span className="block text-[10px] font-display font-bold uppercase tracking-[0.12em] text-white/55">{ui("Money left", "المبلغ المتبقّي")}</span>
                        <div className="font-display font-extrabold text-[32px] sm:text-[38px] leading-none tracking-tight tabular-nums mt-2">{f(d.plan?.balance ?? "", (v) => up((c) => (c.plan.balance = v)), false, "—")}</div>
                      </div>
                    )}
                    {(edit || d.finance?.monthlyFee || (d.finance?.progress ?? 0) > 0) && (
                      <div className="w-full sm:w-[240px]">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-white/55">{ui("Paid", "نسبة السداد")}</span>
                          {!edit && <span className="font-display font-extrabold text-[15px] tabular-nums">{d.finance?.progress ?? 0}%</span>}
                        </div>
                        {edit ? (
                          <input type="range" min={0} max={100} value={d.finance?.progress ?? 0} className="w-full accent-orange" style={{ marginTop: 12 }} onChange={(e) => up((c) => { if (!c.finance) c.finance = { monthlyFee: "", progress: 0 }; c.finance.progress = Number(e.target.value); })} />
                        ) : (
                          <div className="h-1.5 rounded-full bg-white/15 overflow-hidden mt-2">
                            <div className="h-full rounded-full bg-gradient-to-r from-[#FFA226] to-[#F57F00]" style={{ width: `${d.finance?.progress ?? 0}%` }} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Branding fee is shown for reference only — the "Money left"
                      figure above is the single combined balance (branding +
                      marketing + extras − paid). No separate branding balance. */}
                  {(edit || d.finance?.monthlyFee || d.finance?.brandingFee) && (
                    <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap gap-y-3 [&>*+*]:border-s [&>*+*]:border-white/10">
                      {(edit || monthlyFeeShown) && (
                        <div className="min-w-0 ps-6 pe-6 first:ps-0">
                          <span className="block text-[10px] font-display font-bold uppercase tracking-[0.12em] text-white/55">{ui("Monthly fee", "الاشتراك الشهري")}</span>
                          <div className="font-display font-extrabold text-[18px] tracking-tight tabular-nums mt-1">{f(edit ? (d.finance?.monthlyFee ?? "") : monthlyFeeShown, (v) => up((c) => { if (!c.finance) c.finance = { monthlyFee: "", progress: 0 }; c.finance.monthlyFee = v; }), false, "—")}</div>
                        </div>
                      )}
                      {(edit || d.finance?.brandingFee) && (
                        <div className="min-w-0 ps-6 pe-6 first:ps-0">
                          <span className="block text-[10px] font-display font-bold uppercase tracking-[0.12em] text-white/55">{ui("Branding fee (fixed)", "رسوم الهوية (ثابتة)")}</span>
                          <div className="font-display font-extrabold text-[18px] tracking-tight tabular-nums mt-1">{f(d.finance?.brandingFee ?? "", (v) => up((c) => { if (!c.finance) c.finance = { monthlyFee: "", progress: 0 }; c.finance.brandingFee = v; }), false, "—")}</div>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              )}

              <section className="pt-2">
                <p className={MICRO}>{ui("Payment history", "سجلّ المدفوعات")}</p>
                <div className="lq-card p-5 mt-3">
                  {!edit && (d.invoices ?? []).length === 0 && <p className="text-sm text-charcoal-40 py-4 text-center">{ui("No payments recorded yet.", "لا مدفوعات مسجّلة بعد.")}</p>}
                  <ul className="divide-y divide-charcoal/5">
                    {(d.invoices ?? []).map((inv, i) => (
                      <li key={i} className="relative flex items-center gap-4 py-3.5 first:pt-0 last:pb-0 flex-wrap">
                        {del(() => up((c) => c.invoices.splice(i, 1)))}
                        <div className="flex-1 min-w-0">
                          <b className="block text-sm font-semibold text-ink">{f(inv.cycle, (v) => up((c) => (c.invoices[i].cycle = v)), false, "Cycle")}</b>
                          <div className="text-xs text-charcoal-60 mt-0.5">{f(inv.desc, (v) => up((c) => (c.invoices[i].desc = v)), false, "Description")}</div>
                        </div>
                        <div className="font-display font-extrabold text-[20px] tracking-tight tabular-nums text-ink">{f(inv.amount, (v) => up((c) => (c.invoices[i].amount = v)), false, "0")}</div>
                        {edit ? (
                          <select className="ms-edit" value={inv.status} onChange={(e) => up((c) => (c.invoices[i].status = e.target.value))}>
                            <option value="paid">{ui("Paid", "مدفوعة")}</option>
                            <option value="due">{ui("Due", "مستحقة")}</option>
                            <option value="overdue">{ui("Overdue", "متأخرة")}</option>
                          </select>
                        ) : (
                          <span className={`lq-chip ${STATUS_PILL[inv.status] || ""}`}>
                            {inv.status === "paid" ? ui("Paid", "مدفوعة") : inv.status === "overdue" ? ui("Overdue", "متأخرة") : ui("Due", "مستحقة")}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <div style={{ marginTop: 12 }}>{add(() => up((c) => c.invoices.push({ cycle: "", desc: "", amount: "", status: "due" })), ui("Add payment", "دفعة"))}</div>
                </div>
              </section>
            </div>
          )}

          {/* DOCUMENTS */}
          {tab === "documents" && (
            <div className="space-y-5 lq-rise">
              <header>
                <p className={MICRO}>{ui("Documents", "المستندات")}</p>
                <h2 className="font-display font-extrabold text-[26px] tracking-tight text-ink leading-tight mt-1">{ui("Proposals & agreements.", "العروض والاتفاقيات.")}</h2>
              </header>

              {/* Live studio documents — shown once the studio has sent them. */}
              {(client.data.proposal?.published || client.data.agreement?.published) && (
                <div className="grid gap-4 md:grid-cols-2 lq-stagger">
                  {client.data.proposal?.published && (
                    <a className="lq-card lq-card--hover p-5 block no-underline" href={`/portal/${client.slug}/proposal`} style={{ "--i": 0 } as React.CSSProperties}>
                      <span className="text-[11px] font-display font-bold uppercase tracking-[0.14em] text-orange-deep">{ui("Interactive document", "مستند تفاعلي")}</span>
                      <h3 className="font-display font-bold text-[18px] tracking-tight text-ink mt-1.5">{ui("Your proposal", "عرضك")}</h3>
                      <p className="text-sm text-charcoal-60 leading-relaxed mt-1.5">
                        {client.data.proposal?.acceptedAt
                          ? ui("Accepted — thank you. You can reopen and export it any time.", "تم القبول — شكرًا لك. يمكنك فتحه وتصديره في أي وقت.")
                          : client.data.proposal?.published
                          ? ui("Review the scope, pick your plan and accept — all inside the document.", "راجع النطاق، اختر خطتك واقبل — كل ذلك داخل المستند.")
                          : ui("Draft — only the studio can see this for now.", "مسودة — يراها الاستوديو فقط حاليًا.")}
                      </p>
                      <div className="flex items-center justify-between gap-3 mt-4">
                        <span className={`lq-chip ${client.data.proposal?.acceptedAt ? "lq-chip--green" : "lq-chip--orange"}`}>
                          {client.data.proposal?.acceptedAt ? ui("Accepted", "مقبول") : client.data.proposal?.published ? ui("Awaiting your review", "بانتظار مراجعتك") : ui("Draft", "مسودة")}
                        </span>
                        <span className="text-sm font-display font-bold text-orange-deep">{ui("Open", "افتح")} →</span>
                      </div>
                    </a>
                  )}
                  {client.data.agreement?.published && (
                    <a className="lq-card lq-card--hover p-5 block no-underline" href={`/portal/${client.slug}/agreement`} style={{ "--i": 1 } as React.CSSProperties}>
                      <span className="text-[11px] font-display font-bold uppercase tracking-[0.14em] text-orange-deep">{ui("E-sign document", "مستند للتوقيع الإلكتروني")}</span>
                      <h3 className="font-display font-bold text-[18px] tracking-tight text-ink mt-1.5">{ui("Service agreement", "اتفاقية الخدمة")}</h3>
                      <p className="text-sm text-charcoal-60 leading-relaxed mt-1.5">
                        {client.data.agreement?.acceptedAt
                          ? ui("Signed and in force. Reopen or export it any time.", "موقّعة وسارية. افتحها أو صدّرها في أي وقت.")
                          : client.data.agreement?.published
                          ? ui("Read the terms and sign electronically when you're ready.", "اقرأ الشروط ووقّع إلكترونيًا عندما تكون جاهزًا.")
                          : ui("Draft — only the studio can see this for now.", "مسودة — يراها الاستوديو فقط حاليًا.")}
                      </p>
                      <div className="flex items-center justify-between gap-3 mt-4">
                        <span className={`lq-chip ${client.data.agreement?.acceptedAt ? "lq-chip--green" : "lq-chip--orange"}`}>
                          {client.data.agreement?.acceptedAt ? ui("Signed", "موقّعة") : client.data.agreement?.published ? ui("Awaiting signature", "بانتظار التوقيع") : ui("Draft", "مسودة")}
                        </span>
                        <span className="text-sm font-display font-bold text-orange-deep">{ui("Open", "افتح")} →</span>
                      </div>
                    </a>
                  )}
                </div>
              )}

              {(() => {
                // Group files by folder so the client sees them sorted the same
                // way the studio filed them; portals with no folders render one
                // clean grid (no headers), exactly as before.
                const all = (d.documents ?? []).map((doc, i) => ({ doc, i }));
                const names = d.docFolders ?? [];
                const groups = [
                  ...names.map((name) => ({ name, items: all.filter(({ doc }) => (doc.folder || "") === name) })),
                  { name: "", items: all.filter(({ doc }) => !doc.folder || !names.includes(doc.folder)) },
                ].filter((g) => g.items.length > 0);
                const showHeaders = groups.some((g) => g.name);
                const card = (doc: (typeof all)[number]["doc"], i: number) => (
                  <div key={i} className="lq-card p-5 flex flex-col gap-3 relative" style={{ "--i": i } as React.CSSProperties}>
                    {del(() => up((c) => c.documents.splice(i, 1)))}
                    <span className="lq-chip lq-chip--orange self-start uppercase !text-[10px]">{f(doc.type || "DOC", (v) => up((c) => (c.documents[i].type = v)), false, "PDF")}</span>
                    <h3 className="font-display font-bold text-[15.5px] tracking-tight text-ink m-0">{f(doc.title, (v) => up((c) => (c.documents[i].title = v)), false, "Title")}</h3>
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
                      <a href={doc.url} target="_blank" rel="noreferrer" className="lq-btn lq-btn--glass lq-btn--sm self-start no-underline">{ui("Open", "فتح")} <span>↗</span></a>
                    ) : (
                      <span className="text-sm text-charcoal-40">{ui("Shared soon.", "ستُشارك قريباً.")}</span>
                    )}
                  </div>
                );
                return (
                  <div className="space-y-6">
                    {groups.map((g) => (
                      <div key={g.name || "__ungrouped"} className="space-y-3">
                        {showHeaders && (
                          <p className="text-[11px] font-display font-bold uppercase tracking-[0.14em] text-charcoal-60">
                            {g.name || ui("Other", "أخرى")}
                          </p>
                        )}
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lq-stagger">
                          {g.items.map(({ doc, i }) => card(doc, i))}
                        </div>
                      </div>
                    ))}
                    {edit && <div style={{ display: "flex", alignItems: "center" }}>{add(() => up((c) => c.documents.push({ title: "", type: "PDF", url: "" })), ui("Add document", "مستند"))}</div>}
                  </div>
                );
              })()}

              {/* Brand assets — final creative deliverables to download. */}
              <div className="pt-4">
                <p className={MICRO}>{ui("Brand assets", "أصول العلامة")}</p>
                <h3 className="font-display font-bold text-[18px] tracking-tight text-ink mt-1">{ui("Your deliverables.", "مُسلّماتك.")}</h3>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lq-stagger">
                {!edit && (d.assets ?? []).length === 0 && (
                  <p className="text-sm text-charcoal-40 sm:col-span-2 lg:col-span-3">{ui("Final files — logos, exports, guidelines — will appear here to download.", "ستظهر الملفات النهائية — الشعارات والتصاميم والأدلّة — هنا للتنزيل.")}</p>
                )}
                {(d.assets ?? []).map((a, i) => (
                  <div key={i} className="lq-card p-5 flex flex-col gap-3 relative" style={{ "--i": i } as React.CSSProperties}>
                    {del(() => up((c) => c.assets!.splice(i, 1)))}
                    <span className="lq-chip lq-chip--orange self-start uppercase !text-[10px]">{f(a.type || "FILE", (v) => up((c) => (c.assets![i].type = v)), false, "PNG")}</span>
                    <h3 className="font-display font-bold text-[15.5px] tracking-tight text-ink m-0">{f(a.title, (v) => up((c) => (c.assets![i].title = v)), false, "Title")}</h3>
                    {a.size && !edit && <span className="text-xs text-charcoal-40">{a.size}</span>}
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
                      <a href={a.url} target="_blank" rel="noreferrer" download className="lq-btn lq-btn--glass lq-btn--sm self-start no-underline">{ui("Download", "تنزيل")} <span>↓</span></a>
                    ) : (
                      <span className="text-sm text-charcoal-40">{ui("Shared soon.", "ستُشارك قريباً.")}</span>
                    )}
                  </div>
                ))}
                {edit && <div style={{ display: "flex", alignItems: "center" }}>{add(() => up((c) => { c.assets = [...(c.assets ?? []), { title: "", type: "PNG", url: "" }]; }), ui("Add asset", "أصل"))}</div>}
              </div>
            </div>
          )}

          <footer className="pt-8 pb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-charcoal-40">
            <span>{ui("We mark the brands that matter.", "نعلّم على العلامات التي تستحقّ.")}</span>
            <span>{client.name} · {ui("Private portal", "بوابة خاصة")}</span>
          </footer>
        </div>
      </main>

      {/* ---------- Mobile floating tab bar ---------- */}
      <nav className="lq-tabbar lq-chrome" aria-label={ui("Portal sections", "أقسام البوابة")}>
        {TABS.map((tb) => (
          <button
            key={tb.id}
            type="button"
            className={`lq-tab ${tab === tb.id ? "is-active" : ""}`}
            onClick={() => goTab(tb.id)}
          >
            {TAB_ICONS[tb.id]}
            {ui(DOCK_LABELS[tb.id]?.en || tb.en, DOCK_LABELS[tb.id]?.ar || tb.ar)}
          </button>
        ))}
      </nav>
    </div>
  );
}
