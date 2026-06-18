"use client";

import { useState } from "react";
import type { OnboardingBrief } from "@/lib/clients";

// Human-readable Markdown version of the brief — handy to download or paste.
function toMarkdown(b: OnboardingBrief): string {
  const line = (label: string, v?: string | string[] | boolean) => {
    if (v === undefined || v === null || v === "") return "";
    const val = Array.isArray(v) ? v.join(", ") : typeof v === "boolean" ? (v ? "Yes" : "No") : v;
    return val ? `- **${label}:** ${val}\n` : "";
  };
  return (
    `# Onboarding brief — ${b.brandName || "Brand"}\n\n` +
    line("Branding package", b.plan) +
    line("Branding features", b.planFeatures) +
    line("Marketing package", b.marketingPlan) +
    line("Marketing features", b.marketingFeatures) +
    line("Services", b.services) +
    line("Other service", b.servicesOther) +
    line("Contact", `${b.firstName} ${b.lastName}`.trim()) +
    line("Email", b.email) +
    line("Phone", b.phone) +
    line("Location", b.location) +
    line("Brand / company", b.brandName) +
    line("Description", b.brandDescription) +
    line("Logo language", b.logoLanguage) +
    line("Products", b.products) +
    line("Competitors", b.competitors) +
    line("Business goals", b.businessGoals) +
    line("Audience gender", b.audienceGender) +
    line("Audience age", b.audienceAge) +
    line("Online presence", b.onlinePresence) +
    line("Symbol / shape", b.symbolShape) +
    line("Colour in mind", b.colorInMind) +
    line("Which colour", b.colorDetail) +
    line("Exact logo text", b.exactLogoText) +
    line("Tagline / slogan", b.tagline) +
    line("Existing designs", b.existingDesign) +
    line("Additional notes", b.additionalNotes) +
    line("Newsletter", b.newsletter) +
    (b.submittedAt ? `- **Submitted:** ${new Date(b.submittedAt).toLocaleString("en-GB")}\n` : "")
  );
}

// A ready-to-run prompt: feed it (with the JSON) to any AI agent to get portal
// content back, shaped like the portal's `data` object.
function aiPrompt(b: OnboardingBrief): string {
  return (
    `You are a brand strategist at Marker Studio. Analyse this client onboarding brief and produce portal-ready content.\n\n` +
    `Return a single JSON object with these keys, bilingual where shown (Arabic + English), grounded ONLY in the brief:\n` +
    `{\n` +
    `  "accent": "<one short uppercase word for the hero watermark>",\n` +
    `  "hero": { "en": "<1-sentence portal intro>", "ar": "<same in Arabic>" },\n` +
    `  "dashboard": {\n` +
    `    "headline": { "en": "", "ar": "" },\n` +
    `    "diagnosis": { "en": "<2-3 sentence read of where the brand is and the opportunity>", "ar": "" },\n` +
    `    "cards": [ { "tag": "", "value": "", "desc": "" } ]\n` +
    `  },\n` +
    `  "proposalSummary": "<2-3 sentences summarising the recommended scope>",\n` +
    `  "suggestedNextSteps": ["", "", ""]\n` +
    `}\n\n` +
    `Output ONLY the JSON — no commentary. The JSON can be pasted into the portal's content editor.\n\n` +
    `BRIEF (JSON):\n` +
    JSON.stringify(b, null, 2)
  );
}

function download(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const btn = "rounded-md border border-neutral-300 bg-white px-3.5 py-2 text-sm font-medium text-neutral-700 hover:border-neutral-400 hover:text-neutral-900 transition-colors";

export default function OnboardingBriefActions({ brief }: { brief: OnboardingBrief }) {
  const [copied, setCopied] = useState<"json" | "prompt" | null>(null);
  const slugName = (brief.brandName || "brief").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const copy = async (what: "json" | "prompt", text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-6 mb-6 max-w-2xl">
      <h2 className="font-bold mb-1">Process this brief</h2>
      <p className="text-sm text-neutral-500 mb-4">
        Download the raw input, or hand it to an AI agent: <b>Copy AI prompt</b> → run it in ChatGPT / Claude → paste the JSON it returns into the
        <b> “✨ Fill the portal from the onboarding AI”</b> box below to auto-fill the Hero &amp; Dashboard.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn} onClick={() => download(`${slugName}-brief.json`, JSON.stringify(brief, null, 2), "application/json")}>
          ↓ JSON
        </button>
        <button type="button" className={btn} onClick={() => download(`${slugName}-brief.md`, toMarkdown(brief), "text/markdown")}>
          ↓ Markdown
        </button>
        <button type="button" className={btn} onClick={() => copy("json", JSON.stringify(brief, null, 2))}>
          {copied === "json" ? "Copied ✓" : "Copy JSON"}
        </button>
        <button type="button" className={btn} onClick={() => copy("prompt", aiPrompt(brief))}>
          {copied === "prompt" ? "Copied ✓" : "Copy AI prompt"}
        </button>
      </div>
    </div>
  );
}
