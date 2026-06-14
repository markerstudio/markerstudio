// AI analysis (API path) — Claude reads a client's portal data and writes a
// sharp, bilingual strategic analysis. Uses Claude Opus 4.8 with structured
// (JSON-schema) output so the bilingual fields come back reliably. The prompt
// itself lives in lib/aiPrompt.ts so the copy-paste path stays in sync.
import Anthropic from "@anthropic-ai/sdk";
import type { AiAnalysis, Client } from "@/lib/clients";
import { ANALYSIS_SYSTEM, buildAnalysisDigest, sanitizeHtml } from "@/lib/aiPrompt";

export function isAiEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    html: {
      type: "object",
      additionalProperties: false,
      properties: { en: { type: "string" }, ar: { type: "string" } },
      required: ["en", "ar"],
    },
  },
  required: ["html"],
} as const;

export async function generateClientAnalysis(client: Client): Promise<AiAnalysis> {
  const anthropic = new Anthropic();
  // Stream (the HTML can be long) and collect the final message.
  const response = await anthropic.messages
    .stream({
      model: "claude-opus-4-8",
      max_tokens: 12000,
      thinking: { type: "adaptive" },
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      system: ANALYSIS_SYSTEM,
      messages: [{ role: "user", content: `Client performance digest:\n${JSON.stringify(buildAnalysisDigest(client), null, 2)}` }],
    })
    .finalMessage();

  const text = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "";
  const parsed = JSON.parse(text) as { html: { en: string; ar: string } };
  return { html: { en: sanitizeHtml(parsed.html.en), ar: sanitizeHtml(parsed.html.ar) }, generatedAt: new Date().toISOString() };
}
