import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Reusable JSON-schema fragments for the portal content (bilingual fields).
const bi = {
  type: "object",
  additionalProperties: false,
  properties: { en: { type: "string" }, ar: { type: "string" } },
  required: ["en", "ar"],
};

// The tool schema mirrors ClientData in lib/clients.ts.
const PORTAL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    hero: bi,
    accent: { type: "string", description: "Short uppercase watermark word, e.g. a first name" },
    plan: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string" },
        active: { type: "boolean" },
        start: { type: "string" },
        end: { type: "string" },
        notionUrl: { type: "string" },
        note: bi,
      },
      required: ["name", "active", "start", "end", "notionUrl", "note"],
    },
    dashboard: {
      type: "object",
      additionalProperties: false,
      properties: {
        headline: bi,
        diagnosis: bi,
        cards: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: { tag: { type: "string" }, value: { type: "string" }, desc: { type: "string" } },
            required: ["tag", "value", "desc"],
          },
        },
        vitals: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: { label: { type: "string" }, pct: { type: "number" }, note: { type: "string" } },
            required: ["label", "pct", "note"],
          },
        },
      },
      required: ["headline", "diagnosis", "cards", "vitals"],
    },
    social: {
      type: "object",
      additionalProperties: false,
      properties: {
        headline: bi,
        items: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: { title: { type: "string" }, desc: { type: "string" }, tag: { type: "string" } },
            required: ["title", "desc", "tag"],
          },
        },
      },
      required: ["headline", "items"],
    },
    analysis: {
      type: "object",
      additionalProperties: false,
      properties: {
        organic: {
          type: "object",
          additionalProperties: false,
          properties: {
            headline: bi,
            reading: bi,
            metrics: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: { label: { type: "string" }, before: { type: "string" }, after: { type: "string" }, note: { type: "string" } },
                required: ["label", "before", "after", "note"],
              },
            },
          },
          required: ["headline", "reading", "metrics"],
        },
        paid: {
          type: "object",
          additionalProperties: false,
          properties: {
            spend: { type: "string" },
            note: bi,
            campaigns: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  name: { type: "string" }, period: { type: "string" }, type: { type: "string" }, spend: { type: "string" },
                  reach: { type: "string" }, impressions: { type: "string" }, freq: { type: "string" }, cpm: { type: "string" }, desc: { type: "string" },
                },
                required: ["name", "period", "type", "spend", "reach", "impressions", "freq", "cpm", "desc"],
              },
            },
          },
          required: ["spend", "note", "campaigns"],
        },
      },
      required: ["organic", "paid"],
    },
    invoices: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          cycle: { type: "string" }, desc: { type: "string" }, amount: { type: "string" },
          status: { type: "string", enum: ["paid", "due", "overdue"] },
        },
        required: ["cycle", "desc", "amount", "status"],
      },
    },
    documents: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { title: { type: "string" }, type: { type: "string" }, url: { type: "string" } },
        required: ["title", "type", "url"],
      },
    },
  },
  required: ["hero", "accent", "plan", "dashboard", "social", "analysis", "invoices", "documents"],
} as const;

const SYSTEM = `You build client portal content for Marker Studio, a bilingual (English + Arabic) creative & marketing studio in Palestine.

Given a client's name and a pasted brief or analytics report, produce a complete, polished portal in BOTH English and Arabic by calling the build_portal tool.

Rules:
- Every bilingual field needs natural, professional Arabic (not a literal machine translation) AND English.
- Pull real numbers from the report into the metrics, vitals (0–100), campaigns, and invoices. If a number isn't given, leave the field empty rather than inventing it.
- Keep copy concise and on-brand: confident, results-focused, no fluff.
- For URLs you don't have (notionUrl, document urls), use an empty string.
- vitals.pct is an integer 0–100 estimating account health per label.
- Always return all fields; use empty strings/arrays where you have nothing.`;

// Diagnostic: visit this route in the browser (while signed in) to confirm the
// key reached this deployment. Returns booleans only — never the key itself.
export async function GET() {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    keyPresent: !!process.env.ANTHROPIC_API_KEY,
    vercelEnv: process.env.VERCEL_ENV || "unknown",
  });
}

export async function POST(req: NextRequest) {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: `ANTHROPIC_API_KEY is not set for this deployment (environment: ${process.env.VERCEL_ENV || "unknown"}). Add it for THAT environment in Vercel → Settings → Environment Variables, then redeploy.` },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const prompt = String(body.prompt || "").trim();
  const clientName = String(body.clientName || "").trim();
  if (!prompt) return NextResponse.json({ error: "Describe the client / paste a report first." }, { status: 400 });

  const client = new Anthropic();
  try {
    const message = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 16000,
      system: SYSTEM,
      tools: [
        {
          name: "build_portal",
          description: "Return the full bilingual portal content for this client.",
          input_schema: PORTAL_SCHEMA as unknown as Anthropic.Tool["input_schema"],
        },
      ],
      tool_choice: { type: "tool", name: "build_portal" },
      messages: [
        {
          role: "user",
          content: `Client name: ${clientName || "(unspecified)"}\n\nBrief / report:\n${prompt}`,
        },
      ],
    });

    const toolUse = message.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return NextResponse.json({ error: "The model did not return portal data. Try again with more detail." }, { status: 502 });
    }
    return NextResponse.json({ data: toolUse.input });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `Claude API error (${err.status}): ${err.message}` }, { status: 502 });
    }
    return NextResponse.json({ error: "Generation failed. Please try again." }, { status: 500 });
  }
}
