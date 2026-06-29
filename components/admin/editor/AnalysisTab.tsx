"use client";

import { useState } from "react";
import { fromCSV } from "@/lib/portalCsv";
import { saveSection } from "@/app/admin/clients/section-actions";
import AiAnalysisPanel from "@/components/admin/AiAnalysisPanel";
import { input, lbl, Text, Bi, Rows, SaveButton } from "./fields";
import { analyticsPrompt } from "./aiPrompts";
import type { Client, ClientData, MetricRow, Campaign } from "@/lib/clients";

// Mirrors the portal's Analysis tab: organic metrics, paid campaigns, and the AI
// reading panel. The AI panel saves analysis.ai on its own (server action).
export default function AnalysisTab({ slug, data, patch, client, apiEnabled }: { slug: string; data: ClientData; patch: (p: Partial<ClientData>) => void; client: Client; apiEnabled: boolean }) {
  const [copied, setCopied] = useState(false);
  const [paste, setPaste] = useState("");
  const [msg, setMsg] = useState("");

  function copy() {
    navigator.clipboard?.writeText(analyticsPrompt(data));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  function apply() {
    try {
      const parsed = fromCSV(paste);
      patch({ analysis: parsed.analysis });
      setMsg("Analytics filled ✓ — review below, then Save.");
      setPaste("");
    } catch {
      setMsg("Couldn't read that — paste the CSV the AI returned (the field,en,ar,value table).");
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-6">
        <h3 className="font-bold mb-1">✨ Fill analytics with AI</h3>
        <p className="text-sm text-neutral-600 mb-3">Copy the prompt, run it with your Meta / Instagram export, then paste the reply to fill the Analysis fields below. Then Save.</p>
        <button type="button" onClick={copy} className="bg-orange text-white font-semibold rounded-md px-4 py-2 text-sm hover:bg-orange-deep transition-colors mb-3">
          {copied ? "Copied ✓" : "Copy analytics prompt"}
        </button>
        <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={5} className={input} placeholder="Paste the AI's CSV reply here…" dir="ltr" />
        <div className="mt-2 flex items-center gap-3">
          <button type="button" onClick={apply} className="border border-neutral-300 rounded-md px-4 py-2 text-sm font-medium hover:bg-neutral-50">Apply analytics</button>
          {msg && <span className="text-sm text-neutral-700">{msg}</span>}
        </div>
      </div>

      <fieldset className="bg-white border border-neutral-200 rounded-xl p-6">
        <legend className="px-2 -ml-2 font-bold">Analysis — Organic</legend>
        <Bi label="Headline" value={data.analysis.organic.headline} onChange={(headline) => patch({ analysis: { ...data.analysis, organic: { ...data.analysis.organic, headline } } })} />
        <Bi label="Reading (optional)" value={data.analysis.organic.reading} onChange={(reading) => patch({ analysis: { ...data.analysis, organic: { ...data.analysis.organic, reading } } })} area />
        <label className={lbl}>Metrics — the number + what it means</label>
        <Rows<MetricRow> items={data.analysis.organic.metrics} onChange={(metrics) => patch({ analysis: { ...data.analysis, organic: { ...data.analysis.organic, metrics } } })} blank={{ label: "", value: "", delta: "", note: "" }} addLabel="Add metric"
          render={(m, set) => (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pr-16">
              <Text label="Metric" value={m.label} onChange={(label) => set({ label })} placeholder="Views" />
              <Text label="Number" value={m.value ?? m.after ?? ""} onChange={(value) => set({ value })} placeholder="301,274" />
              <Text label="Change (optional)" value={m.delta ?? ""} onChange={(delta) => set({ delta })} placeholder="+312%" />
              <Text label="What it means" value={m.note} onChange={(note) => set({ note })} placeholder="More people are discovering you" />
            </div>
          )} />
      </fieldset>

      <fieldset className="bg-white border border-neutral-200 rounded-xl p-6">
        <legend className="px-2 -ml-2 font-bold">Analysis — Paid</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
          <Text label="Total spend" value={data.analysis.paid.spend} onChange={(spend) => patch({ analysis: { ...data.analysis, paid: { ...data.analysis.paid, spend } } })} placeholder="$292.22" />
        </div>
        <Bi label="Note" value={data.analysis.paid.note} onChange={(note) => patch({ analysis: { ...data.analysis, paid: { ...data.analysis.paid, note } } })} area />
        <label className={lbl}>Campaigns</label>
        <Rows<Campaign> items={data.analysis.paid.campaigns} onChange={(campaigns) => patch({ analysis: { ...data.analysis, paid: { ...data.analysis.paid, campaigns } } })} blank={{ name: "", period: "", type: "", spend: "", reach: "", impressions: "", freq: "", cpm: "", desc: "" }} addLabel="Add campaign"
          render={(c, set) => (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pr-16">
              <Text label="Name" value={c.name} onChange={(name) => set({ name })} />
              <Text label="Period" value={c.period} onChange={(period) => set({ period })} />
              <Text label="Type" value={c.type} onChange={(type) => set({ type })} />
              <Text label="Spend" value={c.spend} onChange={(spend) => set({ spend })} />
              <Text label="Reach" value={c.reach} onChange={(reach) => set({ reach })} />
              <Text label="Impressions" value={c.impressions} onChange={(impressions) => set({ impressions })} />
              <Text label="Frequency" value={c.freq} onChange={(freq) => set({ freq })} />
              <Text label="CPM" value={c.cpm} onChange={(cpm) => set({ cpm })} />
              <div className="col-span-2 md:col-span-4"><Text label="Description" value={c.desc} onChange={(desc) => set({ desc })} area /></div>
            </div>
          )} />
      </fieldset>

      <SaveButton onSave={() => saveSection(slug, { analysis: data.analysis })} />

      <div className="bg-white border border-neutral-200 rounded-xl p-6">
        <h3 className="font-bold mb-3">AI reading</h3>
        <AiAnalysisPanel client={client} apiEnabled={apiEnabled} />
      </div>
    </div>
  );
}
