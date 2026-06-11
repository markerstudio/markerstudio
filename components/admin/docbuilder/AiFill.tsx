"use client";

// "✨ Fill with AI" box for the document builders — same workflow as the
// analytics / social-calendar fillers: copy the prompt, run it in ChatGPT or
// Claude with your material, paste the reply, Apply. Fills the whole document.

import { useState } from "react";

export default function AiFill({
  label,
  buildPrompt,
  onApply,
}: {
  label: string; // "proposal" | "agreement" — for copy
  buildPrompt: () => string;
  onApply: (raw: string) => boolean; // returns false when the reply can't be read
}) {
  const [copied, setCopied] = useState(false);
  const [paste, setPaste] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function copy() {
    navigator.clipboard?.writeText(buildPrompt());
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function apply() {
    if (!paste.trim()) {
      setMsg({ ok: false, text: "Paste the AI's reply first." });
      return;
    }
    if (onApply(paste)) {
      setMsg({ ok: true, text: `Document filled ✓ — review the preview, then Save & Send.` });
      setPaste("");
    } else {
      setMsg({
        ok: false,
        text: "Couldn't read that. Make sure you pasted the JSON itself (it starts with { ). If the AI's reply was cut off, ask it to resend just the JSON — a partial document with only the changed keys also works.",
      });
    }
  }

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
      <h3 className="font-bold text-sm mb-1">✨ Fill the {label} with AI</h3>
      <p className="text-xs text-neutral-600 mb-3 leading-5">
        <b>1.</b> Copy the prompt — it already carries this document and the client&apos;s brief.
        <b> 2.</b> Paste it into ChatGPT / Claude, adding any material (old proposal HTML, pricing, notes).
        <b> 3.</b> Paste the reply below and Apply — every page fills at once.
      </p>
      <button
        type="button"
        onClick={copy}
        className="bg-orange text-white font-semibold rounded-md px-4 py-2 text-sm hover:bg-orange-deep transition-colors mb-2.5"
      >
        {copied ? "Copied ✓" : `Copy ${label} prompt`}
      </button>
      <textarea
        value={paste}
        onChange={(e) => setPaste(e.target.value)}
        rows={4}
        dir="ltr"
        placeholder="Paste the AI's JSON reply here…"
        className="w-full border border-neutral-200 rounded-md px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-orange/30 focus:border-orange bg-white"
      />
      <div className="mt-2 flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={apply}
          className="border border-neutral-300 bg-white rounded-md px-4 py-1.5 text-sm font-medium hover:bg-neutral-50"
        >
          Apply to document
        </button>
        {msg && <span className={`text-xs font-medium ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</span>}
      </div>
    </div>
  );
}
