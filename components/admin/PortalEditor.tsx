"use client";

// Dedicated, structured editor for a client's portal content. Lives in the
// admin (studio-only) so the client-facing portal stays clean and read-only.
// Saves the whole ClientData blob via the existing updateClientData action.
import { useState } from "react";
import Link from "next/link";
import { updateClientData } from "@/app/admin/actions";
import SocialCalendar from "@/components/SocialCalendar";
import FileUpload from "@/components/FileUpload";
import type { Client, ClientData } from "@/lib/clients";

const SECTIONS = [
  { id: "identity", label: "Identity", hint: "Intro & watermark" },
  { id: "overview", label: "Overview", hint: "Dashboard story" },
  { id: "plan", label: "Plan", hint: "Cycle & status" },
  { id: "social", label: "Social", hint: "Content calendar" },
  { id: "analysis", label: "Analysis", hint: "Organic & paid" },
  { id: "finance", label: "Finance", hint: "Fees & payments" },
  { id: "documents", label: "Documents", hint: "Files & assets" },
  { id: "activity", label: "Activity", hint: "Updates feed" },
] as const;

const inputCls =
  "w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange/30 focus:border-orange transition-shadow";

// Fill any missing nested structure so the form never crashes on legacy data.
function normalize(d: ClientData): ClientData {
  const c: ClientData = JSON.parse(JSON.stringify(d || {}));
  c.hero ||= { en: "", ar: "" };
  c.plan ||= { name: "", active: true, start: "", end: "" };
  c.plan.note ||= { en: "", ar: "" };
  c.dashboard ||= { headline: { en: "", ar: "" }, cards: [], vitals: [] };
  c.dashboard.headline ||= { en: "", ar: "" };
  c.dashboard.diagnosis ||= { en: "", ar: "" };
  c.dashboard.cards ||= [];
  c.dashboard.vitals ||= [];
  c.social ||= { headline: { en: "", ar: "" }, posts: [] };
  c.social.headline ||= { en: "", ar: "" };
  c.social.posts ||= [];
  c.analysis ||= { organic: { headline: { en: "", ar: "" }, metrics: [] }, paid: { spend: "", note: { en: "", ar: "" }, campaigns: [] } };
  c.analysis.organic ||= { headline: { en: "", ar: "" }, metrics: [] };
  c.analysis.organic.headline ||= { en: "", ar: "" };
  c.analysis.organic.reading ||= { en: "", ar: "" };
  c.analysis.organic.metrics ||= [];
  c.analysis.paid ||= { spend: "", note: { en: "", ar: "" }, campaigns: [] };
  c.analysis.paid.note ||= { en: "", ar: "" };
  c.analysis.paid.campaigns ||= [];
  c.finance ||= { monthlyFee: "", progress: 0 };
  c.invoices ||= [];
  c.documents ||= [];
  c.assets ||= [];
  c.updates ||= [];
  return c;
}

