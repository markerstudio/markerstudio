"use client";

import { saveSection } from "@/app/admin/clients/section-actions";
import { Text, Bi, SaveButton } from "./fields";
import PlanShootsEditor from "./PlanShootsEditor";
import type { ClientData } from "@/lib/clients";

// Mirrors the portal's Plan tab. The plan block saves with this tab's button; the
// photography block saves on its own (PlanShootsEditor → its own jsonb_set key),
// so a photographer's shoot edits and the plan copy never fight over one save.
export default function PlanShootsTab({ slug, data, patch }: { slug: string; data: ClientData; patch: (p: Partial<ClientData>) => void }) {
  return (
    <div className="space-y-6">
      <fieldset className="bg-white border border-neutral-200 rounded-xl p-6">
        <legend className="px-2 -ml-2 font-bold">The plan</legend>
        <div className="flex items-center justify-end mb-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="custom-checkbox" checked={data.plan.active} onChange={(e) => patch({ plan: { ...data.plan, active: e.target.checked } })} /> Active
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 mb-4">
          <Text label="Plan name" value={data.plan.name} onChange={(name) => patch({ plan: { ...data.plan, name } })} placeholder="Monthly social media management" />
          <Text label="Notion / plan link (optional)" value={data.plan.notionUrl ?? ""} onChange={(notionUrl) => patch({ plan: { ...data.plan, notionUrl } })} placeholder="https://notion.so/…" />
          <Text label="Start" value={data.plan.start} onChange={(start) => patch({ plan: { ...data.plan, start } })} placeholder="Feb 26" />
          <Text label="End" value={data.plan.end} onChange={(end) => patch({ plan: { ...data.plan, end } })} placeholder="May 26 (blank = ongoing)" />
        </div>
        <Bi label="Plan note" value={data.plan.note} onChange={(note) => patch({ plan: { ...data.plan, note } })} area />
        <SaveButton onSave={() => saveSection(slug, { plan: data.plan })} label="Save plan" />
      </fieldset>

      <fieldset className="bg-white border border-neutral-200 rounded-xl p-6">
        <legend className="px-2 -ml-2 font-bold">Photography (shoots)</legend>
        <p className="text-xs text-neutral-400 mb-3">The shoot schedule and shot list shared with the photographer portal. Saves on its own button below.</p>
        <PlanShootsEditor slug={slug} initialPhoto={data.photo} />
      </fieldset>
    </div>
  );
}
