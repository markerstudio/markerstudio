"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { saveClient } from "@/app/admin/actions";
import { toCSV, fromCSV } from "@/lib/portalCsv";
import SocialCalendar from "@/components/SocialCalendar";
import FileUpload from "@/components/FileUpload";
import { blankClientData, computeClientFinance, type Client, type ClientData, type LocalizedText, type Vital, type StoryCard, type MetricRow, type Campaign, type Invoice, type DocItem } from "@/lib/clients";

const input = "w-full border border-neutral-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange/40 focus:border-orange";
const lbl = "block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1";

const fmtIls = (n: number) => `${Math.round(n).toLocaleString("en-US")} ILS`;

// A payment amount is stored as one string ("1,800 ILS" / "$50"); the editor
// works in a number + currency, so split it on load and recompose on change.
function splitAmount(s: string): { num: string; cur: "ILS" | "USD" } {
  return { num: (s || "").match(/[\d.,]+/)?.[0] || "", cur: /\$|usd/i.test(s || "") ? "USD" : "ILS" };
}
function joinAmount(num: string, cur: "ILS" | "USD"): string {
  const clean = (num || "").trim();
  return !clean ? "" : cur === "USD" ? `$${clean}` : `${clean} ILS`;
}

// Normalise whatever the AI put in a bilingual field — a {en,ar} object, or a
// bare string (treated as English) — into a LocalizedText. Returns undefined
// when there's nothing usable so callers can skip empty fields.
function coerceLT(v: unknown): LocalizedText | undefined {
  if (v == null) return undefined;
  if (typeof v === "string") return v.trim() ? { en: v, ar: "" } : undefined;
  if (typeof v === "object") {
    const o = v as { en?: unknown; ar?: unknown };
    const en = typeof o.en === "string" ? o.en : "";
    const ar = typeof o.ar === "string" ? o.ar : "";
    return en || ar ? { en, ar } : undefined;
  }
  return undefined;
}

// AI prompt scoped to the ANALYTICS section only — built from the analysis rows
// of the CSV so the AI returns just those, and we merge only analysis back in.
function analyticsPrompt(data: ClientData): string {
  const full = toCSV(data).replace(/^﻿/, "");
  const lines = full.split("\r\n");
  const csv = [lines[0], ...lines.filter((l) => l.startsWith("analysis."))].join("\n");
  return `You are a senior social media analyst at Marker Studio® writing the ANALYTICS section of a bilingual (English + Arabic) client report, from the raw Meta Ads Manager / Instagram Insights export pasted below.

Your job is NOT to dump numbers — it's to choose the numbers that matter and say what each one MEANS for the client, in warm plain language they actually understand.

Below is a CSV with columns: field,en,ar,value. Fill ONLY these analysis rows:

ORGANIC — analysis.organic.*
- analysis.organic.headline: one short line that captures the month's story (fill BOTH en and ar — natural Arabic, never literal translation).
- analysis.organic.metrics[n]: pick the 4–8 numbers that actually tell the story (Views, Reach, Profile visits, Follows, Link clicks, Interactions, Watch time…). For each:
  - .label = the metric name, short ("Views")
  - .value = the headline number exactly as in the export, formatted ("301,274")
  - .delta = the change vs the previous period when the export shows one ("+312%", "×4", "−12%") — leave blank if unknown, NEVER invent it
  - .note  = ONE sentence in plain words: what this number means and why the client should care ("More people are discovering you without paid push" — not "impressions increased")
- analysis.organic.reading: 2–3 sentences (en + ar): the overall story — what worked, what didn't, and what the numbers say should happen next.

PAID — analysis.paid.*
- analysis.paid.spend: total ad spend as shown ("$292.22").
- analysis.paid.note: one bilingual line on how the campaigns worked together as a sequence.
- analysis.paid.campaigns[n]: one per campaign — name, period, type (Awareness/Traffic/Engagement/Followers…), spend, reach, impressions, freq, cpm, and .desc = one line on what this campaign achieved in the bigger picture.

Rules:
- Numbers come from the export EXACTLY — never invent or estimate a number.
- Every en/ar pair gets BOTH languages, written like a human strategist, not a dashboard.
- Add rows by copying a line and increasing the [n] index; keep the "field" column EXACTLY as-is.
- Output ONLY the CSV (header + rows). No commentary, no code fences.

=== PASTE YOUR META / INSTAGRAM EXPORT BELOW THIS LINE ===
[paste the analytics export here]

=== ANALYTICS CSV TO FILL ===
${csv}`;
}

