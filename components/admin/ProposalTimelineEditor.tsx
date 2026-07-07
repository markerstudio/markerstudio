"use client";

import { useState } from "react";
import { saveProposalTimeline } from "@/app/admin/actions";
import type { TimelinePhase } from "@/lib/clients";

const field = "lq-input";

// Ordered phases shown on the client's proposal as a vertical timeline.
export default function ProposalTimelineEditor({ slug, initial }: { slug: string; initial: TimelinePhase[] }) {
  const [rows, setRows] = useState<TimelinePhase[]>(initial.length ? initial : [{ phase: "", duration: "", detail: "" }]);

  const update = (i: number, key: keyof TimelinePhase, value: string) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  const addRow = () => setRows((prev) => [...prev, { phase: "", duration: "", detail: "" }]);
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) =>
    setRows((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const cleaned = rows.filter((r) => r.phase.trim() || (r.detail || "").trim());

  return (
    <form action={saveProposalTimeline} className="lq-card p-5 mb-4">
      <div className="mb-1 font-display font-bold text-[15px] tracking-tight text-ink">Timeline</div>
      <p className="text-xs text-charcoal-60 mb-3">Ordered phases shown on the proposal as a vertical timeline. Leave empty to hide it.</p>

      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="timeline" value={JSON.stringify(cleaned)} />

      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={i} className="lq-well p-3 relative">
            <div className="absolute top-2 end-2 flex items-center gap-1.5 text-xs">
              <button type="button" onClick={() => move(i, -1)} className="lq-press text-charcoal-40 hover:text-charcoal-80" aria-label="Move up">↑</button>
              <button type="button" onClick={() => move(i, 1)} className="lq-press text-charcoal-40 hover:text-charcoal-80" aria-label="Move down">↓</button>
              <button type="button" onClick={() => removeRow(i)} className="font-medium text-charcoal-40 hover:text-rose-600">Remove</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_140px] gap-2 pe-20">
              <input className={field} placeholder="Phase — e.g. Discovery" value={r.phase} onChange={(e) => update(i, "phase", e.target.value)} />
              <input className={field} placeholder="Duration — Week 1" value={r.duration || ""} onChange={(e) => update(i, "duration", e.target.value)} />
            </div>
            <input className={`${field} mt-2 w-full`} placeholder="What happens in this phase…" value={r.detail || ""} onChange={(e) => update(i, "detail", e.target.value)} />
          </div>
        ))}
      </div>

      <button type="button" onClick={addRow} className="mt-2 text-sm font-medium text-charcoal-60 hover:text-orange-deep">+ Add phase</button>

      <div>
        <button className="lq-btn lq-btn--primary lq-btn--sm mt-3">Save timeline</button>
      </div>
    </form>
  );
}
