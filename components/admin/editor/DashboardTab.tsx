"use client";

import { useState } from "react";
import { saveSection } from "@/app/admin/clients/section-actions";
import { input, lbl, Text, Bi, Rows, coerceLT } from "./fields";
import { useSectionAutosave, SyncPill } from "./useSectionAutosave";
import type { ClientData, StoryCard, Vital } from "@/lib/clients";

// Mirrors the client portal's Dashboard tab: the hero line + the auto quick-view's
// headline, diagnosis, story cards and health bars. Saves only hero/accent/dashboard.
export default function DashboardTab({ slug, data, patch }: { slug: string; data: ClientData; patch: (p: Partial<ClientData>) => void }) {
  const [portalJson, setPortalJson] = useState("");
  const [portalMsg, setPortalMsg] = useState("");

  const sync = useSectionAutosave({
    slug,
    section: "dashboard",
    payload: { hero: data.hero, accent: data.accent, dashboard: data.dashboard },
    save: (p) => saveSection(slug, p),
    onRestore: (d) => patch(d),
  });

  // Take the JSON the onboarding "Copy AI prompt" produces and merge the hero +
  // dashboard fields it understands. Tolerant of code fences and string/{en,ar}.
  function applyPortalJson() {
    let obj: Record<string, unknown>;
    try {
      const raw = portalJson.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
      obj = JSON.parse(raw);
    } catch {
      setPortalMsg("Couldn't read that — paste the JSON object the AI returned (it should start with “{”).");
      return;
    }
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
      setPortalMsg("That isn't a JSON object — paste the { … } the AI returned.");
      return;
    }
    const filled: string[] = [];
    const next: Partial<ClientData> = { dashboard: { ...data.dashboard } };
    if (typeof obj.accent === "string" && obj.accent.trim()) { next.accent = obj.accent.trim(); filled.push("watermark"); }
    const hero = coerceLT(obj.hero);
    if (hero) { next.hero = hero; filled.push("hero"); }
    const dash = obj.dashboard;
    if (dash && typeof dash === "object" && !Array.isArray(dash)) {
      const d = dash as Record<string, unknown>;
      const headline = coerceLT(d.headline);
      if (headline) { next.dashboard!.headline = headline; filled.push("dashboard headline"); }
      const diagnosis = coerceLT(d.diagnosis);
      if (diagnosis) { next.dashboard!.diagnosis = diagnosis; filled.push("diagnosis"); }
      if (Array.isArray(d.cards)) {
        const cards: StoryCard[] = d.cards
          .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
          .map((c) => ({ tag: String(c.tag ?? ""), value: String(c.value ?? ""), desc: String(c.desc ?? "") }))
          .filter((c) => c.tag || c.value || c.desc);
        if (cards.length) { next.dashboard!.cards = cards; filled.push(`${cards.length} story card${cards.length > 1 ? "s" : ""}`); }
      }
    }
    if (!filled.length) { setPortalMsg("Parsed OK, but found no portal fields — expected accent / hero / dashboard."); return; }
    patch(next);
    setPortalMsg(`Filled ${filled.join(", ")} ✓ — review below; changes save automatically.`);
    setPortalJson("");
  }

  return (
    <div className="space-y-6">
      <fieldset className="lq-card p-5">
        <legend className="px-2 -ms-2 font-display font-bold text-[16px] tracking-tight text-ink">Hero</legend>
        <Bi label="Intro line" value={data.hero} onChange={(hero) => patch({ hero })} area />
        <Text label="Watermark word (optional)" value={data.accent ?? ""} onChange={(accent) => patch({ accent })} placeholder="JACK" />
      </fieldset>

      <fieldset className="lq-card p-5">
        <legend className="px-2 -ms-2 font-display font-bold text-[16px] tracking-tight text-ink">Dashboard</legend>
        <p className="text-xs text-charcoal-40 mb-3">Leave this empty and the client&apos;s dashboard builds itself from live data — posts planned/posted this month, story days, next shoot, task progress. Anything you author here replaces the auto view.</p>
        <Bi label="Headline" value={data.dashboard.headline} onChange={(headline) => patch({ dashboard: { ...data.dashboard, headline } })} />
        <Bi label="Diagnosis (optional)" value={data.dashboard.diagnosis} onChange={(diagnosis) => patch({ dashboard: { ...data.dashboard, diagnosis } })} area />
        <label className={`${lbl} mt-2`}>Story cards (optional)</label>
        <Rows<StoryCard> items={data.dashboard.cards} onChange={(cards) => patch({ dashboard: { ...data.dashboard, cards } })} blank={{ tag: "", value: "", desc: "" }} addLabel="Add card"
          render={(c, set) => (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pr-16">
              <Text label="Tag" value={c.tag} onChange={(tag) => set({ tag })} placeholder="Reach" />
              <Text label="Value" value={c.value} onChange={(value) => set({ value })} placeholder="×4" />
              <Text label="Description" value={c.desc} onChange={(desc) => set({ desc })} />
            </div>
          )} />
        <label className={`${lbl} mt-4`}>Account health bars (optional)</label>
        <Rows<Vital> items={data.dashboard.vitals} onChange={(vitals) => patch({ dashboard: { ...data.dashboard, vitals } })} blank={{ label: "", pct: 50, note: "" }} addLabel="Add vital"
          render={(v, set) => (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pr-16">
              <Text label="Label" value={v.label} onChange={(label) => set({ label })} />
              <div>
                <label className={lbl}>Strength: {v.pct}%</label>
                <input type="range" min={0} max={100} value={v.pct} onChange={(e) => set({ pct: Number(e.target.value) })} className="w-full accent-orange" />
              </div>
              <Text label="Note" value={v.note} onChange={(note) => set({ note })} />
            </div>
          )} />
      </fieldset>

      {/* AI is the shortcut, not the front door — collapsed until wanted. */}
      <details className="lq-card">
        <summary className="cursor-pointer select-none px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
          <span className="font-display font-bold text-[14px] tracking-tight text-charcoal-80">✨ Fill with AI (optional)</span>
          <span className="text-xs text-charcoal-40">Paste the onboarding AI&apos;s JSON reply to fill the fields above.</span>
        </summary>
        <div className="px-5 pb-5 border-t border-charcoal/5 pt-4">
          <textarea value={portalJson} onChange={(e) => setPortalJson(e.target.value)} rows={5} className={input} placeholder={'Paste the AI\'s JSON reply here… (starts with "{")'} dir="ltr" />
          <div className="mt-2 flex items-center gap-3">
            <button type="button" onClick={applyPortalJson} className="lq-btn lq-btn--glass lq-btn--sm">Apply portal content</button>
            {portalMsg && <span className="text-sm text-charcoal-80">{portalMsg}</span>}
          </div>
        </div>
      </details>

      <SyncPill {...sync} />
    </div>
  );
}
