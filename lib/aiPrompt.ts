// Pure helpers for the AI analysis — building the prompt, sanitizing, and
// parsing a result. No SDK import, so safe in client components and the server
// action alike. lib/ai.ts (the API path) reuses the digest + system here.
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

export const ANALYSIS_SYSTEM = `You are a senior strategist AND designer at Marker Studio, a bilingual (English/Arabic) creative & marketing studio in Palestine. You design the analysis a client sees in their private portal.

From a JSON digest of one client's real performance data, design a visually rich, self-contained analysis as an HTML fragment. Be creative and let the data drive the layout — use stat tiles, cards, comparison tables, progress bars, and inline SVG charts (bar, pie/donut, line, gauge) wherever they make the story clearer.

Hard rules:
- Output an HTML FRAGMENT only — no <html>/<head>/<body>, no <script>, no <style> blocks, no external images, fonts, or CSS. Use inline style="" attributes and inline <svg> for every chart (compute the geometry yourself).
- Ground everything in the numbers provided. Never invent metrics. If data is thin, present what exists cleanly rather than padding.
- Brand palette: Marker Orange #FF9100 (hover #E07E00), charcoal #303030, ink #1A1A1A, cream #F5F2EC, white cards. Rounded corners 12–18px, subtle borders (#E8E8E8), generous spacing, modern and uncluttered.
- Responsive: width:100%; use flex/grid with wrap; no fixed widths over ~560px; charts should use viewBox and width:100% so they scale.
- Provide BOTH an English fragment (LTR) and an Arabic fragment (set dir="rtl" on the root, native Modern Standard Arabic — not a translation). The two should be the same design, localized.
- Tone in copy: clear, candid, a little bold. No emoji.`;

const ANALYSIS_SHAPE = `{
  "html": {
    "en": "<div style=\\"...\\"> ...English analysis with cards & inline <svg> charts... </div>",
    "ar": "<div dir=\\"rtl\\" style=\\"...\\"> ...نفس التصميم بالعربية... </div>"
  }
}`;

// The full prompt to paste into any external AI (Claude.ai, ChatGPT, …).
export function buildAnalysisPrompt(client: Client): string {
  return `${ANALYSIS_SYSTEM}

Return ONLY a JSON object — no markdown fences, no commentary — in EXACTLY this shape (the values are HTML fragment strings, properly JSON-escaped):
${ANALYSIS_SHAPE}

Client performance digest:
${JSON.stringify(buildAnalysisDigest(client), null, 2)}`;
}

// Strip anything unsafe from AI-produced HTML before it is rendered: scripts,
// style/iframe/object/embed/link/meta tags, inline event handlers, and
// javascript: URLs. Inline styles and inline SVG are preserved.
export function sanitizeHtml(html: string): string {
  return (html || "")
    .replace(/<\s*(script|style|iframe|object|embed|link|meta|base)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|style|iframe|object|embed|link|meta|base)\b[^>]*\/?>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/((?:href|src|xlink:href)\s*=\s*)("|')\s*javascript:[^"']*\2/gi, '$1$2#$2');
}

// Leniently parse a pasted result into an AiAnalysis (tolerates code fences and
// surrounding prose). Returns null without at least one language of HTML.
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
    const h = o?.html ?? o;
    const en = typeof h?.en === "string" ? h.en : "";
    const ar = typeof h?.ar === "string" ? h.ar : "";
    if (!en && !ar) return null;
    return { html: { en: sanitizeHtml(en || ar), ar: sanitizeHtml(ar || en) }, generatedAt: new Date().toISOString() };
  } catch {
    return null;
  }
}
