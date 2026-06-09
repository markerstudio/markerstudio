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
// Content type drives the small glyph on each calendar entry. Stories get the
// spotlight since "daily stories" is a plan deliverable we track day-by-day.
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
  const first = posts.find((p) => p.date)?.date;
  const init = first ? new Date(first + "T00:00:00") : new Date();
  const [y, setY] = useState(init.getFullYear());
  const [m, setM] = useState(init.getMonth());
  const [sel, setSel] = useState<string | null>(null);

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
  const addOn = (date: string, type: SocialPost["type"] = "post") => onChange?.([...posts, { date, platform: "", title: "", notes: "", status: "planned", type }]);
  // Count the days this month that already have a story — a quick read on the
  // "daily stories" cadence.
  const storyDays = new Set(posts.filter((p) => p.type === "story" && p.date?.startsWith(`${y}-${pad(m + 1)}`)).map((p) => p.date)).size;

  const selEntries = sel ? byDate[sel] ?? [] : [];

  return (
    <div className="ms-cal">
      <div className="ms-cal-head">
        <strong>{MONTHS[lang][m]} {y}</strong>
        <div className="ms-cal-legend" aria-hidden>
          {TYPES.map((t) => (
            <span key={t.id} className={`ms-cal-key ms-cal-key--${t.id}`}><i>{t.icon}</i>{ui(t.en, t.ar)}</span>
          ))}
          <span className="ms-cal-key ms-cal-key--count">{ui("Story days", "أيام الستوري")}: {storyDays}/{daysInMonth}</span>
        </div>
        <div className="ms-cal-nav">
          <button type="button" onClick={prev} aria-label="Previous month">‹</button>
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
              className={`ms-cal-day ${sel === date ? "is-selected" : ""}`}
              onClick={() => setSel(date)}
              role="button"
              tabIndex={0}
            >
              <span className="ms-cal-num">{d}</span>
              {dayPosts.slice(0, 3).map(({ p }, k) => (
                <span key={k} className={`ms-cal-post ms-cal-post--${p.type || "post"} ${STATUS_CLASS[p.status] || ""}`} title={`${typeMeta(p.type)[lang === "ar" ? "ar" : "en"]} · ${p.platform} · ${p.title}`}>
                  <i className="ms-cal-post__type" aria-hidden>{typeMeta(p.type).icon}</i>
                  {p.title || p.platform || typeMeta(p.type)[lang === "ar" ? "ar" : "en"]}
                </span>
              ))}
              {dayPosts.length > 3 && <span className="ms-cal-more">+{dayPosts.length - 3}</span>}
            </div>
          );
        })}
      </div>

      {/* Selected-day panel */}
      {sel && (
        <div className="ms-cal-panel">
          <div className="ms-cal-panel__head">
            <b>{sel}</b>
            {editable && (
              <span className="ms-cal-add-group">
                <button type="button" className="ms-cal-add" onClick={() => addOn(sel, "post")}>+ {ui("Post", "منشور")}</button>
                <button type="button" className="ms-cal-add" onClick={() => addOn(sel, "story")}>+ {ui("Story", "ستوري")}</button>
                <button type="button" className="ms-cal-add" onClick={() => addOn(sel, "reel")}>+ {ui("Reel", "ريل")}</button>
              </span>
            )}
          </div>
          {selEntries.length === 0 && <p className="ms-pmuted" style={{ margin: "8px 0 0" }}>{ui("No posts on this day.", "لا منشورات في هذا اليوم.")}</p>}
          {selEntries.map(({ p, idx }) => (
            <div key={idx} className="ms-cal-row">
              {editable ? (
                <>
                  <select className="ms-edit" style={{ width: 96 }} value={p.type || "post"} onChange={(e) => update(idx, { type: e.target.value as SocialPost["type"] })}>
                    {TYPES.map((t) => <option key={t.id} value={t.id}>{ui(t.en, t.ar)}</option>)}
                  </select>
                  <input className="ms-edit" style={{ width: 110 }} value={p.platform} placeholder={ui("Platform", "المنصة")} onChange={(e) => update(idx, { platform: e.target.value })} />
                  <input className="ms-edit" style={{ flex: 1, minWidth: 130 }} value={p.title} placeholder={ui("What's the post?", "ما المنشور؟")} onChange={(e) => update(idx, { title: e.target.value })} />
                  <select className="ms-edit" style={{ width: 110 }} value={p.status} onChange={(e) => update(idx, { status: e.target.value as SocialPost["status"] })}>
                    <option value="planned">{ui("Planned", "مخطّط")}</option>
                    <option value="scheduled">{ui("Scheduled", "مجدول")}</option>
                    <option value="posted">{ui("Posted", "نُشر")}</option>
                  </select>
                  <button type="button" className="ms-cal-del" onClick={() => remove(idx)} aria-label="Remove">✕</button>
                </>
              ) : (
                <>
                  <span className={`ms-portal-pill ms-cal-type-pill ms-cal-type-pill--${p.type || "post"}`}>{typeMeta(p.type).icon} {ui(typeMeta(p.type).en, typeMeta(p.type).ar)}</span>
                  <span className={`ms-portal-pill ${p.status === "posted" ? "ms-portal-pill--green" : p.status === "scheduled" ? "ms-portal-pill--blue" : ""}`}>{p.platform || ui("Post", "منشور")}</span>
                  <span style={{ flex: 1 }}>{p.title}</span>
                  <span className="ms-pmuted" style={{ fontSize: 12 }}>{p.status === "posted" ? ui("Posted", "نُشر") : p.status === "scheduled" ? ui("Scheduled", "مجدول") : ui("Planned", "مخطّط")}</span>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
