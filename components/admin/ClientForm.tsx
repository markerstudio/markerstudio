"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { saveClient } from "@/app/admin/actions";
import type { Client, ClientData, LocalizedText, StoryCard, Vital, SocialItem, MetricRow, Campaign, Invoice, DocItem } from "@/lib/clients";

const input = "w-full border border-neutral-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange/40 focus:border-orange";
const lbl = "block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1";

const BLANK: ClientData = {
  hero: { en: "", ar: "" },
  accent: "",
  plan: { name: "", active: true, start: "", end: "", notionUrl: "", note: { en: "", ar: "" } },
  dashboard: { headline: { en: "", ar: "" }, diagnosis: { en: "", ar: "" }, cards: [], vitals: [] },
  social: { headline: { en: "", ar: "" }, items: [] },
  analysis: {
    organic: { headline: { en: "", ar: "" }, reading: { en: "", ar: "" }, metrics: [] },
    paid: { spend: "", note: { en: "", ar: "" }, campaigns: [] },
  },
  invoices: [],
  documents: [],
};

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="bg-white border border-neutral-200 rounded-xl p-6">
      <legend className="px-2 -ml-2 font-bold">{title}</legend>
      {hint && <p className="text-xs text-neutral-400 mb-4">{hint}</p>}
      <div className={hint ? "" : "mt-2"}>{children}</div>
    </fieldset>
  );
}

function Text({ label, value, onChange, placeholder, area }: { label?: string; value: string; onChange: (v: string) => void; placeholder?: string; area?: boolean }) {
  return (
    <div>
      {label && <label className={lbl}>{label}</label>}
      {area ? (
        <textarea className={input} rows={2} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className={input} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

function Bi({ label, value, onChange, area }: { label: string; value?: LocalizedText; onChange: (v: LocalizedText) => void; area?: boolean }) {
  const v = value ?? { en: "", ar: "" };
  return (
    <div className="mb-4">
      <label className={lbl}>{label}</label>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <span className="block text-[10px] font-bold text-neutral-400 mb-1">EN</span>
          {area ? <textarea dir="ltr" rows={2} className={input} value={v.en} onChange={(e) => onChange({ ...v, en: e.target.value })} /> : <input dir="ltr" className={input} value={v.en} onChange={(e) => onChange({ ...v, en: e.target.value })} />}
        </div>
        <div>
          <span className="block text-[10px] font-bold text-neutral-400 mb-1">AR</span>
          {area ? <textarea dir="rtl" rows={2} className={input} value={v.ar} onChange={(e) => onChange({ ...v, ar: e.target.value })} /> : <input dir="rtl" className={input} value={v.ar} onChange={(e) => onChange({ ...v, ar: e.target.value })} />}
        </div>
      </div>
    </div>
  );
}

function Rows<T>({ items, onChange, blank, addLabel, render }: { items: T[]; onChange: (next: T[]) => void; blank: T; addLabel: string; render: (item: T, set: (patch: Partial<T>) => void) => React.ReactNode }) {
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={i} className="border border-neutral-200 rounded-lg p-3 relative">
          <button type="button" onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="absolute top-2 right-2 text-xs font-medium text-neutral-400 hover:text-red-600">Remove</button>
          {render(it, (patch) => onChange(items.map((x, idx) => (idx === i ? { ...x, ...patch } : x))))}
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, { ...blank }])} className="text-sm font-semibold text-orange hover:text-orange-deep">+ {addLabel}</button>
    </div>
  );
}

