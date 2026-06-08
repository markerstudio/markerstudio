"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { saveClient } from "@/app/admin/actions";
import { toCSV, fromCSV } from "@/lib/portalCsv";
import SocialCalendar from "@/components/SocialCalendar";
import { blankClientData, type Client, type ClientData, type LocalizedText, type StoryCard, type Vital, type MetricRow, type Campaign, type Invoice, type DocItem } from "@/lib/clients";

const input = "w-full border border-neutral-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange/40 focus:border-orange";
const lbl = "block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1";

function aiPrompt(data: ClientData): string {
  return `You are filling a bilingual (English + Arabic) marketing client portal for Marker Studio.
Below is a CSV with columns: field,en,ar,value. Fill it using the Meta Ads / Instagram analytics and client info I provide.

Rules:
- For bilingual rows, fill BOTH "en" and "ar" with natural language (Arabic that reads naturally, not a literal translation). For all other rows fill "value" only.
- Add more indexed rows for every item in the data — e.g. analysis.paid.campaigns[1].*, analysis.organic.metrics[2].*, social.posts[3].*, invoices[2].* — copy the column names exactly, just change the number.
- Use real numbers from the report. Leave a cell blank if you don't have it. Never rename the "field" column.
- Formats: social.posts[n].date = YYYY-MM-DD; social.posts[n].status = planned | scheduled | posted; invoices[n].status = paid | due | overdue; dashboard.vitals[n].pct and finance.progress = a number 0–100.
- Output ONLY the CSV (the header line plus all rows). No commentary, no code fences.

=== PASTE YOUR META / INSTAGRAM REPORT BELOW THIS LINE ===
[paste the client's analytics here]

=== CSV TO FILL ===
${toCSV(data)}`;
}

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="bg-white border border-neutral-200 rounded-xl p-6">
      <legend className="px-2 -ml-2 font-bold">{title}</legend>
      {hint && <p className="text-xs text-neutral-400 mb-3">{hint}</p>}
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
  const [data, setData] = useState<ClientData>(client?.data ?? blankClientData());
  const patch = (p: Partial<ClientData>) => setData((d) => ({ ...d, ...p }));
  const [color, setColor] = useState(client?.color ?? "#303030");
  const [csvMsg, setCsvMsg] = useState("");
  const [aiCopied, setAiCopied] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  function copyPrompt() {
    navigator.clipboard?.writeText(aiPrompt(data));
    setAiCopied(true);
    setTimeout(() => setAiCopied(false), 1800);
  }
  function applyPaste() {
    try {
      setData(fromCSV(pasteText));
      setCsvMsg("Filled from the AI output ✓ — review below, then Save changes.");
      setPasteText("");
    } catch {
      setCsvMsg("Couldn't read that — paste the CSV the AI returned (the field,en,ar,value table).");
    }
  }

  function downloadCsv() {
    const slug = (formRef.current?.elements.namedItem("slug") as HTMLInputElement | null)?.value || "client";
    const blob = new Blob([toCSV(data)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug || "client"}-portal.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { setData(fromCSV(String(reader.result))); setCsvMsg("Imported ✓ — Save changes to apply."); }
      catch { setCsvMsg("Couldn't read that CSV."); }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <form ref={formRef} action={saveClient} className="space-y-6">
      {client && <input type="hidden" name="originalSlug" value={client.slug} />}
      <input type="hidden" name="data" value={JSON.stringify(data)} />

      <div className="bg-orange-50 border border-orange-200 rounded-xl p-6">
        <h2 className="font-bold mb-1">✨ Fill with AI (paste analytics)</h2>
        <p className="text-sm text-neutral-600 mb-3">
          <b>1.</b> Copy the prompt. <b>2.</b> Paste it into ChatGPT / Claude together with your Meta / Instagram report.
          <b> 3.</b> Paste the AI&apos;s reply below and Apply — it fills the whole portal (analysis, social, finance…). Review, then Save.
        </p>
        <button type="button" onClick={copyPrompt} className="bg-orange text-white font-semibold rounded-md px-4 py-2 text-sm hover:bg-orange-deep transition-colors mb-3">
          {aiCopied ? "Copied ✓" : "Copy AI prompt"}
        </button>
        <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={5} className={input} placeholder="Paste the AI's CSV reply here…" dir="ltr" />
        <div className="mt-2 flex items-center gap-3">
          <button type="button" onClick={applyPaste} className="border border-neutral-300 rounded-md px-4 py-2 text-sm font-medium hover:bg-neutral-50">Apply to form</button>
          {csvMsg && <span className="text-sm text-neutral-700">{csvMsg}</span>}
        </div>
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
            <input type="checkbox" className="custom-checkbox" checked={data.plan.active} onChange={(e) => patch({ plan: { ...data.plan, active: e.target.checked } })} /> Plan is active
          </label>
          <Text label="Start" value={data.plan.start} onChange={(start) => patch({ plan: { ...data.plan, start } })} placeholder="Feb 26" />
          <Text label="End" value={data.plan.end} onChange={(end) => patch({ plan: { ...data.plan, end } })} placeholder="May 26" />
        </div>
        <div className="mb-4"><Text label="Notion link (optional)" value={data.plan.notionUrl ?? ""} onChange={(notionUrl) => patch({ plan: { ...data.plan, notionUrl } })} placeholder="https://notion.so/…" /></div>
        <Bi label="Plan note" value={data.plan.note} onChange={(note) => patch({ plan: { ...data.plan, note } })} area />
        <p className="text-xs text-neutral-400 mt-1">Leave End blank in Notion (or here) and the plan shows as “Ongoing”.</p>
      </Group>

      <Group title="Dashboard">
        <Bi label="Headline" value={data.dashboard.headline} onChange={(headline) => patch({ dashboard: { ...data.dashboard, headline } })} />
        <Bi label="Diagnosis (optional)" value={data.dashboard.diagnosis} onChange={(diagnosis) => patch({ dashboard: { ...data.dashboard, diagnosis } })} area />
        <label className={lbl}>Story cards</label>
        <Rows<StoryCard> items={data.dashboard.cards} onChange={(cards) => patch({ dashboard: { ...data.dashboard, cards } })} blank={{ tag: "", value: "", desc: "" }} addLabel="Add card"
          render={(c, set) => (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pr-16">
              <Text label="Tag" value={c.tag} onChange={(tag) => set({ tag })} />
              <Text label="Value" value={c.value} onChange={(value) => set({ value })} />
              <Text label="Description" value={c.desc} onChange={(desc) => set({ desc })} />
            </div>
          )} />
        <label className={`${lbl} mt-4`}>Account vitals</label>
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
      </Group>

      <Group title="Social Media Plan" hint="Click a day on the calendar to add or edit posts.">
        <Bi label="Headline" value={data.social.headline} onChange={(headline) => patch({ social: { ...data.social, headline } })} />
        <SocialCalendar posts={data.social.posts} editable lang="en" onChange={(posts) => patch({ social: { ...data.social, posts } })} />
      </Group>

      <Group title="Analysis — Organic">
        <Bi label="Headline" value={data.analysis.organic.headline} onChange={(headline) => patch({ analysis: { ...data.analysis, organic: { ...data.analysis.organic, headline } } })} />
        <Bi label="Reading (optional)" value={data.analysis.organic.reading} onChange={(reading) => patch({ analysis: { ...data.analysis, organic: { ...data.analysis.organic, reading } } })} area />
        <label className={lbl}>Before / after metrics</label>
        <Rows<MetricRow> items={data.analysis.organic.metrics} onChange={(metrics) => patch({ analysis: { ...data.analysis, organic: { ...data.analysis.organic, metrics } } })} blank={{ label: "", before: "", after: "", note: "" }} addLabel="Add metric"
          render={(m, set) => (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pr-16">
              <Text label="Metric" value={m.label} onChange={(label) => set({ label })} />
              <Text label="Before" value={m.before} onChange={(before) => set({ before })} />
              <Text label="After" value={m.after} onChange={(after) => set({ after })} />
              <Text label="Note" value={m.note} onChange={(note) => set({ note })} />
            </div>
          )} />
      </Group>

      <Group title="Analysis — Paid">
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
      </Group>

      <Group title="Finance" hint="Money left + paid-to-date come from Notion (Budget Tracker) on sync, but you can override here.">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 mb-5">
          <Text label="Money left" value={data.plan.balance ?? ""} onChange={(balance) => patch({ plan: { ...data.plan, balance } })} placeholder="e.g. 3,600 ILS" />
          <Text label="Paid to date" value={data.finance?.paid ?? ""} onChange={(paid) => patch({ finance: { paid, progress: data.finance?.progress ?? 0 } })} placeholder="e.g. 5,400 ILS" />
          <div>
            <label className={lbl}>Progress: {data.finance?.progress ?? 0}%</label>
            <input type="range" min={0} max={100} value={data.finance?.progress ?? 0} onChange={(e) => patch({ finance: { paid: data.finance?.paid ?? "", progress: Number(e.target.value) } })} className="w-full accent-orange" />
          </div>
        </div>
        <label className={lbl}>Payment history</label>
        <Rows<Invoice> items={data.invoices} onChange={(invoices) => patch({ invoices })} blank={{ cycle: "", desc: "", amount: "", status: "due" }} addLabel="Add payment"
          render={(inv, set) => (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pr-16">
              <div className="md:col-span-2"><Text label="Cycle" value={inv.cycle} onChange={(cycle) => set({ cycle })} placeholder="Cycle 01 · Feb 26 → Mar 26" /></div>
              <Text label="Amount" value={inv.amount} onChange={(amount) => set({ amount })} placeholder="1,800 ILS" />
              <div>
                <label className={lbl}>Status</label>
                <select className={input} value={inv.status} onChange={(e) => set({ status: e.target.value as Invoice["status"] })}>
                  <option value="paid">Paid</option><option value="due">Due</option><option value="overdue">Overdue</option>
                </select>
              </div>
              <div className="md:col-span-4"><Text label="Description" value={inv.desc} onChange={(desc) => set({ desc })} /></div>
            </div>
          )} />
      </Group>

      <Group title="Documents" hint="Proposal, agreement, etc. Clients can open / download these.">
        <Rows<DocItem> items={data.documents} onChange={(documents) => patch({ documents })} blank={{ title: "", type: "PDF", url: "" }} addLabel="Add document"
          render={(doc, set) => (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pr-16">
              <Text label="Title" value={doc.title} onChange={(title) => set({ title })} placeholder="Proposal" />
              <Text label="Type" value={doc.type} onChange={(type) => set({ type })} placeholder="PDF" />
              <Text label="URL" value={doc.url} onChange={(url) => set({ url })} placeholder="https://…" />
            </div>
          )} />
      </Group>

      <div className="bg-cream border border-neutral-200 rounded-xl p-6">
        <h2 className="font-bold mb-1">Bulk-fill with a spreadsheet (CSV)</h2>
        <p className="text-sm text-neutral-600 mb-3">Optional — download, fill anywhere, upload, then Save.</p>
        <div className="flex items-center gap-3 flex-wrap">
          <button type="button" onClick={downloadCsv} className="border border-neutral-300 rounded-md px-4 py-2 text-sm font-medium hover:bg-neutral-50">Download CSV</button>
          <label className="bg-neutral-800 text-white font-semibold rounded-md px-4 py-2 text-sm hover:bg-neutral-900 transition-colors cursor-pointer">
            Upload CSV
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={onUpload} />
          </label>
          {csvMsg && <span className="text-sm text-neutral-700">{csvMsg}</span>}
        </div>
      </div>

      <div className="flex items-center gap-3 sticky bottom-0 bg-neutral-100 py-3">
        <button className="bg-orange text-white font-semibold rounded-md px-6 py-2.5 text-sm hover:bg-orange-deep transition-colors">
          {client ? "Save changes" : "Create client"}
        </button>
        {client && <Link href={`/portal/${client.slug}`} target="_blank" className="text-sm font-medium text-neutral-600 hover:text-orange">View portal ↗</Link>}
        <Link href="/admin/clients" className="text-sm text-neutral-500 hover:text-neutral-900">Cancel</Link>
      </div>
    </form>
  );
}
