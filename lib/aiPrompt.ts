// Pure helpers for the AI analysis — building the prompt and parsing a result.
// No SDK import here, so this is safe to use in client components and in the
// server action alike. lib/ai.ts (which calls the API) reuses these.
import type { AiAnalysis, Client } from "@/lib/clients";

// Compact, model-friendly digest of the data that drives the analysis.
export function buildAnalysisDigest(client: Client) {
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

export const ANALYSIS_SYSTEM = `You are a senior strategist at Marker Studio, a bilingual (English/Arabic) creative & marketing studio in Palestine. You write the analysis a client sees in their private portal.

Given a JSON digest of one client's real performance data, write a sharp, honest, data-grounded reading. Rules:
- Ground every claim in the numbers provided. Never invent metrics that aren't in the data. If data is thin, say what you'd watch next instead of padding.
- Be specific and confident, not generic. Quote the actual figures.
- Each field needs BOTH English (en) and natural Modern Standard Arabic (ar) — the Arabic must read as written by a native marketer, not a translation.
- headline: one punchy line capturing the story. summary: 2–3 sentences. insights: 3 items (title + one-sentence detail each). recommendations: 2–3 concrete next steps.
- Tone: clear, candid, a little bold. No fluff, no emoji.`;

// Human-readable shape used in the copy-paste prompt (the API path uses a
// strict JSON schema instead).
const ANALYSIS_SHAPE = `{
  "headline":   { "en": "...", "ar": "..." },
  "summary":    { "en": "...", "ar": "..." },
  "insights":   [ { "title": { "en": "...", "ar": "..." }, "detail": { "en": "...", "ar": "..." } } ],
  "recommendations": [ { "en": "...", "ar": "..." } ]
}`;

// The full prompt to paste into any external AI (Claude.ai, ChatGPT, …).
export function buildAnalysisPrompt(client: Client): string {
  return `${ANALYSIS_SYSTEM}

Return ONLY a JSON object — no markdown fences, no commentary — in EXACTLY this shape (insights: exactly 3; recommendations: 2–3):
${ANALYSIS_SHAPE}

Client performance digest:
${JSON.stringify(buildAnalysisDigest(client), null, 2)}`;
}

// Leniently parse a pasted result back into an AiAnalysis (tolerates code
// fences and surrounding prose). Returns null if it doesn't have the essentials.
export function parseAiAnalysis(raw: string): AiAnalysis | null {
  try {
    let t = (raw || "").trim();
    const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) t = fence[1].trim();
    const first = t.indexOf("{");
    const last = t.lastIndexOf("}");
    if (first >= 0 && last > first) t = t.slice(first, last + 1);
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const o = JSON.parse(t) as any;
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const bi = (x: any) => (x && typeof x.en === "string" && typeof x.ar === "string" ? { en: x.en, ar: x.ar } : null);
    const headline = bi(o.headline);
    const summary = bi(o.summary);
    if (!headline || !summary) return null;
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const insights = Array.isArray(o.insights)
      ? o.insights.map((i: any) => ({ title: bi(i?.title), detail: bi(i?.detail) })).filter((i: any) => i.title && i.detail)
      : [];
    const recommendations = Array.isArray(o.recommendations) ? o.recommendations.map(bi).filter(Boolean) : [];
    /* eslint-enable @typescript-eslint/no-explicit-any */
    return { headline, summary, insights, recommendations, generatedAt: new Date().toISOString() };
  } catch {
    return null;
  }
}
