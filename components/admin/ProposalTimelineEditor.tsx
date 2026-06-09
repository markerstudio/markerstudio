"use client";

import { useState } from "react";
import { saveProposalTimeline } from "@/app/admin/actions";
import type { TimelinePhase } from "@/lib/clients";

const field =
  "rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange/40 focus:border-orange";

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
    <form action={saveProposalTimeline} className="border border-neutral-200 rounded-lg p-4 mb-4">
      <div className="mb-1 font-semibold text-sm">Timeline</div>
      <p className="text-xs text-neutral-400 mb-3">Ordered phases shown on the proposal as a vertical timeline. Leave empty to hide it.</p>

      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="timeline" value={JSON.stringify(cleaned)} />

      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={i} className="rounded-lg border border-neutral-200 p-3 relative">
            <div className="absolute top-2 right-2 flex items-center gap-1.5 text-xs">
              <button type="button" onClick={() => move(i, -1)} className="text-neutral-300 hover:text-neutral-700" aria-label="Move up">↑</button>
              <button type="button" onClick={() => move(i, 1)} className="text-neutral-300 hover:text-neutral-700" aria-label="Move down">↓</button>
              <button type="button" onClick={() => removeRow(i)} className="font-medium text-neutral-400 hover:text-red-600">Remove</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_140px] gap-2 pr-20">
              <input className={field} placeholder="Phase — e.g. Discovery" value={r.phase} onChange={(e) => update(i, "phase", e.target.value)} />
              <input className={field} placeholder="Duration — Week 1" value={r.duration || ""} onChange={(e) => update(i, "duration", e.target.value)} />
            </div>
            <input className={`${field} mt-2 w-full`} placeholder="What happens in this phase…" value={r.detail || ""} onChange={(e) => update(i, "detail", e.target.value)} />
          </div>
        ))}
      </div>

      <button type="button" onClick={addRow} className="mt-2 text-sm font-medium text-neutral-600 hover:text-orange">+ Add phase</button>

      <div>
        <button className="mt-3 bg-orange text-white font-semibold rounded-md px-4 py-2 text-sm hover:bg-orange-deep transition-colors">Save timeline</button>
      </div>
    </form>
  );
}
