"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generateAiAnalysis, saveManualAiAnalysis, clearAiAnalysis } from "@/app/ai-actions";
import { buildAnalysisPrompt } from "@/lib/aiPrompt";
import type { Client } from "@/lib/clients";

// Studio-side controls for the portal's "AI reading". Two ways to produce it:
// one-click via the API (if a key is configured), or copy the prompt into any
// external AI and paste the JSON back. The client only ever sees the result.
export default function AiAnalysisPanel({ client, apiEnabled }: { client: Client; apiEnabled: boolean }) {
  const router = useRouter();
  const ai = client.data.analysis?.ai;
  const [busy, setBusy] = useState<"" | "gen" | "save">("");
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const [paste, setPaste] = useState("");
  const [showPaste, setShowPaste] = useState(false);

  const cls = "w-full border border-neutral-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange/40 focus:border-orange";

  async function generate() {
    setBusy("gen"); setMsg(null);
    const r = await generateAiAnalysis(client.slug);
    setBusy("");
    setMsg({ text: r.ok ? "Analysis generated ✓" : r.error || "Failed.", ok: r.ok });
    if (r.ok) router.refresh();
  }
  async function save() {
    setBusy("save"); setMsg(null);
    const r = await saveManualAiAnalysis(client.slug, paste);
    setBusy("");
    setMsg({ text: r.ok ? "Analysis saved ✓" : r.error || "Failed.", ok: r.ok });
    if (r.ok) { setPaste(""); setShowPaste(false); router.refresh(); }
  }
  async function remove() {
    const r = await clearAiAnalysis(client.slug);
    setMsg({ text: r.ok ? "Removed." : r.error || "Failed.", ok: r.ok });
    if (r.ok) router.refresh();
  }
  function copyPrompt() {
    navigator.clipboard?.writeText(buildAnalysisPrompt(client));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-500">
        The AI designs a bilingual analysis — its own cards, charts, and pie charts — from this client&apos;s numbers,
        shown on their portal&apos;s Analysis tab. Generate it one-click with the API, or copy the prompt into any AI
        (Claude, ChatGPT…) and paste the JSON result back. Pasted HTML is sanitized before it&apos;s shown.
      </p>

      {ai && (
        <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          <span className="font-medium">Analysis is live on the portal.</span>
          <span className="text-green-600">Updated {new Date(ai.generatedAt).toLocaleString("en-GB")}</span>
          <button onClick={remove} className="ml-auto text-xs font-medium text-neutral-500 hover:text-red-600">Remove</button>
        </div>
      )}

      {msg && (
        <p className={`text-sm rounded-md px-3 py-2 border ${msg.ok ? "text-green-700 bg-green-50 border-green-200" : "text-red-600 bg-red-50 border-red-200"}`}>{msg.text}</p>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        {apiEnabled ? (
          <button onClick={generate} disabled={busy === "gen"} className="bg-orange text-white font-semibold rounded-md px-5 py-2.5 text-sm hover:bg-orange-deep transition-colors disabled:opacity-60">
            {busy === "gen" ? "Analyzing…" : ai ? "Regenerate with AI" : "Generate with AI"}
          </button>
        ) : (
          <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            One-click needs <code>ANTHROPIC_API_KEY</code>. Use the copy-paste flow below — same result.
          </span>
        )}
        <button onClick={copyPrompt} className="bg-charcoal text-white font-semibold rounded-md px-4 py-2.5 text-sm hover:bg-ink transition-colors">
          {copied ? "Copied ✓" : "Copy prompt"}
        </button>
        <button onClick={() => setShowPaste((v) => !v)} className="text-sm font-medium text-neutral-600 hover:text-orange">
          {showPaste ? "Hide paste box" : "Paste result"}
        </button>
      </div>

      {showPaste && (
        <div className="space-y-2">
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            rows={6}
            className={`${cls} font-mono text-xs`}
            placeholder='Paste the JSON the AI returned here, then Save…'
          />
          <button onClick={save} disabled={busy === "save" || !paste.trim()} className="bg-orange text-white font-semibold rounded-md px-5 py-2.5 text-sm hover:bg-orange-deep transition-colors disabled:opacity-60">
            {busy === "save" ? "Saving…" : "Save analysis"}
          </button>
        </div>
      )}
    </div>
  );
}
