// AI analysis (API path) — Claude reads a client's portal data and writes a
// sharp, bilingual strategic analysis. Uses Claude Opus 4.8 with structured
// (JSON-schema) output so the bilingual fields come back reliably. The prompt
// itself lives in lib/aiPrompt.ts so the copy-paste path stays in sync.
import Anthropic from "@anthropic-ai/sdk";
import type { AiAnalysis, Client } from "@/lib/clients";
import { ANALYSIS_SYSTEM, buildAnalysisDigest } from "@/lib/aiPrompt";

export function isAiEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

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
      items: { type: "object", additionalProperties: false, properties: { title: bi, detail: bi }, required: ["title", "detail"] },
    },
    recommendations: { type: "array", items: bi },
  },
  required: ["headline", "summary", "insights", "recommendations"],
} as const;

export async function generateClientAnalysis(client: Client): Promise<AiAnalysis> {
  const anthropic = new Anthropic();
  const response = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    system: ANALYSIS_SYSTEM,
    messages: [{ role: "user", content: `Client performance digest:\n${JSON.stringify(buildAnalysisDigest(client), null, 2)}` }],
  });

  const text = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "";
  const parsed = JSON.parse(text) as Omit<AiAnalysis, "generatedAt">;
  return { ...parsed, generatedAt: new Date().toISOString() };
}
