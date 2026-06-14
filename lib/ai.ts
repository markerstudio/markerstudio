// AI analysis — Claude reads a client's portal data and writes a sharp,
// bilingual strategic analysis for the Analysis tab. Uses Claude Opus 4.8 with
// structured (JSON-schema) output so the bilingual fields come back reliably.
import Anthropic from "@anthropic-ai/sdk";
import type { AiAnalysis, Client } from "@/lib/clients";

export function isAiEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

// Bilingual {en, ar} leaf, reused across the schema.
const bi = {
  type: "object",
  additionalProperties: false,
  properties: { en: { type: "string" }, ar: { type: "string" } },
  required: ["en", "ar"],
} as const;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    headline: bi,
    summary: bi,
    insights: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { title: bi, detail: bi },
        required: ["title", "detail"],
      },
    },
    recommendations: { type: "array", items: bi },
  },
  required: ["headline", "summary", "insights", "recommendations"],
} as const;

// Compact, model-friendly digest of the data that drives the analysis.
function digest(client: Client) {
  const d = client.data;
  return {
    brand: client.name,
    plan: { name: d.plan?.name, active: d.plan?.active, cycle: [d.plan?.start, d.plan?.end].filter(Boolean).join(" → ") },
    finance: { monthlyFee: d.finance?.monthlyFee, paidPercent: d.finance?.progress, moneyLeft: d.plan?.balance },
    organic: (d.analysis?.organic?.metrics ?? []).map((m) => ({ metric: m.label, value: m.value || m.after, change: m.delta, note: m.note })),
    paid: {
      totalSpend: d.analysis?.paid?.spend,
      campaigns: (d.analysis?.paid?.campaigns ?? []).map((c) => ({ name: c.name, type: c.type, spend: c.spend, reach: c.reach, impressions: c.impressions, cpm: c.cpm })),
    },
    social: {
      planned: (d.social?.posts ?? []).length,
      byType: (d.social?.posts ?? []).reduce<Record<string, number>>((a, p) => { const t = p.type || "post"; a[t] = (a[t] || 0) + 1; return a; }, {}),
    },
    health: (d.dashboard?.vitals ?? []).map((v) => ({ label: v.label, pct: v.pct, note: v.note })),
  };
}

const SYSTEM = `You are a senior strategist at Marker Studio, a bilingual (English/Arabic) creative & marketing studio in Palestine. You write the analysis a client sees in their private portal.

Given a JSON digest of one client's real performance data, write a sharp, honest, data-grounded reading. Rules:
- Ground every claim in the numbers provided. Never invent metrics that aren't in the data. If data is thin, say what you'd watch next instead of padding.
- Be specific and confident, not generic. Quote the actual figures.
- Each field needs BOTH English (en) and natural Modern Standard Arabic (ar) — the Arabic must read as written by a native marketer, not a translation.
- headline: one punchy line capturing the story. summary: 2–3 sentences. insights: 3 items (title + one-sentence detail each). recommendations: 2–3 concrete next steps.
- Tone: clear, candid, a little bold. No fluff, no emoji.`;

export async function generateClientAnalysis(client: Client): Promise<AiAnalysis> {
  const anthropic = new Anthropic();
  const response = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: "user", content: `Client performance digest:\n${JSON.stringify(digest(client), null, 2)}` }],
  });

  const text = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "";
  const parsed = JSON.parse(text) as Omit<AiAnalysis, "generatedAt">;
  return { ...parsed, generatedAt: new Date().toISOString() };
}