export default function PortalEditor({ client }: { client: Client }) {
  const [data, setData] = useState<ClientData>(() => normalize(client.data));
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [active, setActive] = useState<string>("identity");
  const [saving, setSaving] = useState<"" | "saving" | "saved" | "error">("");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const up = (fn: (c: any) => void) => setData((prev) => { const c = JSON.parse(JSON.stringify(prev)); fn(c); return c; });
  const L = (en: string, ar: string) => (lang === "ar" ? ar : en);

  async function save() {
    setSaving("saving");
    const r = await updateClientData(client.slug, JSON.stringify(data));
    setSaving(r?.ok ? "saved" : "error");
    if (r?.ok) setTimeout(() => setSaving(""), 1800);
  }

  // --- small field primitives (inline elements → no focus loss) -------------
  const labelCls = "block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1";
  const card = "rounded-2xl bg-white border border-neutral-200 p-6 shadow-sm";

  return (
    <div className="grid gap-6 lg:grid-cols-[200px_1fr] items-start">
      {/* Section sidebar */}
      <nav className="lg:sticky lg:top-24 flex lg:flex-col gap-1 overflow-x-auto -mx-1 px-1 pb-1">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setActive(s.id)}
            className={`text-left rounded-xl px-3 py-2 whitespace-nowrap transition-colors ${
              active === s.id ? "bg-charcoal text-white" : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            <span className="block text-sm font-semibold">{s.label}</span>
            <span className={`block text-[11px] ${active === s.id ? "text-white/60" : "text-neutral-400"}`}>{s.hint}</span>
          </button>
        ))}
      </nav>

      <div className="space-y-6 min-w-0">
        {/* Sticky action bar */}
        <div className="sticky top-[52px] z-20 -mt-2 flex items-center justify-between gap-3 rounded-2xl bg-white/85 backdrop-blur border border-neutral-200 px-4 py-2.5 shadow-sm">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold">{SECTIONS.find((s) => s.id === active)?.label}</span>
            <span className="text-neutral-400">· {client.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-lg border border-neutral-200 overflow-hidden text-xs font-semibold">
              <button onClick={() => setLang("en")} className={lang === "en" ? "bg-charcoal text-white px-2.5 py-1" : "px-2.5 py-1 text-neutral-500"}>EN</button>
              <button onClick={() => setLang("ar")} className={lang === "ar" ? "bg-charcoal text-white px-2.5 py-1" : "px-2.5 py-1 text-neutral-500"}>ع</button>
            </div>
            <Link href={`/portal/${client.slug}`} target="_blank" className="text-sm text-neutral-500 hover:text-orange whitespace-nowrap">Preview ↗</Link>
            <button onClick={save} className="bg-orange text-white font-semibold rounded-lg px-4 py-2 text-sm hover:bg-orange-deep transition-colors">
              {saving === "saving" ? "Saving…" : saving === "saved" ? "Saved ✓" : saving === "error" ? "Retry" : "Save"}
            </button>
          </div>
        </div>

        {/* IDENTITY */}
        {active === "identity" && (
          <div className={card}>
            <h2 className="font-bold mb-4">Identity</h2>
            <label className="block mb-4">
              <span className={labelCls}>Intro line ({lang.toUpperCase()})</span>
              <textarea rows={3} className={inputCls} dir="auto" value={data.hero[lang]} onChange={(e) => up((c) => (c.hero[lang] = e.target.value))} placeholder={L("A clear portal showing what changed…", "بوابة توضّح ما الذي تغيّر…")} />
            </label>
            <label className="block max-w-xs">
              <span className={labelCls}>Watermark word</span>
              <input className={inputCls} value={data.accent ?? ""} onChange={(e) => up((c) => (c.accent = e.target.value))} placeholder="e.g. JACK" />
            </label>
          </div>
        )}

        {/* OVERVIEW (dashboard) */}
        {active === "overview" && (
          <div className="space-y-6">
            <div className={card}>
              <h2 className="font-bold mb-4">Headline & reading</h2>
              <label className="block mb-4">
                <span className={labelCls}>One-line summary ({lang.toUpperCase()})</span>
                <input className={inputCls} dir="auto" value={data.dashboard.headline[lang]} onChange={(e) => up((c) => (c.dashboard.headline[lang] = e.target.value))} />
              </label>
              <label className="block">
                <span className={labelCls}>Our reading ({lang.toUpperCase()})</span>
                <textarea rows={3} className={inputCls} dir="auto" value={data.dashboard.diagnosis?.[lang] ?? ""} onChange={(e) => up((c) => { c.dashboard.diagnosis ||= { en: "", ar: "" }; c.dashboard.diagnosis[lang] = e.target.value; })} />
              </label>
            </div>

            <div className={card}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold">Story cards</h2>
                <button className="text-sm font-semibold text-orange hover:text-orange-deep" onClick={() => up((c) => c.dashboard.cards.push({ tag: "", value: "", desc: "" }))}>+ Add card</button>
              </div>
              <div className="space-y-3">
                {data.dashboard.cards.map((sc, i) => (
                  <div key={i} className="grid sm:grid-cols-[1fr_1fr_2fr_auto] gap-2 items-start rounded-xl border border-neutral-200 p-3">
                    <input className={inputCls} placeholder="Tag" value={sc.tag} onChange={(e) => up((c) => (c.dashboard.cards[i].tag = e.target.value))} />
                    <input className={inputCls} placeholder="Value" value={sc.value} onChange={(e) => up((c) => (c.dashboard.cards[i].value = e.target.value))} />
                    <input className={inputCls} placeholder="Story" value={sc.desc} onChange={(e) => up((c) => (c.dashboard.cards[i].desc = e.target.value))} />
                    <button className="text-neutral-400 hover:text-red-600 text-sm px-2 py-2" onClick={() => up((c) => c.dashboard.cards.splice(i, 1))} aria-label="Remove">✕</button>
                  </div>
                ))}
                {data.dashboard.cards.length === 0 && <p className="text-sm text-neutral-400">No cards yet.</p>}
              </div>
            </div>

            <div className={card}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold">Account health</h2>
                <button className="text-sm font-semibold text-orange hover:text-orange-deep" onClick={() => up((c) => c.dashboard.vitals.push({ label: "", pct: 50, note: "" }))}>+ Add vital</button>
              </div>
              <div className="space-y-3">
                {data.dashboard.vitals.map((v, i) => (
                  <div key={i} className="grid sm:grid-cols-[1.5fr_2fr_1fr_auto] gap-2 items-center rounded-xl border border-neutral-200 p-3">
                    <input className={inputCls} placeholder="Label" value={v.label} onChange={(e) => up((c) => (c.dashboard.vitals[i].label = e.target.value))} />
                    <input type="range" min={0} max={100} value={v.pct} className="accent-orange" onChange={(e) => up((c) => (c.dashboard.vitals[i].pct = Number(e.target.value)))} />
                    <input className={inputCls} placeholder="Note" value={v.note} onChange={(e) => up((c) => (c.dashboard.vitals[i].note = e.target.value))} />
                    <button className="text-neutral-400 hover:text-red-600 text-sm px-2 py-2" onClick={() => up((c) => c.dashboard.vitals.splice(i, 1))} aria-label="Remove">✕</button>
                  </div>
                ))}
                {data.dashboard.vitals.length === 0 && <p className="text-sm text-neutral-400">No vitals yet.</p>}
              </div>
            </div>
          </div>
        )}

        {/* PLAN */}
        {active === "plan" && (
          <div className={card}>
            <h2 className="font-bold mb-4">Plan</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block"><span className={labelCls}>Plan name</span><input className={inputCls} value={data.plan.name} onChange={(e) => up((c) => (c.plan.name = e.target.value))} /></label>
              <label className="flex items-center gap-2 mt-6"><input type="checkbox" checked={!!data.plan.active} onChange={(e) => up((c) => (c.plan.active = e.target.checked))} /> <span className="text-sm font-medium">Active</span></label>
              <label className="block"><span className={labelCls}>Start</span><input className={inputCls} value={data.plan.start} onChange={(e) => up((c) => (c.plan.start = e.target.value))} placeholder="Feb 26" /></label>
              <label className="block"><span className={labelCls}>End (blank = ongoing)</span><input className={inputCls} value={data.plan.end} onChange={(e) => up((c) => (c.plan.end = e.target.value))} /></label>
              <label className="block"><span className={labelCls}>Money left</span><input className={inputCls} value={data.plan.balance ?? ""} onChange={(e) => up((c) => (c.plan.balance = e.target.value))} placeholder="600 ILS" /></label>
              <label className="block"><span className={labelCls}>Plan document URL</span><input className={inputCls} value={data.plan.notionUrl ?? ""} onChange={(e) => up((c) => (c.plan.notionUrl = e.target.value))} placeholder="https://notion.so/…" /></label>
            </div>
            <label className="block mt-4"><span className={labelCls}>Note ({lang.toUpperCase()})</span><textarea rows={2} className={inputCls} dir="auto" value={data.plan.note?.[lang] ?? ""} onChange={(e) => up((c) => { c.plan.note ||= { en: "", ar: "" }; c.plan.note[lang] = e.target.value; })} /></label>
          </div>
        )}

        {/* SOCIAL */}
        {active === "social" && (
          <div className={card}>
            <label className="block mb-4"><span className={labelCls}>Headline ({lang.toUpperCase()})</span><input className={inputCls} dir="auto" value={data.social.headline[lang]} onChange={(e) => up((c) => (c.social.headline[lang] = e.target.value))} /></label>
            <SocialCalendar posts={data.social.posts} editable lang={lang} onChange={(posts) => up((c) => (c.social.posts = posts))} />
          </div>
        )}

        {/* ANALYSIS */}
        {active === "analysis" && (
          <div className="space-y-6">
            <div className={card}>
              <h2 className="font-bold mb-4">Organic</h2>
              <div className="grid sm:grid-cols-2 gap-4 mb-4">
                <label className="block"><span className={labelCls}>Headline ({lang.toUpperCase()})</span><input className={inputCls} dir="auto" value={data.analysis.organic.headline[lang]} onChange={(e) => up((c) => (c.analysis.organic.headline[lang] = e.target.value))} /></label>
                <label className="block"><span className={labelCls}>Reading ({lang.toUpperCase()})</span><input className={inputCls} dir="auto" value={data.analysis.organic.reading?.[lang] ?? ""} onChange={(e) => up((c) => { c.analysis.organic.reading ||= { en: "", ar: "" }; c.analysis.organic.reading[lang] = e.target.value; })} /></label>
              </div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-neutral-700">Metrics</span>
                <button className="text-sm font-semibold text-orange hover:text-orange-deep" onClick={() => up((c) => c.analysis.organic.metrics.push({ label: "", value: "", delta: "", note: "" }))}>+ Add metric</button>
              </div>
              <div className="space-y-3">
                {data.analysis.organic.metrics.map((m, i) => (
                  <div key={i} className="grid sm:grid-cols-[1.3fr_1fr_0.8fr_2fr_auto] gap-2 items-start rounded-xl border border-neutral-200 p-3">
                    <input className={inputCls} placeholder="Metric (Views)" value={m.label} onChange={(e) => up((c) => (c.analysis.organic.metrics[i].label = e.target.value))} />
                    <input className={inputCls} placeholder="Number" value={m.value ?? ""} onChange={(e) => up((c) => (c.analysis.organic.metrics[i].value = e.target.value))} />
                    <input className={inputCls} placeholder="+312%" value={m.delta ?? ""} onChange={(e) => up((c) => (c.analysis.organic.metrics[i].delta = e.target.value))} />
                    <input className={inputCls} placeholder="What it means" value={m.note} onChange={(e) => up((c) => (c.analysis.organic.metrics[i].note = e.target.value))} />
                    <button className="text-neutral-400 hover:text-red-600 text-sm px-2 py-2" onClick={() => up((c) => c.analysis.organic.metrics.splice(i, 1))} aria-label="Remove">✕</button>
                  </div>
                ))}
                {data.analysis.organic.metrics.length === 0 && <p className="text-sm text-neutral-400">No metrics yet.</p>}
              </div>
            </div>

            <div className={card}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold">Paid campaigns</h2>
                <button className="text-sm font-semibold text-orange hover:text-orange-deep" onClick={() => up((c) => c.analysis.paid.campaigns.push({ name: "", period: "", type: "", spend: "", reach: "", impressions: "", freq: "", cpm: "", desc: "" }))}>+ Add campaign</button>
              </div>
              <div className="grid sm:grid-cols-2 gap-4 mb-4">
                <label className="block"><span className={labelCls}>Total spend</span><input className={inputCls} value={data.analysis.paid.spend} onChange={(e) => up((c) => (c.analysis.paid.spend = e.target.value))} placeholder="$292" /></label>
                <label className="block"><span className={labelCls}>Note ({lang.toUpperCase()})</span><input className={inputCls} dir="auto" value={data.analysis.paid.note[lang]} onChange={(e) => up((c) => (c.analysis.paid.note[lang] = e.target.value))} /></label>
              </div>
              <div className="space-y-3">
                {data.analysis.paid.campaigns.map((cm, i) => (
                  <div key={i} className="rounded-xl border border-neutral-200 p-3 space-y-2 relative">
                    <button className="absolute top-2 right-2 text-neutral-400 hover:text-red-600 text-sm" onClick={() => up((c) => c.analysis.paid.campaigns.splice(i, 1))} aria-label="Remove">✕</button>
                    <div className="grid sm:grid-cols-3 gap-2">
                      <input className={inputCls} placeholder="Name" value={cm.name} onChange={(e) => up((c) => (c.analysis.paid.campaigns[i].name = e.target.value))} />
                      <input className={inputCls} placeholder="Period" value={cm.period} onChange={(e) => up((c) => (c.analysis.paid.campaigns[i].period = e.target.value))} />
                      <input className={inputCls} placeholder="Type" value={cm.type} onChange={(e) => up((c) => (c.analysis.paid.campaigns[i].type = e.target.value))} />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      <input className={inputCls} placeholder="Spend" value={cm.spend} onChange={(e) => up((c) => (c.analysis.paid.campaigns[i].spend = e.target.value))} />
                      <input className={inputCls} placeholder="Reach" value={cm.reach} onChange={(e) => up((c) => (c.analysis.paid.campaigns[i].reach = e.target.value))} />
                      <input className={inputCls} placeholder="Impr." value={cm.impressions} onChange={(e) => up((c) => (c.analysis.paid.campaigns[i].impressions = e.target.value))} />
                      <input className={inputCls} placeholder="Freq." value={cm.freq} onChange={(e) => up((c) => (c.analysis.paid.campaigns[i].freq = e.target.value))} />
                      <input className={inputCls} placeholder="CPM" value={cm.cpm} onChange={(e) => up((c) => (c.analysis.paid.campaigns[i].cpm = e.target.value))} />
                    </div>
                    <input className={inputCls} placeholder="Description" value={cm.desc} onChange={(e) => up((c) => (c.analysis.paid.campaigns[i].desc = e.target.value))} />
                  </div>
                ))}
                {data.analysis.paid.campaigns.length === 0 && <p className="text-sm text-neutral-400">No campaigns yet.</p>}
              </div>
            </div>
          </div>
        )}

        {/* FINANCE */}
        {active === "finance" && (
          <div className={card}>
            <h2 className="font-bold mb-4">Finance</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block"><span className={labelCls}>Monthly fee (marketing)</span><input className={inputCls} value={data.finance.monthlyFee} onChange={(e) => up((c) => (c.finance.monthlyFee = e.target.value))} placeholder="1,800 ILS" /></label>
              <label className="block"><span className={labelCls}>Branding fee (fixed)</span><input className={inputCls} value={data.finance.brandingFee ?? ""} onChange={(e) => up((c) => (c.finance.brandingFee = e.target.value))} placeholder="2,500 ILS" /></label>
              <label className="block sm:col-span-2"><span className={labelCls}>Paid · {data.finance.progress ?? 0}%</span><input type="range" min={0} max={100} value={data.finance.progress ?? 0} className="w-full accent-orange" onChange={(e) => up((c) => (c.finance.progress = Number(e.target.value)))} /></label>
            </div>
          </div>
        )}

        {/* DOCUMENTS + ASSETS */}
        {active === "documents" && (
          <div className="space-y-6">
            <div className={card}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold">Documents</h2>
                <button className="text-sm font-semibold text-orange hover:text-orange-deep" onClick={() => up((c) => c.documents.push({ title: "", type: "PDF", url: "" }))}>+ Add document</button>
              </div>
              <div className="space-y-3">
                {data.documents.map((doc, i) => (
                  <div key={i} className="grid sm:grid-cols-[2fr_0.7fr_2fr_auto] gap-2 items-center rounded-xl border border-neutral-200 p-3">
                    <input className={inputCls} placeholder="Title" value={doc.title} onChange={(e) => up((c) => (c.documents[i].title = e.target.value))} />
                    <input className={inputCls} placeholder="Type" value={doc.type} onChange={(e) => up((c) => (c.documents[i].type = e.target.value))} />
                    <div className="flex items-center gap-2">
                      <input className={inputCls} placeholder="https://…" value={doc.url} onChange={(e) => up((c) => (c.documents[i].url = e.target.value))} />
                      <FileUpload accept="application/pdf,image/*" label="Upload" compact onUploaded={({ url, name, contentType }) => up((c) => { c.documents[i].url = url; if (!c.documents[i].title) c.documents[i].title = name.replace(/\.[^.]+$/, ""); c.documents[i].type = contentType.includes("pdf") ? "PDF" : c.documents[i].type || "File"; })} />
                    </div>
                    <button className="text-neutral-400 hover:text-red-600 text-sm px-2 py-2" onClick={() => up((c) => c.documents.splice(i, 1))} aria-label="Remove">✕</button>
                  </div>
                ))}
                {data.documents.length === 0 && <p className="text-sm text-neutral-400">No documents yet.</p>}
              </div>
            </div>

            <div className={card}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold">Brand assets</h2>
                <button className="text-sm font-semibold text-orange hover:text-orange-deep" onClick={() => up((c) => (c.assets ||= []).push({ title: "", type: "PNG", url: "" }))}>+ Add asset</button>
              </div>
              <div className="space-y-3">
                {(data.assets ?? []).map((a, i) => (
                  <div key={i} className="grid sm:grid-cols-[2fr_0.7fr_2fr_auto] gap-2 items-center rounded-xl border border-neutral-200 p-3">
                    <input className={inputCls} placeholder="Title" value={a.title} onChange={(e) => up((c) => (c.assets[i].title = e.target.value))} />
                    <input className={inputCls} placeholder="Type" value={a.type} onChange={(e) => up((c) => (c.assets[i].type = e.target.value))} />
                    <div className="flex items-center gap-2">
                      <input className={inputCls} placeholder="https://…" value={a.url} onChange={(e) => up((c) => (c.assets[i].url = e.target.value))} />
                      <FileUpload accept="image/*,application/pdf,application/zip" label="Upload" compact onUploaded={({ url, name, contentType }) => up((c) => { c.assets[i].url = url; if (!c.assets[i].title) c.assets[i].title = name.replace(/\.[^.]+$/, ""); c.assets[i].type = contentType.includes("pdf") ? "PDF" : contentType.includes("zip") ? "ZIP" : contentType.startsWith("image/") ? "IMG" : c.assets[i].type || "File"; })} />
                    </div>
                    <button className="text-neutral-400 hover:text-red-600 text-sm px-2 py-2" onClick={() => up((c) => c.assets.splice(i, 1))} aria-label="Remove">✕</button>
                  </div>
                ))}
                {(data.assets ?? []).length === 0 && <p className="text-sm text-neutral-400">No assets yet.</p>}
              </div>
            </div>
          </div>
        )}

        {/* ACTIVITY */}
        {active === "activity" && (
          <div className={card}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold">Activity feed</h2>
              <button className="text-sm font-semibold text-orange hover:text-orange-deep" onClick={() => up((c) => (c.updates ||= []).unshift({ at: new Date().toISOString().slice(0, 10), kind: "note", title: { en: "", ar: "" }, body: { en: "", ar: "" } }))}>+ Add update</button>
            </div>
            <div className="space-y-3">
              {(data.updates ?? []).map((u, i) => (
                <div key={i} className="grid sm:grid-cols-[0.8fr_1.4fr_2fr_auto] gap-2 items-start rounded-xl border border-neutral-200 p-3">
                  <input className={inputCls} value={(u.at || "").slice(0, 10)} onChange={(e) => up((c) => (c.updates[i].at = e.target.value))} placeholder="2026-06-13" />
                  <input className={inputCls} dir="auto" value={u.title?.[lang] ?? ""} onChange={(e) => up((c) => { c.updates[i].title ||= { en: "", ar: "" }; c.updates[i].title[lang] = e.target.value; })} placeholder={`Title (${lang.toUpperCase()})`} />
                  <input className={inputCls} dir="auto" value={u.body?.[lang] ?? ""} onChange={(e) => up((c) => { c.updates[i].body ||= { en: "", ar: "" }; c.updates[i].body[lang] = e.target.value; })} placeholder={`Details (${lang.toUpperCase()})`} />
                  <button className="text-neutral-400 hover:text-red-600 text-sm px-2 py-2" onClick={() => up((c) => c.updates.splice(i, 1))} aria-label="Remove">✕</button>
                </div>
              ))}
              {(data.updates ?? []).length === 0 && <p className="text-sm text-neutral-400">No updates yet.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
