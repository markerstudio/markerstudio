"use client";

import { useState } from "react";
import type { SocialPost, SocialContentType, ContentStage } from "@/lib/clients";

const WD = {
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  ar: ["أحد", "إثن", "ثلا", "أرب", "خمي", "جمع", "سبت"],
};
const MONTHS = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  ar: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
};
const STATUS_CLASS: Record<string, string> = { posted: "ms-cal-post--posted", scheduled: "ms-cal-post--scheduled", planned: "ms-cal-post--planned" };
// Content type drives the glyph + the label of the long brief field.
const TYPES: { id: SocialContentType; en: string; ar: string; icon: string }[] = [
  { id: "post", en: "Post", ar: "منشور", icon: "▦" },
  { id: "story", en: "Story", ar: "ستوري", icon: "◍" },
  { id: "reel", en: "Reel", ar: "ريل", icon: "►" },
  { id: "carousel", en: "Carousel", ar: "كاروسيل", icon: "▤" },
];
const typeMeta = (t?: string) => TYPES.find((x) => x.id === t) ?? TYPES[0];
const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

// Production pipeline. `status` (portal pills) is derived from the chosen stage.
const STAGES: { id: ContentStage; en: string; ar: string }[] = [
  { id: "idea", en: "Idea", ar: "فكرة" },
  { id: "shoot", en: "To shoot", ar: "للتصوير" },
  { id: "edit", en: "Editing", ar: "مونتاج" },
  { id: "scheduled", en: "Scheduled", ar: "مجدول" },
  { id: "posted", en: "Posted", ar: "نُشر" },
];
const statusFromStage = (s: ContentStage): SocialPost["status"] => (s === "posted" ? "posted" : s === "scheduled" ? "scheduled" : "planned");
const stageOf = (p: SocialPost): ContentStage => p.stage ?? (p.status === "posted" ? "posted" : p.status === "scheduled" ? "scheduled" : "idea");

export type CalendarFeedback = {
  role: "studio" | "client";
  onApprove: (idx: number, approval: "approved" | "changes") => void;
  onComment: (idx: number, text: string) => void;
  busy?: number | null; // index currently saving
};

