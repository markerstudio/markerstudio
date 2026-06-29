"use client";

import { useState } from "react";
import SocialCalendar from "@/components/SocialCalendar";
import { fromCSV } from "@/lib/portalCsv";
import { saveSection } from "@/app/admin/clients/section-actions";
import { input, Bi, SaveButton } from "./fields";
import { socialPrompt } from "./aiPrompts";
import type { ClientData } from "@/lib/clients";

// Mirrors the portal's Social tab: the plan headline + the interactive calendar.
export default function SocialTab({ slug, data, patch }: { slug: string; data: ClientData; patch: (p: Partial<ClientData>) => void }) {
  const [copied, setCopied] = useState(false);
  const [paste, setPaste] = useState("");
  const [msg, setMsg] = useState("");

  function copy() {
    navigator.clipboard?.writeText(socialPrompt(data));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  function apply() {
    try {
      const parsed = fromCSV(paste);
      patch({ social: parsed.social });
      setMsg("Calendar filled ✓ — review above, then Save.");
      setPaste("");
    } catch {
      setMsg("Couldn't read that — paste the CSV the AI returned (the field,en,ar,value table).");
    }
  }

  return (
    <div className="space-y-6">
      <fieldset className="bg-white border border-neutral-200 rounded-xl p-6">
        <legend className="px-2 -ml-2 font-bold">Social Media Plan</legend>
        <p className="text-xs text-neutral-400 mb-3">Click a day on the calendar to add or edit posts — or fill the whole month with AI below.</p>
        <Bi label="Headline" value={data.social.headline} onChange={(headline) => patch({ social: { ...data.social, headline } })} />
        <SocialCalendar posts={data.social.posts} editable lang="en" onChange={(posts) => patch({ social: { ...data.social, posts } })} />

        <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 mt-5">
          <h3 className="font-bold mb-1">✨ Fill the calendar with AI</h3>
          <p className="text-sm text-neutral-600 mb-3">Copy the prompt, run it with a short brief, then paste the AI&apos;s reply to fill the calendar. Then Save.</p>
          <button type="button" onClick={copy} className="bg-orange text-white font-semibold rounded-md px-4 py-2 text-sm hover:bg-orange-deep transition-colors mb-3">
            {copied ? "Copied ✓" : "Copy social plan prompt"}
          </button>
          <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={5} className={input} placeholder="Paste the AI's CSV reply here…" dir="ltr" />
          <div className="mt-2 flex items-center gap-3">
            <button type="button" onClick={apply} className="border border-neutral-300 rounded-md px-4 py-2 text-sm font-medium hover:bg-neutral-50">Apply calendar</button>
            {msg && <span className="text-sm text-neutral-700">{msg}</span>}
          </div>
        </div>
      </fieldset>

      <SaveButton onSave={() => saveSection(slug, { social: data.social })} />
    </div>
  );
}
