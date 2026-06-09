"use client";

import { useState } from "react";
import type { SocialPost } from "@/lib/clients";

const WD = {
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  ar: ["أحد", "إثن", "ثلا", "أرب", "خمي", "جمع", "سبت"],
};
const MONTHS = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  ar: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
};
const STATUS_CLASS: Record<string, string> = { posted: "ms-cal-post--posted", scheduled: "ms-cal-post--scheduled", planned: "ms-cal-post--planned" };
// Content type drives the glyph + the label of the long brief field. Stories get
// the spotlight since "daily stories" is a plan deliverable we track day-by-day.
const TYPES: { id: "post" | "story" | "reel"; en: string; ar: string; icon: string }[] = [
  { id: "post", en: "Post", ar: "منشور", icon: "▦" },
  { id: "story", en: "Story", ar: "ستوري", icon: "◍" },
  { id: "reel", en: "Reel", ar: "ريل", icon: "►" },
];
const typeMeta = (t?: string) => TYPES.find((x) => x.id === t) ?? TYPES[0];
const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

export default function SocialCalendar({
  posts,
  onChange,
  editable = false,
  lang = "en",
}: {
  posts: SocialPost[];
  onChange?: (posts: SocialPost[]) => void;
  editable?: boolean;
  lang?: "en" | "ar";
}) {
  const ui = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const tLabel = (t?: string) => ui(typeMeta(t).en, typeMeta(t).ar);
  // The long, type-aware brief: post details / reel script / stories direction.
  const briefLabel = (t?: string) =>
    t === "reel" ? ui("Reel script", "سكربت الريل") : t === "story" ? ui("Stories direction", "إخراج الستوري") : ui("Post details", "تفاصيل المنشور");
  const briefPlaceholder = (t?: string) =>
    t === "reel"
      ? ui("Hook, scene-by-scene script, captions, audio…", "الخطّاف، السكربت مشهداً بمشهد، التعليقات، الصوت…")
      : t === "story"
      ? ui("Frame-by-frame direction — polls, stickers, CTA…", "إخراج إطاراً بإطار — تصويتات، ملصقات، دعوة لإجراء…")
      : ui("Caption, key message, visual direction…", "التعليق، الرسالة الأساسية، التوجيه البصري…");

  const first = posts.find((p) => p.date)?.date;
  const init = first ? new Date(first + "T00:00:00") : new Date();
  const [y, setY] = useState(init.getFullYear());
  const [m, setM] = useState(init.getMonth());
  const [sel, setSel] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null); // expanded entry (view mode)

  const now = new Date();
  const todayStr = fmt(now.getFullYear(), now.getMonth(), now.getDate());
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const firstWeekday = new Date(y, m, 1).getDay();
  const byDate: Record<string, { p: SocialPost; idx: number }[]> = {};
  posts.forEach((p, idx) => {
    if (!p.date) return;
    (byDate[p.date] ||= []).push({ p, idx });
  });

  const prev = () => { if (m === 0) { setY(y - 1); setM(11); } else setM(m - 1); };
  const next = () => { if (m === 11) { setY(y + 1); setM(0); } else setM(m + 1); };

  const update = (idx: number, patch: Partial<SocialPost>) => onChange?.(posts.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  const remove = (idx: number) => onChange?.(posts.filter((_, i) => i !== idx));
  const addOn = (date: string, type: SocialPost["type"] = "post") =>
    onChange?.([...posts, { date, platform: "", title: "", notes: "", status: "planned", type, brief: "" }]);

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

  return (
    <div className="ms-cal">
      <div className="ms-cal-head">
        <div className="ms-cal-headline">
          <strong>{MONTHS[lang][m]} {y}</strong>
          <div className="ms-cal-summary">
            {TYPES.map((t) => (
              <span key={t.id} className={`ms-cal-key ms-cal-key--${t.id}`}><i>{t.icon}</i>{countOf(t.id)} {tLabel(t.id)}</span>
            ))}
            <span className="ms-cal-key ms-cal-key--count">{ui("Story days", "أيام الستوري")} {storyDays}/{daysInMonth}</span>
          </div>
        </div>
        <div className="ms-cal-nav">
          <button type="button" onClick={prev} aria-label="Previous month">‹</button>
          <button type="button" onClick={() => { setY(now.getFullYear()); setM(now.getMonth()); }} className="ms-cal-today" aria-label="Today">{ui("Today", "اليوم")}</button>
          <button type="button" onClick={next} aria-label="Next month">›</button>
        </div>
      </div>

      <div className="ms-cal-grid">
        {WD[lang].map((w) => <div key={w} className="ms-cal-wd">{w}</div>)}
        {Array.from({ length: firstWeekday }).map((_, i) => <div key={`b${i}`} className="ms-cal-day is-other" />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const d = i + 1;
          const date = fmt(y, m, d);
          const dayPosts = byDate[date] ?? [];
          return (
            <div
              key={date}
              className={`ms-cal-day ${sel === date ? "is-selected" : ""} ${date === todayStr ? "is-today" : ""} ${dayPosts.length ? "has-posts" : ""}`}
              onClick={() => { setSel(date); setOpen(null); }}
              role="button"
              tabIndex={0}
            >
              <span className="ms-cal-num">{d}</span>
              {dayPosts.slice(0, 3).map(({ p }, k) => (
                <span key={k} className={`ms-cal-post ms-cal-post--${p.type || "post"} ${STATUS_CLASS[p.status] || ""}`} title={`${tLabel(p.type)} · ${p.platform} · ${p.title}`}>
                  <i className="ms-cal-post__type" aria-hidden>{typeMeta(p.type).icon}</i>
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
        <div className="ms-cal-panel">
          <div className="ms-cal-panel__head">
            <b>{prettyDay(sel)}</b>
            {editable && (
              <span className="ms-cal-add-group">
                {TYPES.map((t) => (
                  <button key={t.id} type="button" className={`ms-cal-add ms-cal-add--${t.id}`} onClick={() => addOn(sel, t.id)}>+ {tLabel(t.id)}</button>
                ))}
              </span>
            )}
          </div>

          {selEntries.length === 0 && <p className="ms-pmuted" style={{ margin: "8px 0 0" }}>{ui("Nothing planned for this day yet.", "لا شيء مخطّط لهذا اليوم بعد.")}</p>}

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
                      <select className="ms-edit" value={p.status} onChange={(e) => update(idx, { status: e.target.value as SocialPost["status"] })}>
                        <option value="planned">{ui("Planned", "مخطّط")}</option>
                        <option value="scheduled">{ui("Scheduled", "مجدول")}</option>
                        <option value="posted">{ui("Posted", "نُشر")}</option>
                      </select>
                      <button type="button" className="ms-cal-del" onClick={() => remove(idx)} aria-label="Remove">✕</button>
                    </div>
                    <input className="ms-edit ms-cal-entry__title" value={p.title} placeholder={ui("Title / hook…", "العنوان / الخطّاف…")} onChange={(e) => update(idx, { title: e.target.value })} />
                    <label className="ms-cal-brief">
                      <span className="ms-cal-brief__label">{typeMeta(type).icon} {briefLabel(type)}</span>
                      <textarea className="ms-edit ms-cal-brief__area" rows={type === "reel" ? 5 : 3} value={p.brief || ""} placeholder={briefPlaceholder(type)} dir="auto" onChange={(e) => update(idx, { brief: e.target.value })} />
                    </label>
                  </div>
                );
              }
              const isOpen = open === idx;
              return (
                <div key={idx} className={`ms-cal-entry ms-cal-entry--${type} ${isOpen ? "is-open" : ""}`}>
                  <button type="button" className="ms-cal-entry__row" onClick={() => setOpen(isOpen ? null : idx)}>
                    <span className={`ms-portal-pill ms-cal-type-pill ms-cal-type-pill--${type}`}>{typeMeta(type).icon} {tLabel(type)}</span>
                    {p.platform && <span className="ms-cal-entry__plat">{p.platform}</span>}
                    <span className="ms-cal-entry__ttl">{p.title || briefLabel(type)}</span>
                    <span className={`ms-portal-pill ${p.status === "posted" ? "ms-portal-pill--green" : p.status === "scheduled" ? "ms-portal-pill--blue" : ""}`}>
                      {p.status === "posted" ? ui("Posted", "نُشر") : p.status === "scheduled" ? ui("Scheduled", "مجدول") : ui("Planned", "مخطّط")}
                    </span>
                    {p.brief && <span className="ms-cal-entry__chev" aria-hidden>{isOpen ? "−" : "+"}</span>}
                  </button>
                  {isOpen && p.brief && (
                    <div className="ms-cal-entry__brief">
                      <span className="ms-cal-brief__label">{briefLabel(type)}</span>
                      <p dir="auto">{p.brief}</p>
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