export default function SocialCalendar({
  posts,
  onChange,
  editable = false,
  lang = "en",
  feedback,
  onDropShot,
  onNeedsShoot,
}: {
  posts: SocialPost[];
  onChange?: (posts: SocialPost[]) => void;
  editable?: boolean;
  lang?: "en" | "ar";
  feedback?: CalendarFeedback;
  // When provided, calendar days accept dragged shots ({kind:"shot",id}); the host
  // creates the scheduled post. Enables the Plan & Content drag-and-drop.
  onDropShot?: (dateISO: string, shotId: string) => void;
  // When provided, an editable post shows a "Needs shoot" toggle that adds (or
  // removes) a linked shot in the shoot to-do list. The host owns the photo block.
  onNeedsShoot?: (idx: number) => void;
}) {
  const ui = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const tLabel = (t?: string) => ui(typeMeta(t).en, typeMeta(t).ar);
  const briefLabel = (t?: string) =>
    t === "reel" ? ui("Reel script", "سكربت الريل") : t === "story" ? ui("Stories direction", "إخراج الستوري") : t === "carousel" ? ui("Carousel slides", "شرائح الكاروسيل") : ui("Post details", "تفاصيل المنشور");
  const briefPlaceholder = (t?: string) =>
    t === "reel"
      ? ui("Hook, scene-by-scene script, captions, audio…", "الخطّاف، السكربت مشهداً بمشهد، التعليقات، الصوت…")
      : t === "story"
      ? ui("Frame-by-frame direction — polls, stickers, CTA…", "إخراج إطاراً بإطار — تصويتات، ملصقات، دعوة لإجراء…")
      : t === "carousel"
      ? ui("Slide-by-slide outline…", "مخطّط شريحة بشريحة…")
      : ui("Caption, key message, visual direction…", "التعليق، الرسالة الأساسية، التوجيه البصري…");

  const first = posts.find((p) => p.date)?.date;
  const init = first ? new Date(first + "T00:00:00") : new Date();
  const [y, setY] = useState(init.getFullYear());
  const [m, setM] = useState(init.getMonth());
  const [view, setView] = useState<"month" | "week">("month");
  const startOfWeek = (d: Date) => { const s = new Date(d); s.setDate(d.getDate() - d.getDay()); s.setHours(0, 0, 0, 0); return s; };
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(init));
  const [sel, setSel] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null); // expanded entry (view mode)
  const [draft, setDraft] = useState(""); // comment composer for the open entry

  const APPROVAL_PILL: Record<string, string> = { approved: "lq-chip--green", changes: "lq-chip--red", pending: "" };
  const approvalLabel = (a?: string) =>
    a === "approved" ? ui("Approved", "موافَق") : a === "changes" ? ui("Changes requested", "تعديلات مطلوبة") : ui("Awaiting approval", "بانتظار الموافقة");

  const now = new Date();
  const todayStr = fmt(now.getFullYear(), now.getMonth(), now.getDate());
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const firstWeekday = new Date(y, m, 1).getDay();
  const byDate: Record<string, { p: SocialPost; idx: number }[]> = {};
  posts.forEach((p, idx) => {
    if (!p.date) return;
    (byDate[p.date] ||= []).push({ p, idx });
  });

  // Cells to render: month = leading blanks + days; week = the 7 days of weekStart.
  const weekDates: string[] = Array.from({ length: 7 }).map((_, i) => {
    const dt = new Date(weekStart);
    dt.setDate(weekStart.getDate() + i);
    return fmt(dt.getFullYear(), dt.getMonth(), dt.getDate());
  });
  const cells: (string | null)[] = view === "week"
    ? weekDates
    : [...Array.from({ length: firstWeekday }).map(() => null), ...Array.from({ length: daysInMonth }).map((_, i) => fmt(y, m, i + 1))];

  const prev = () => {
    if (view === "week") { const s = new Date(weekStart); s.setDate(weekStart.getDate() - 7); setWeekStart(s); setY(s.getFullYear()); setM(s.getMonth()); }
    else if (m === 0) { setY(y - 1); setM(11); } else setM(m - 1);
  };
  const next = () => {
    if (view === "week") { const s = new Date(weekStart); s.setDate(weekStart.getDate() + 7); setWeekStart(s); setY(s.getFullYear()); setM(s.getMonth()); }
    else if (m === 11) { setY(y + 1); setM(0); } else setM(m + 1);
  };
  const goToday = () => { setY(now.getFullYear()); setM(now.getMonth()); setWeekStart(startOfWeek(now)); };

  const update = (idx: number, patch: Partial<SocialPost>) => onChange?.(posts.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  const remove = (idx: number) => onChange?.(posts.filter((_, i) => i !== idx));
  const addOn = (date: string, type: SocialPost["type"] = "post") =>
    onChange?.([...posts, { date, platform: "", title: "", notes: "", status: "planned", stage: "idea", type, brief: "" }]);

  // --- Drag and drop ---------------------------------------------------------
  const dndOn = editable || !!onDropShot;
  const onDayDragOver = (e: React.DragEvent) => { if (dndOn) e.preventDefault(); };
  const onDayDrop = (date: string) => (e: React.DragEvent) => {
    const raw = e.dataTransfer.getData("text/plain");
    if (!raw) return;
    e.preventDefault();
    let payload: { kind?: string; idx?: number; id?: string };
    try { payload = JSON.parse(raw); } catch { return; }
    if (payload.kind === "post" && typeof payload.idx === "number" && editable) update(payload.idx, { date });
    else if (payload.kind === "shot" && payload.id && onDropShot) onDropShot(date, payload.id);
  };

  // Month summary — quick read on the cadence (and the "daily stories" goal).
  const monthPrefix = `${y}-${pad(m + 1)}`;
  const monthPosts = posts.filter((p) => p.date?.startsWith(monthPrefix));
  const countOf = (t: string) => monthPosts.filter((p) => (p.type || "post") === t).length;
  const storyDays = new Set(monthPosts.filter((p) => p.type === "story").map((p) => p.date)).size;

  const selEntries = sel ? byDate[sel] ?? [] : [];
  const prettyDay = (iso: string) => {
    const dt = new Date(iso + "T00:00:00");
    return `${WD[lang][dt.getDay()]} · ${dt.getDate()} ${MONTHS[lang][dt.getMonth()]}`;
  };
  const weekLabel = `${new Date(weekDates[0] + "T00:00:00").getDate()}–${new Date(weekDates[6] + "T00:00:00").getDate()} ${MONTHS[lang][new Date(weekDates[6] + "T00:00:00").getMonth()]} ${new Date(weekDates[6] + "T00:00:00").getFullYear()}`;

  const Thumb = ({ url, kind }: { url?: string; kind?: string }) =>
    !url ? null : kind === "video" ? (
      // eslint-disable-next-line jsx-a11y/media-has-caption
      <video src={url} muted className="ms-cal-thumb" />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" className="ms-cal-thumb" />
    );

  return (
    <div className="ms-cal lq-card p-4 sm:p-5">
      <div className="ms-cal-head">
        <div className="ms-cal-headline">
          <strong>{view === "week" ? weekLabel : `${MONTHS[lang][m]} ${y}`}</strong>
          <div className="ms-cal-summary">
            {TYPES.map((t) => (
              <span key={t.id} className={`ms-cal-key ms-cal-key--${t.id}`}><i>{t.icon}</i>{countOf(t.id)} {tLabel(t.id)}</span>
            ))}
            <span className="lq-chip lq-chip--orange">{ui("Story days", "أيام الستوري")} {storyDays}/{daysInMonth}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button type="button" onClick={() => setView(view === "month" ? "week" : "month")} className="lq-btn lq-btn--glass lq-btn--sm lq-press" aria-label="Toggle view">
            {view === "month" ? ui("Week", "أسبوع") : ui("Month", "شهر")}
          </button>
          <button type="button" onClick={prev} className="lq-btn lq-btn--glass lq-btn--sm lq-press !px-3 text-[16px]" aria-label="Previous">‹</button>
          <button type="button" onClick={goToday} className="lq-btn lq-btn--glass lq-btn--sm lq-press" aria-label="Today">{ui("Today", "اليوم")}</button>
          <button type="button" onClick={next} className="lq-btn lq-btn--glass lq-btn--sm lq-press !px-3 text-[16px]" aria-label="Next">›</button>
        </div>
      </div>

      <div className="ms-cal-grid">
        {WD[lang].map((w) => <div key={w} className="ms-cal-wd">{w}</div>)}
        {cells.map((date, ci) => {
          if (!date) return <div key={`b${ci}`} className="ms-cal-day is-other" />;
          const d = new Date(date + "T00:00:00").getDate();
          const dayPosts = byDate[date] ?? [];
          return (
            <div
              key={date}
              className={`ms-cal-day ${sel === date ? "is-selected" : ""} ${date === todayStr ? "is-today" : ""} ${dayPosts.length ? "has-posts" : ""}`}
              onClick={() => { setSel(date); setOpen(null); }}
              onDragOver={onDayDragOver}
              onDrop={onDayDrop(date)}
              role="button"
              tabIndex={0}
            >
              <span className="ms-cal-num">{d}</span>
              {dayPosts.slice(0, 3).map(({ p, idx }, k) => (
                <span
                  key={k}
                  className={`ms-cal-post ms-cal-post--${p.type || "post"} ${STATUS_CLASS[p.status] || ""}`}
                  title={`${tLabel(p.type)} · ${p.platform} · ${p.title}`}
                  draggable={editable}
                  onDragStart={editable ? (e) => { e.dataTransfer.setData("text/plain", JSON.stringify({ kind: "post", idx })); e.dataTransfer.effectAllowed = "move"; } : undefined}
                >
                  {p.mediaUrl ? <Thumb url={p.mediaUrl} kind={p.mediaKind} /> : <i className="ms-cal-post__type" aria-hidden>{typeMeta(p.type).icon}</i>}
                  {p.title || p.platform || tLabel(p.type)}
                </span>
              ))}
              {dayPosts.length > 3 && <span className="ms-cal-more">+{dayPosts.length - 3}</span>}
            </div>
          );
        })}
      </div>

      {/* Selected-day panel — premium per-entry cards */}
      {sel && (
        <div className="lq-well p-4 mt-4">
          <div className="ms-cal-panel__head">
            <b>{prettyDay(sel)}</b>
            {editable && (
              <span className="ms-cal-add-group">
                {TYPES.map((t) => (
                  <button key={t.id} type="button" className="lq-btn lq-btn--glass lq-btn--sm lq-press" onClick={() => addOn(sel, t.id)}>+ {tLabel(t.id)}</button>
                ))}
              </span>
            )}
          </div>

          {selEntries.length === 0 && <p className="text-sm text-charcoal-60" style={{ margin: "8px 0 0" }}>{ui("Nothing planned for this day yet.", "لا شيء مخطّط لهذا اليوم بعد.")}</p>}

          <div className="ms-cal-entries">
            {selEntries.map(({ p, idx }) => {
              const type = p.type || "post";
              if (editable) {
                return (
                  <div key={idx} className={`ms-cal-entry ms-cal-entry--${type}`}>
                    <div className="ms-cal-entry__head">
                      <select className="ms-edit" value={type} onChange={(e) => update(idx, { type: e.target.value as SocialPost["type"] })}>
                        {TYPES.map((t) => <option key={t.id} value={t.id}>{tLabel(t.id)}</option>)}
                      </select>
                      <input className="ms-edit" value={p.platform} placeholder={ui("Platform", "المنصة")} onChange={(e) => update(idx, { platform: e.target.value })} />
                      <select className="ms-edit" value={stageOf(p)} onChange={(e) => { const stage = e.target.value as ContentStage; update(idx, { stage, status: statusFromStage(stage) }); }}>
                        {STAGES.map((s) => <option key={s.id} value={s.id}>{ui(s.en, s.ar)}</option>)}
                      </select>
                      <button type="button" className="ms-cal-del" onClick={() => remove(idx)} aria-label="Remove">✕</button>
                    </div>
                    {p.mediaUrl && <div style={{ marginTop: 8 }}><Thumb url={p.mediaUrl} kind={p.mediaKind} /></div>}
                    <input className="ms-edit ms-cal-entry__title" value={p.title} placeholder={ui("Title / hook…", "العنوان / الخطّاف…")} onChange={(e) => update(idx, { title: e.target.value })} />
                    {onNeedsShoot && (
                      <button type="button" onClick={() => onNeedsShoot(idx)} className={`ms-cal-needshoot ${p.fromShot ? "is-on" : ""}`}>
                        {p.fromShot ? `✓ ${ui("In shoot list", "في قائمة التصوير")}` : `📷 ${ui("Needs shoot", "يحتاج تصوير")}`}
                      </button>
                    )}
                    <label className="ms-cal-brief">
                      <span className="ms-cal-brief__label">{typeMeta(type).icon} {briefLabel(type)}</span>
                      <textarea className="ms-edit ms-cal-brief__area" rows={type === "reel" ? 5 : 3} value={p.brief || ""} placeholder={briefPlaceholder(type)} dir="auto" onChange={(e) => update(idx, { brief: e.target.value })} />
                    </label>
                    <div className="ms-cal-rich">
                      <input className="ms-edit" value={p.hook || ""} placeholder={ui("Hook", "الخطّاف")} onChange={(e) => update(idx, { hook: e.target.value })} />
                      <textarea className="ms-edit" rows={2} value={p.caption || ""} placeholder={ui("Caption", "التعليق")} dir="auto" onChange={(e) => update(idx, { caption: e.target.value })} />
                      <input className="ms-edit" value={p.hashtags || ""} placeholder={ui("Hashtags", "الهاشتاغات")} onChange={(e) => update(idx, { hashtags: e.target.value })} />
                      <input className="ms-edit" value={p.cta || ""} placeholder={ui("Call to action", "دعوة لإجراء")} onChange={(e) => update(idx, { cta: e.target.value })} />
                    </div>
                  </div>
                );
              }
              const isOpen = open === idx;
              const comments = p.comments ?? [];
              const expandable = !!p.brief || !!p.caption || !!feedback || comments.length > 0;
              const toggle = () => {
                const nextOpen = isOpen ? null : idx;
                setOpen(nextOpen);
                if (nextOpen !== idx) setDraft("");
              };
              return (
                <div key={idx} className={`ms-cal-entry ms-cal-entry--${type} ${isOpen ? "is-open" : ""}`}>
                  <button type="button" className="ms-cal-entry__row" onClick={toggle}>
                    {p.mediaUrl && <Thumb url={p.mediaUrl} kind={p.mediaKind} />}
                    <span className={`lq-chip ms-cal-type-pill ms-cal-type-pill--${type}`}>{typeMeta(type).icon} {tLabel(type)}</span>
                    {p.platform && <span className="ms-cal-entry__plat">{p.platform}</span>}
                    <span className="ms-cal-entry__ttl">{p.title || briefLabel(type)}</span>
                    {p.approval && p.approval !== "pending" && (
                      <span className={`lq-chip ${APPROVAL_PILL[p.approval] || ""}`}>{approvalLabel(p.approval)}</span>
                    )}
                    <span className={`lq-chip ${p.status === "posted" ? "lq-chip--green" : p.status === "scheduled" ? "lq-chip--blue" : ""}`}>
                      {p.status === "posted" ? ui("Posted", "نُشر") : p.status === "scheduled" ? ui("Scheduled", "مجدول") : ui("Planned", "مخطّط")}
                    </span>
                    {expandable && <span className="ms-cal-entry__chev" aria-hidden>{isOpen ? "−" : "+"}</span>}
                  </button>
                  {isOpen && (
                    <div className="ms-cal-entry__brief">
                      {p.brief && (
                        <>
                          <span className="ms-cal-brief__label">{briefLabel(type)}</span>
                          <p dir="auto">{p.brief}</p>
                        </>
                      )}
                      {p.caption && (
                        <>
                          <span className="ms-cal-brief__label">{ui("Caption", "التعليق")}</span>
                          <p dir="auto">{p.caption}</p>
                        </>
                      )}

                      {feedback && (
                        <div className="ms-cal-approve">
                          <span className="ms-cal-brief__label">{ui("Your sign-off", "موافقتك")}</span>
                          <div className="ms-cal-approve__row">
                            <span className={`lq-chip ${APPROVAL_PILL[p.approval || "pending"] || ""}`}>{approvalLabel(p.approval)}</span>
                            <button
                              type="button"
                              className="lq-btn lq-btn--primary lq-btn--sm"
                              disabled={feedback.busy === idx || p.approval === "approved"}
                              onClick={() => feedback.onApprove(idx, "approved")}
                            >
                              {ui("Approve", "موافقة")}
                            </button>
                            <button
                              type="button"
                              className="lq-btn lq-btn--glass lq-btn--sm"
                              disabled={feedback.busy === idx || p.approval === "changes"}
                              onClick={() => feedback.onApprove(idx, "changes")}
                            >
                              {ui("Request changes", "طلب تعديل")}
                            </button>
                          </div>
                        </div>
                      )}

                      {(comments.length > 0 || feedback) && (
                        <div className="ms-cal-thread">
                          <span className="ms-cal-brief__label">{ui("Comments", "التعليقات")}</span>
                          {comments.map((c, ci) => (
                            <div key={ci} className={`ms-cal-comment ms-cal-comment--${c.role}`}>
                              <b>{c.by}</b>
                              <p dir="auto">{c.text}</p>
                            </div>
                          ))}
                          {comments.length === 0 && <p className="text-charcoal-60" style={{ fontSize: 13 }}>{ui("No comments yet.", "لا تعليقات بعد.")}</p>}
                          {feedback && (
                            <div className="ms-cal-comment-form">
                              <textarea
                                className="lq-input"
                                rows={2}
                                value={draft}
                                placeholder={ui("Add a comment…", "أضف تعليقاً…")}
                                dir="auto"
                                onChange={(e) => setDraft(e.target.value)}
                              />
                              <button
                                type="button"
                                className="lq-btn lq-btn--primary lq-btn--sm"
                                disabled={feedback.busy === idx || !draft.trim()}
                                onClick={() => { feedback.onComment(idx, draft.trim()); setDraft(""); }}
                              >
                                {ui("Send", "إرسال")}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
