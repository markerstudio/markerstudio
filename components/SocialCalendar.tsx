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
  const addOn = (date: string) => onChange?.([...posts, { date, platform: "", title: "", notes: "", status: "planned" }]);

  const selEntries = sel ? byDate[sel] ?? [] : [];

  return (
    <div className="ms-cal">
      <div className="ms-cal-head">
        <strong>{MONTHS[lang][m]} {y}</strong>
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
                <span key={k} className={`ms-cal-post ${STATUS_CLASS[p.status] || ""}`} title={`${p.platform} · ${p.title}`}>
                  {p.title || p.platform || ui("Post", "منشور")}
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
            {editable && <button type="button" className="ms-cal-add" onClick={() => addOn(sel)}>+ {ui("Add post", "أضف منشوراً")}</button>}
          </div>
          {selEntries.length === 0 && <p className="ms-pmuted" style={{ margin: "8px 0 0" }}>{ui("No posts on this day.", "لا منشورات في هذا اليوم.")}</p>}
          {selEntries.map(({ p, idx }) => (
            <div key={idx} className="ms-cal-row">
              {editable ? (
                <>
                  <input className="ms-edit" style={{ width: 120 }} value={p.platform} placeholder={ui("Platform", "المنصة")} onChange={(e) => update(idx, { platform: e.target.value })} />
                  <input className="ms-edit" style={{ flex: 1, minWidth: 140 }} value={p.title} placeholder={ui("What's the post?", "ما المنشور؟")} onChange={(e) => update(idx, { title: e.target.value })} />
                  <select className="ms-edit" style={{ width: 120 }} value={p.status} onChange={(e) => update(idx, { status: e.target.value as SocialPost["status"] })}>
                    <option value="planned">{ui("Planned", "مخطّط")}</option>
                    <option value="scheduled">{ui("Scheduled", "مجدول")}</option>
                    <option value="posted">{ui("Posted", "نُشر")}</option>
                  </select>
                  <button type="button" className="ms-cal-del" onClick={() => remove(idx)} aria-label="Remove">✕</button>
                </>
              ) : (
                <>
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
