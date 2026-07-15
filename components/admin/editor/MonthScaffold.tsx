"use client";

import { useMemo, useState } from "react";
import type { SocialPost, SocialContentType } from "@/lib/clients";

// "Plan month" — turn a weekly rhythm (posts Mon/Wed/Fri, 2 reels a week,
// daily stories…) into a month of placeholder slots in one click. Slots land
// as stage "idea" with an empty title, ready to be filled in the Planner view
// or by AI fill; days that already have that content type are skipped, so
// re-running never duplicates.

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

type RhythmType = Exclude<SocialContentType, "story">;
const RHYTHM_TYPES: { id: RhythmType; label: string; icon: string }[] = [
  { id: "post", label: "Posts", icon: "▦" },
  { id: "reel", label: "Reels", icon: "►" },
  { id: "carousel", label: "Carousels", icon: "▤" },
];

function layoutMonth(
  existing: SocialPost[],
  y: number,
  m: number,
  days: Record<RhythmType, number[]>,
  stories: boolean,
  platform: string
): SocialPost[] {
  const total = new Date(y, m + 1, 0).getDate();
  const taken = new Set(existing.filter((p) => p.date).map((p) => `${p.date}|${p.type || "post"}`));
  const out: SocialPost[] = [];
  for (let d = 1; d <= total; d++) {
    const date = fmt(y, m, d);
    const wd = new Date(y, m, d).getDay();
    for (const t of RHYTHM_TYPES) {
      if (days[t.id].includes(wd) && !taken.has(`${date}|${t.id}`)) {
        out.push({ date, platform, title: "", notes: "", status: "planned", stage: "idea", type: t.id, brief: "" });
      }
    }
    if (stories && !taken.has(`${date}|story`)) {
      out.push({ date, platform: "", title: "", notes: "", status: "planned", stage: "idea", type: "story", brief: "" });
    }
  }
  return out;
}

export default function MonthScaffold({ posts, onAdd }: { posts: SocialPost[]; onAdd: (slots: SocialPost[]) => void }) {
  const now = new Date();
  const [y, setY] = useState(now.getFullYear());
  const [m, setM] = useState(now.getMonth());
  const [days, setDays] = useState<Record<RhythmType, number[]>>({ post: [1, 3], reel: [5], carousel: [] });
  const [stories, setStories] = useState(true);
  const [platform, setPlatform] = useState("Instagram");
  const [added, setAdded] = useState(0);

  const toggle = (t: RhythmType, wd: number) =>
    setDays((cur) => ({ ...cur, [t]: cur[t].includes(wd) ? cur[t].filter((x) => x !== wd) : [...cur[t], wd] }));
  const prev = () => { setAdded(0); if (m === 0) { setY(y - 1); setM(11); } else setM(m - 1); };
  const next = () => { setAdded(0); if (m === 11) { setY(y + 1); setM(0); } else setM(m + 1); };

  const slots = useMemo(() => layoutMonth(posts, y, m, days, stories, platform.trim()), [posts, y, m, days, stories, platform]);
  const countOf = (t: string) => slots.filter((p) => p.type === t).length;
  const summary = [
    ...RHYTHM_TYPES.map((t) => (countOf(t.id) ? `${countOf(t.id)} ${t.label.toLowerCase()}` : "")),
    countOf("story") ? `${countOf("story")} stories` : "",
  ].filter(Boolean).join(" · ");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={prev} className="lq-btn lq-btn--glass lq-btn--sm lq-press !px-3 text-[16px]" aria-label="Previous month">‹</button>
        <b className="font-display font-bold text-[15px] tracking-tight text-ink min-w-[130px] text-center">{MONTHS[m]} {y}</b>
        <button type="button" onClick={next} className="lq-btn lq-btn--glass lq-btn--sm lq-press !px-3 text-[16px]" aria-label="Next month">›</button>
      </div>

      {RHYTHM_TYPES.map((t) => (
        <div key={t.id} className="ms-scaffold-row">
          <b>{t.icon} {t.label}</b>
          <span className="ms-scaffold-days">
            {WD.map((w, wd) => (
              <button key={wd} type="button" className={`ms-scaffold-day ${days[t.id].includes(wd) ? "is-on" : ""}`} onClick={() => { toggle(t.id, wd); setAdded(0); }}>
                {w}
              </button>
            ))}
          </span>
        </div>
      ))}

      <div className="ms-scaffold-row">
        <b>◍ Stories</b>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="custom-checkbox" checked={stories} onChange={(e) => { setStories(e.target.checked); setAdded(0); }} />
          Daily stories — one light slot every day
        </label>
      </div>

      <div className="ms-scaffold-row">
        <b>Platform</b>
        <input className="lq-input !w-44" value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="Instagram" />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          className="lq-btn lq-btn--primary lq-btn--sm"
          disabled={slots.length === 0}
          onClick={() => { onAdd(slots); setAdded(slots.length); }}
        >
          Lay out {MONTHS[m]}
        </button>
        {added > 0 ? (
          <span className="text-sm text-emerald-800">Added {added} slots ✓ — fill titles in the Planner, or let AI fill do it.</span>
        ) : (
          <span className="text-sm text-charcoal-60">{slots.length ? `Will add ${summary} (days already planned are skipped).` : "Pick at least one day or turn on stories."}</span>
        )}
      </div>
    </div>
  );
}