// AI prompt scoped to the SOCIAL MEDIA PLAN only — builds the content calendar
// as CSV rows we merge back into social.posts.
function socialPrompt(data: ClientData): string {
  const full = toCSV(data).replace(/^﻿/, "");
  const lines = full.split("\r\n");
  const csv = [lines[0], ...lines.filter((l) => l.startsWith("social."))].join("\n");
  return `You are planning a one-month SOCIAL MEDIA CONTENT CALENDAR for a Marker Studio client, returning it as CSV.

Below is a CSV with columns: field,en,ar,value. Fill ONLY the social rows:
- social.headline = a short bilingual title for the plan (fill BOTH "en" and "ar", natural Arabic).
- social.posts[n] = one row-group per planned post, with:
  - .date  = ISO date YYYY-MM-DD
  - .type = post | story | reel (lowercase). If the plan includes "daily stories", add a story on most days.
  - .platform = Instagram / TikTok / Facebook / LinkedIn …
  - .title = the post idea / hook (English is fine)
  - .notes = goal or format (e.g. Carousel, Engagement, Trust)
  - .brief = the type-specific brief: for a post the caption + key message + visual direction; for a reel a short hook + scene-by-scene script + audio; for a story the frame-by-frame direction (polls, stickers, CTA).
  - .status = planned | scheduled | posted
- Add as many posts as the plan needs by copying a post group and increasing the [n] index (start at 0). Keep the "field" column EXACTLY.
- Aim for a realistic, varied month (mix of platforms, formats, and goals). Use real-looking dates spread across the month.
- Output ONLY the CSV (header + rows). No commentary, no code fences.

=== BRIEF (audience, goals, services, tone) ===
[describe the client and what this month should achieve here]

=== SOCIAL CSV TO FILL ===
${csv}`;
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

export default function ClientForm({ client, projectLogos = [] }: { client?: Client; projectLogos?: { slug: string; name: string; logo: string }[] }) {
  const [data, setData] = useState<ClientData>(client?.data ?? blankClientData());
  const patch = (p: Partial<ClientData>) => setData((d) => ({ ...d, ...p }));
  // Money left & paid % are derived, never hand-typed. We persist the computed
  // figures into plan.balance / finance.progress so the portal reads them too.
  const fin = useMemo(() => computeClientFinance(data), [data]);
  // When linked to Notion, Notion owns plan.balance & finance.progress (shown
  // read-only at the top of the client page). Don't recompute and clobber them
  // from the local payment-history rows on save — that two-way fight is what
  // made the numbers drift. Unlinked clients keep the local auto-computation.
  const linkedToNotion = !!client?.data?.notionPageId;
  const persisted = useMemo<ClientData>(
    () =>
      linkedToNotion
        ? data
        : {
            ...data,
            plan: { ...data.plan, balance: fmtIls(fin.moneyLeftIls) },
            finance: { ...data.finance, progress: fin.paidPct },
          },
    [data, fin, linkedToNotion]
  );
  const [color, setColor] = useState(client?.color ?? "#303030");
  const [logo, setLogo] = useState(client?.logo ?? "");
  const [csvMsg, setCsvMsg] = useState("");
  const [aiCopied, setAiCopied] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [socialCopied, setSocialCopied] = useState(false);
  const [socialPaste, setSocialPaste] = useState("");
  const [socialMsg, setSocialMsg] = useState("");
  const [portalJson, setPortalJson] = useState("");
  const [portalMsg, setPortalMsg] = useState("");
  const hasOnboarding = !!client?.data?.onboarding;
  const formRef = useRef<HTMLFormElement>(null);

  function copyPrompt() {
    navigator.clipboard?.writeText(analyticsPrompt(data));
    setAiCopied(true);
    setTimeout(() => setAiCopied(false), 1800);
  }
  function applyPaste() {
    try {
      const parsed = fromCSV(pasteText);
      setData((d) => ({ ...d, analysis: parsed.analysis })); // merge analytics only
      setCsvMsg("Analytics filled ✓ — review below, then Save changes.");
      setPasteText("");
    } catch {
      setCsvMsg("Couldn't read that — paste the CSV the AI returned (the field,en,ar,value table).");
    }
  }
  function copySocialPrompt() {
    navigator.clipboard?.writeText(socialPrompt(data));
    setSocialCopied(true);
    setTimeout(() => setSocialCopied(false), 1800);
  }
  function applySocialPaste() {
    try {
      const parsed = fromCSV(socialPaste);
      setData((d) => ({ ...d, social: parsed.social })); // merge social plan only
      setSocialMsg("Calendar filled ✓ — review on the calendar above, then Save changes.");
      setSocialPaste("");
    } catch {
      setSocialMsg("Couldn't read that — paste the CSV the AI returned (the field,en,ar,value table).");
    }
  }

  // Take the JSON the onboarding "Copy AI prompt" produces (accent, hero,
  // dashboard headline/diagnosis/cards, proposal summary) and merge each section
  // it understands into the form. Tolerant: code fences are stripped, bilingual
  // fields accept a string or {en,ar}, unknown keys are ignored.
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
    const next: ClientData = { ...data, dashboard: { ...data.dashboard } };

    if (typeof obj.accent === "string" && obj.accent.trim()) { next.accent = obj.accent.trim(); filled.push("watermark"); }
    const hero = coerceLT(obj.hero);
    if (hero) { next.hero = hero; filled.push("hero"); }

    const dash = obj.dashboard;
    if (dash && typeof dash === "object" && !Array.isArray(dash)) {
      const d = dash as Record<string, unknown>;
      const headline = coerceLT(d.headline);
      if (headline) { next.dashboard.headline = headline; filled.push("dashboard headline"); }
      const diagnosis = coerceLT(d.diagnosis);
      if (diagnosis) { next.dashboard.diagnosis = diagnosis; filled.push("diagnosis"); }
      if (Array.isArray(d.cards)) {
        const cards: StoryCard[] = d.cards
          .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
          .map((c) => ({ tag: String(c.tag ?? ""), value: String(c.value ?? ""), desc: String(c.desc ?? "") }))
          .filter((c) => c.tag || c.value || c.desc);
        if (cards.length) { next.dashboard.cards = cards; filled.push(`${cards.length} story card${cards.length > 1 ? "s" : ""}`); }
      }
    }

    if (typeof obj.proposalSummary === "string" && obj.proposalSummary.trim()) {
      next.proposal = { ...data.proposal, note: obj.proposalSummary.trim() };
      filled.push("proposal summary");
    }

    if (!filled.length) {
      setPortalMsg("Parsed OK, but found no portal fields — expected accent / hero / dashboard.");
      return;
    }
    setData(next);
    setPortalMsg(`Filled ${filled.join(", ")} ✓ — review below, then Save changes.`);
    setPortalJson("");
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
      <input type="hidden" name="data" value={JSON.stringify(persisted)} />

      <Group title="Identity">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
          <div><label className={lbl}>Slug</label><input name="slug" defaultValue={client?.slug} required pattern="[a-z0-9-]+" className={input} placeholder="dr-jack-sabat" /></div>
          <div><label className={lbl}>Client name</label><input name="name" defaultValue={client?.name} required className={input} placeholder="Dr. Jack Sabat" /></div>
          <div>
            <label className={lbl}>Owner</label>
            <select className={input} value={data.owner || "marker"} onChange={(e) => patch({ owner: e.target.value as "marker" | "ramzi" })}>
              <option value="marker">Marker</option>
              <option value="ramzi">Ramzi (partner)</option>
            </select>
            <p className="text-[11px] text-neutral-400 mt-1">Ramzi&apos;s clients are visible only to Ramzi and the super admin.</p>
          </div>
          <div className="md:col-span-2">
            <label className={lbl}>Logo</label>
            <input type="hidden" name="logo" value={logo} />
            <div className="flex items-start gap-3 flex-wrap">
              <div className="h-14 w-14 shrink-0 rounded-lg border border-neutral-200 bg-neutral-900 flex items-center justify-center overflow-hidden">
                {logo
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={logo} alt="" className="max-h-[80%] max-w-[80%] object-contain" />
                  : <span className="text-[10px] text-neutral-500">No logo</span>}
              </div>
              <div className="flex-1 min-w-[220px] space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <FileUpload accept="image/*" label="Upload image" onUploaded={({ url }) => setLogo(url)} />
                  {projectLogos.length > 0 && (
                    <select
                      className={`${input} max-w-[230px]`}
                      value=""
                      onChange={(e) => { if (e.target.value) setLogo(e.target.value); }}
                    >
                      <option value="">Pick from posted projects…</option>
                      {projectLogos.filter((p) => p.logo).map((p) => (
                        <option key={p.slug} value={p.logo}>{p.name}</option>
                      ))}
                    </select>
                  )}
                  {logo && <button type="button" onClick={() => setLogo("")} className="text-xs font-medium text-neutral-400 hover:text-red-600">Clear</button>}
                </div>
                <input value={logo} onChange={(e) => setLogo(e.target.value)} className={input} placeholder="…or paste a logo URL" />
              </div>
            </div>
          </div>
          <div>
            <label className={lbl}>Brand colour</label>
            <div className="flex items-center gap-2">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 rounded border border-neutral-300 bg-white p-1" aria-label="Brand colour" />
              <input name="color" value={color} onChange={(e) => setColor(e.target.value)} className={input} />
            </div>
          </div>
        </div>
      </Group>

      {hasOnboarding && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-6">
          <h2 className="font-bold mb-1">✨ Fill the portal from the onboarding AI</h2>
          <p className="text-sm text-neutral-600 mb-3">
            <b>1.</b> Use <b>Copy AI prompt</b> above and run it in ChatGPT / Claude.
            <b> 2.</b> Paste the AI&apos;s JSON reply below and Apply — it fills the
            <b> Hero</b> and <b>Dashboard</b> (headline, diagnosis, story cards) here. Then Save.
          </p>
          <textarea value={portalJson} onChange={(e) => setPortalJson(e.target.value)} rows={5} className={input} placeholder={'Paste the AI\'s JSON reply here… (starts with "{")'} dir="ltr" />
          <div className="mt-2 flex items-center gap-3">
            <button type="button" onClick={applyPortalJson} className="bg-orange text-white font-semibold rounded-md px-4 py-2 text-sm hover:bg-orange-deep transition-colors">Apply portal content</button>
            {portalMsg && <span className="text-sm text-neutral-700">{portalMsg}</span>}
          </div>
        </div>
      )}

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

      <Group title="Finance" hint="Money left and Paid % calculate themselves from the payments below (USD converted to ILS). Set Total agreed and mark each payment Paid as it comes in — leave Total blank to derive it from the rows. Fees are reference only. Stories fee is collected for Ramzi: it stays on the client's invoice but never counts as Marker income or syncs to Notion.">
        {linkedToNotion && (
          <div className="mb-4 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600 leading-relaxed">
            Linked to <b>Notion</b> — its Budget Tracker owns this client&apos;s money. <b>Money left</b> and <b>Paid&nbsp;%</b>{" "}
            come from <b>Refresh from Notion</b> (top of the page); the figures below are a local portal copy and saving
            here won&apos;t change them. The <b>Stories&nbsp;· Ramzi</b> fee is app-only and is managed here.
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-x-6 gap-y-4 mb-5">
          <Text label="Monthly fee (marketing)" value={data.finance?.monthlyFee ?? ""} onChange={(monthlyFee) => patch({ finance: { ...data.finance, monthlyFee, progress: data.finance?.progress ?? 0 } })} placeholder="e.g. 1,800 ILS" />
          <Text label="Branding fee (fixed)" value={data.finance?.brandingFee ?? ""} onChange={(brandingFee) => patch({ finance: { ...data.finance, monthlyFee: data.finance?.monthlyFee ?? "", progress: data.finance?.progress ?? 0, brandingFee } })} placeholder="e.g. 2,500 ILS" />
          <Text label="Total agreed" value={data.finance?.totalAgreed ?? ""} onChange={(totalAgreed) => patch({ finance: { ...data.finance, monthlyFee: data.finance?.monthlyFee ?? "", progress: data.finance?.progress ?? 0, totalAgreed } })} placeholder="e.g. 2,425 ILS" />
          <Text label="Stories fee · Ramzi" value={data.finance?.storiesFee ?? ""} onChange={(storiesFee) => patch({ finance: { ...data.finance, monthlyFee: data.finance?.monthlyFee ?? "", progress: data.finance?.progress ?? 0, storiesFee } })} placeholder="e.g. 30 ILS / day" />
          <div>
            <label className={lbl}>Money left · auto</label>
            <div className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-bold tabular-nums text-orange-deep">{fmtIls(fin.moneyLeftIls)}</div>
          </div>
        </div>
        <label className="flex items-start gap-3 text-sm mb-5 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
          <input
            type="checkbox"
            className="custom-checkbox mt-0.5"
            checked={!!data.finance?.storiesActive}
            onChange={(e) => patch({ finance: { ...data.finance, monthlyFee: data.finance?.monthlyFee ?? "", progress: data.finance?.progress ?? 0, storiesActive: e.target.checked } })}
          />
          <span className="leading-relaxed">
            <b>This client has stories</b> (Ramzi). Turning this on connects them to <b>Ramzi&apos;s portal</b>, where he
            tracks the stories work and what&apos;s been collected. Stories money stays on the client&apos;s invoice and in
            the client&apos;s combined total, but is never Marker income or synced to Notion.
          </span>
        </label>
        <div className="mb-5">
          <div className="flex items-center justify-between mb-1">
            <span className={lbl + " mb-0"}>Paid · auto</span>
            <span className="text-sm font-bold tabular-nums text-neutral-900">{fin.paidPct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-neutral-100 overflow-hidden">
            <div className="h-full rounded-full bg-orange" style={{ width: `${fin.paidPct}%` }} />
          </div>
          <p className="text-[11px] text-neutral-400 mt-1 tabular-nums">
            {fmtIls(fin.paidIls)} paid of {fmtIls(fin.totalIls)} total
            {fin.openIls > 0 ? ` · ${fmtIls(fin.openIls)} still due in rows` : ""}
          </p>
        </div>
        <label className={lbl}>Payment history</label>
        <Rows<Invoice> items={data.invoices} onChange={(invoices) => patch({ invoices })} blank={{ cycle: "", desc: "", amount: "", status: "paid" }} addLabel="Add payment"
          render={(inv, set) => {
            const { num, cur } = splitAmount(inv.amount);
            return (
              <div className="grid grid-cols-2 md:grid-cols-[1fr_120px_96px_110px] gap-3 pr-16 items-end">
                <div className="col-span-2 md:col-span-1"><Text label="Cycle" value={inv.cycle} onChange={(cycle) => set({ cycle })} placeholder="Cycle 01 · Feb → Mar" /></div>
                <div>
                  <label className={lbl}>Amount</label>
                  <input className={`${input} text-right tabular-nums`} inputMode="decimal" value={num} placeholder="1,800" onChange={(e) => set({ amount: joinAmount(e.target.value, cur) })} />
                </div>
                <div>
                  <label className={lbl}>Currency</label>
                  <select className={input} value={cur} onChange={(e) => set({ amount: joinAmount(num, e.target.value as "ILS" | "USD") })}>
                    <option value="ILS">ILS ₪</option>
                    <option value="USD">USD $</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Status</label>
                  <select className={input} value={inv.status} onChange={(e) => set({ status: e.target.value as Invoice["status"] })}>
                    <option value="paid">Paid</option><option value="due">Due</option><option value="overdue">Overdue</option>
                  </select>
                </div>
                <div className="col-span-2 md:col-span-4"><Text label="Description (optional)" value={inv.desc} onChange={(desc) => set({ desc })} /></div>
              </div>
            );
          }} />
      </Group>

      <Group title="Dashboard" hint="The Dashboard is an auto quick-view (plan, money left, next post, top result). You just set a one-line headline and a few optional health bars.">
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
      </Group>

      <Group title="Social Media Plan" hint="Click a day on the calendar to add or edit posts — or fill the whole month with AI below.">
        <Bi label="Headline" value={data.social.headline} onChange={(headline) => patch({ social: { ...data.social, headline } })} />
        <SocialCalendar posts={data.social.posts} editable lang="en" onChange={(posts) => patch({ social: { ...data.social, posts } })} />

        <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 mt-5">
          <h3 className="font-bold mb-1">✨ Fill the calendar with AI</h3>
          <p className="text-sm text-neutral-600 mb-3">
            <b>1.</b> Copy the prompt. <b>2.</b> Paste it into ChatGPT / Claude with a short brief.
            <b> 3.</b> Paste the AI&apos;s reply below and Apply — it fills the <b>calendar above</b>. Then Save.
          </p>
          <button type="button" onClick={copySocialPrompt} className="bg-orange text-white font-semibold rounded-md px-4 py-2 text-sm hover:bg-orange-deep transition-colors mb-3">
            {socialCopied ? "Copied ✓" : "Copy social plan prompt"}
          </button>
          <textarea value={socialPaste} onChange={(e) => setSocialPaste(e.target.value)} rows={5} className={input} placeholder="Paste the AI's CSV reply here…" dir="ltr" />
          <div className="mt-2 flex items-center gap-3">
            <button type="button" onClick={applySocialPaste} className="border border-neutral-300 rounded-md px-4 py-2 text-sm font-medium hover:bg-neutral-50">Apply calendar</button>
            {socialMsg && <span className="text-sm text-neutral-700">{socialMsg}</span>}
          </div>
        </div>
      </Group>

      <div className="bg-orange-50 border border-orange-200 rounded-xl p-6">
        <h2 className="font-bold mb-1">✨ Fill analytics with AI</h2>
        <p className="text-sm text-neutral-600 mb-3">
          <b>1.</b> Copy the prompt. <b>2.</b> Paste it into ChatGPT / Claude with your Meta / Instagram export.
          <b> 3.</b> Paste the AI&apos;s reply below and Apply — it fills only the <b>Analysis</b> fields below. Then Save.
        </p>
        <button type="button" onClick={copyPrompt} className="bg-orange text-white font-semibold rounded-md px-4 py-2 text-sm hover:bg-orange-deep transition-colors mb-3">
          {aiCopied ? "Copied ✓" : "Copy analytics prompt"}
        </button>
        <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={5} className={input} placeholder="Paste the AI's CSV reply here…" dir="ltr" />
        <div className="mt-2 flex items-center gap-3">
          <button type="button" onClick={applyPaste} className="border border-neutral-300 rounded-md px-4 py-2 text-sm font-medium hover:bg-neutral-50">Apply analytics</button>
          {csvMsg && <span className="text-sm text-neutral-700">{csvMsg}</span>}
        </div>
      </div>

      <Group title="Analysis — Organic">
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

      <Group title="Documents" hint="Proposal, agreement, etc. Upload a PDF (or image) or paste a link — clients can open / download these.">
        <Rows<DocItem> items={data.documents} onChange={(documents) => patch({ documents })} blank={{ title: "", type: "PDF", url: "" }} addLabel="Add document"
          render={(doc, set) => (
            <div className="pr-16">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Text label="Title" value={doc.title} onChange={(title) => set({ title })} placeholder="Proposal" />
                <Text label="Type" value={doc.type} onChange={(type) => set({ type })} placeholder="PDF" />
                <Text label="URL" value={doc.url} onChange={(url) => set({ url })} placeholder="https://…" />
              </div>
              <div className="mt-2 flex items-center gap-3 flex-wrap">
                <FileUpload accept="application/pdf,image/*" label="Upload PDF" compact
                  onUploaded={({ url, name, contentType }) => set({ url, title: doc.title || name.replace(/\.[^.]+$/, ""), type: contentType.includes("pdf") ? "PDF" : doc.type || "File" })} />
                {doc.url && <a href={doc.url} target="_blank" rel="noreferrer" className="text-xs font-medium text-neutral-600 hover:text-orange">Open ↗</a>}
              </div>
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