export default function ClientForm({ client }: { client?: Client }) {
  const [data, setData] = useState<ClientData>(client?.data ?? BLANK);
  const patch = (p: Partial<ClientData>) => setData((d) => ({ ...d, ...p }));

  const [color, setColor] = useState(client?.color ?? "#303030");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  async function generate() {
    setAiBusy(true);
    setAiError("");
    try {
      const clientName = (formRef.current?.elements.namedItem("name") as HTMLInputElement | null)?.value || "";
      const res = await fetch("/api/admin/generate-portal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt, clientName }),
      });
      const json = await res.json();
      if (!res.ok) {
        setAiError(json.error || "Generation failed.");
        return;
      }
      setData((d) => ({ ...d, ...json.data }));
    } catch {
      setAiError("Network error. Please try again.");
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <form ref={formRef} action={saveClient} className="space-y-6">
      {client && <input type="hidden" name="originalSlug" value={client.slug} />}
      {/* The friendly fields build this hidden JSON for the server action */}
      <input type="hidden" name="data" value={JSON.stringify(data)} />

      <div className="bg-orange-50 border border-orange-200 rounded-xl p-6">
        <h2 className="font-bold mb-1">✨ Generate with AI</h2>
        <p className="text-sm text-neutral-600 mb-3">
          Paste the client&apos;s report or describe their results — Claude fills the whole portal (English + Arabic) for you.
          Review and tweak the fields below before saving.
        </p>
        <textarea
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          rows={6}
          className={input}
          placeholder="e.g. Dr. Jack Sabat, dermatology clinic. Since March we ran 5 Meta campaigns, $292 spend. Views 7,260 → 301,274, followers 11 → 238, link clicks 1 → 1,182. Plan: monthly social management, active, Feb 26–May 26. Three paid invoices of 1,800 ILS each."
        />
        {aiError && <p className="text-sm text-red-600 mt-2">{aiError}</p>}
        <button
          type="button"
          onClick={generate}
          disabled={aiBusy}
          className="mt-3 bg-orange text-white font-semibold rounded-md px-5 py-2.5 text-sm hover:bg-orange-deep transition-colors disabled:opacity-60"
        >
          {aiBusy ? "Generating…" : "Generate portal content"}
        </button>
      </div>

      <Group title="Identity">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
          <div><label className={lbl}>Slug</label><input name="slug" defaultValue={client?.slug} required pattern="[a-z0-9-]+" className={input} placeholder="dr-jack-sabat" /></div>
          <div><label className={lbl}>Client name</label><input name="name" defaultValue={client?.name} required className={input} placeholder="Dr. Jack Sabat" /></div>
          <div><label className={lbl}>Logo URL</label><input name="logo" defaultValue={client?.logo} className={input} /></div>
          <div>
            <label className={lbl}>Brand colour</label>
            <div className="flex items-center gap-2">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 rounded border border-neutral-300 bg-white p-1" aria-label="Brand colour" />
              <input name="color" value={color} onChange={(e) => setColor(e.target.value)} className={input} />
            </div>
          </div>
        </div>
      </Group>

      <Group title="Hero">
        <Bi label="Intro line" value={data.hero} onChange={(hero) => patch({ hero })} area />
        <Text label="Watermark word (optional)" value={data.accent ?? ""} onChange={(accent) => patch({ accent })} placeholder="JACK" />
      </Group>

      <Group title="Marker Plan">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 mb-4">
          <Text label="Plan name" value={data.plan.name} onChange={(name) => patch({ plan: { ...data.plan, name } })} />
          <label className="flex items-center gap-3 self-end pb-2 text-sm">
            <input type="checkbox" className="custom-checkbox" checked={data.plan.active} onChange={(e) => patch({ plan: { ...data.plan, active: e.target.checked } })} />
            Plan is active
          </label>
          <Text label="Start" value={data.plan.start} onChange={(start) => patch({ plan: { ...data.plan, start } })} placeholder="Feb 26" />
          <Text label="End" value={data.plan.end} onChange={(end) => patch({ plan: { ...data.plan, end } })} placeholder="May 26" />
        </div>
        <div className="mb-4"><Text label="Notion link (optional)" value={data.plan.notionUrl ?? ""} onChange={(notionUrl) => patch({ plan: { ...data.plan, notionUrl } })} placeholder="https://notion.so/…" /></div>
        <Bi label="Plan note" value={data.plan.note} onChange={(note) => patch({ plan: { ...data.plan, note } })} area />
      </Group>

      <Group title="Dashboard">
        <Bi label="Headline" value={data.dashboard.headline} onChange={(headline) => patch({ dashboard: { ...data.dashboard, headline } })} />
        <Bi label="Diagnosis (optional)" value={data.dashboard.diagnosis} onChange={(diagnosis) => patch({ dashboard: { ...data.dashboard, diagnosis } })} area />
        <label className={lbl}>Story cards</label>
        <Rows<StoryCard>
          items={data.dashboard.cards}
          onChange={(cards) => patch({ dashboard: { ...data.dashboard, cards } })}
          blank={{ tag: "", value: "", desc: "" }}
          addLabel="Add card"
          render={(c, set) => (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pr-16">
              <Text label="Tag" value={c.tag} onChange={(tag) => set({ tag })} />
              <Text label="Value" value={c.value} onChange={(value) => set({ value })} />
              <Text label="Description" value={c.desc} onChange={(desc) => set({ desc })} />
            </div>
          )}
        />
        <label className={`${lbl} mt-4`}>Account vitals (bars)</label>
        <Rows<Vital>
          items={data.dashboard.vitals}
          onChange={(vitals) => patch({ dashboard: { ...data.dashboard, vitals } })}
          blank={{ label: "", pct: 50, note: "" }}
          addLabel="Add vital"
          render={(v, set) => (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pr-16">
              <Text label="Label" value={v.label} onChange={(label) => set({ label })} />
              <div>
                <label className={lbl}>Strength: {v.pct}%</label>
                <input type="range" min={0} max={100} value={v.pct} onChange={(e) => set({ pct: Number(e.target.value) })} className="w-full accent-orange" />
                <div className="h-1.5 bg-charcoal-10 rounded-full overflow-hidden mt-1"><div className="h-full bg-orange rounded-full" style={{ width: `${v.pct}%` }} /></div>
              </div>
              <Text label="Note" value={v.note} onChange={(note) => set({ note })} />
            </div>
          )}
        />
      </Group>

      <Group title="Social Media Plan">
        <Bi label="Headline" value={data.social.headline} onChange={(headline) => patch({ social: { ...data.social, headline } })} />
        <Rows<SocialItem>
          items={data.social.items}
          onChange={(items) => patch({ social: { ...data.social, items } })}
          blank={{ title: "", desc: "", tag: "" }}
          addLabel="Add item"
          render={(s, set) => (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pr-16">
              <Text label="Tag" value={s.tag ?? ""} onChange={(tag) => set({ tag })} />
              <Text label="Title" value={s.title} onChange={(title) => set({ title })} />
              <Text label="Description" value={s.desc} onChange={(desc) => set({ desc })} />
            </div>
          )}
        />
      </Group>

      <Group title="Analysis — Organic">
        <Bi label="Headline" value={data.analysis.organic.headline} onChange={(headline) => patch({ analysis: { ...data.analysis, organic: { ...data.analysis.organic, headline } } })} />
        <Bi label="Reading (optional)" value={data.analysis.organic.reading} onChange={(reading) => patch({ analysis: { ...data.analysis, organic: { ...data.analysis.organic, reading } } })} area />
        <label className={lbl}>Before / after metrics</label>
        <Rows<MetricRow>
          items={data.analysis.organic.metrics}
          onChange={(metrics) => patch({ analysis: { ...data.analysis, organic: { ...data.analysis.organic, metrics } } })}
          blank={{ label: "", before: "", after: "", note: "" }}
          addLabel="Add metric"
          render={(m, set) => (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pr-16">
              <Text label="Metric" value={m.label} onChange={(label) => set({ label })} />
              <Text label="Before" value={m.before} onChange={(before) => set({ before })} />
              <Text label="After" value={m.after} onChange={(after) => set({ after })} />
              <Text label="Note" value={m.note} onChange={(note) => set({ note })} />
            </div>
          )}
        />
      </Group>

      <Group title="Analysis — Paid">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
          <Text label="Total spend" value={data.analysis.paid.spend} onChange={(spend) => patch({ analysis: { ...data.analysis, paid: { ...data.analysis.paid, spend } } })} placeholder="$292.22" />
        </div>
        <Bi label="Note" value={data.analysis.paid.note} onChange={(note) => patch({ analysis: { ...data.analysis, paid: { ...data.analysis.paid, note } } })} area />
        <label className={lbl}>Campaigns</label>
        <Rows<Campaign>
          items={data.analysis.paid.campaigns}
          onChange={(campaigns) => patch({ analysis: { ...data.analysis, paid: { ...data.analysis.paid, campaigns } } })}
          blank={{ name: "", period: "", type: "", spend: "", reach: "", impressions: "", freq: "", cpm: "", desc: "" }}
          addLabel="Add campaign"
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
          )}
        />
      </Group>

      <Group title="Invoices">
        <Rows<Invoice>
          items={data.invoices}
          onChange={(invoices) => patch({ invoices })}
          blank={{ cycle: "", desc: "", amount: "", status: "due" }}
          addLabel="Add invoice"
          render={(inv, set) => (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pr-16">
              <div className="md:col-span-2"><Text label="Cycle" value={inv.cycle} onChange={(cycle) => set({ cycle })} placeholder="Cycle 01 · Feb 26 → Mar 26" /></div>
              <Text label="Amount" value={inv.amount} onChange={(amount) => set({ amount })} placeholder="1,800 ILS" />
              <div>
                <label className={lbl}>Status</label>
                <select className={input} value={inv.status} onChange={(e) => set({ status: e.target.value as Invoice["status"] })}>
                  <option value="paid">Paid</option>
                  <option value="due">Due</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>
              <div className="md:col-span-4"><Text label="Description" value={inv.desc} onChange={(desc) => set({ desc })} /></div>
            </div>
          )}
        />
      </Group>

      <Group title="Documents" hint="Proposal, agreement, etc. Clients can open / download these from the portal.">
        <Rows<DocItem>
          items={data.documents}
          onChange={(documents) => patch({ documents })}
          blank={{ title: "", type: "PDF", url: "" }}
          addLabel="Add document"
          render={(doc, set) => (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pr-16">
              <Text label="Title" value={doc.title} onChange={(title) => set({ title })} placeholder="Proposal" />
              <Text label="Type" value={doc.type} onChange={(type) => set({ type })} placeholder="PDF" />
              <Text label="URL" value={doc.url} onChange={(url) => set({ url })} placeholder="https://…" />
            </div>
          )}
        />
      </Group>

      <div className="flex items-center gap-3">
        <button className="bg-orange text-white font-semibold rounded-md px-5 py-2.5 text-sm hover:bg-orange-deep transition-colors">
          {client ? "Save changes" : "Create client"}
        </button>
        <Link href="/admin/clients" className="text-sm text-neutral-500 hover:text-neutral-900">Cancel</Link>
      </div>
    </form>
  );
}
