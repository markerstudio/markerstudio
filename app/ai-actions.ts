"use server";

// Admin-only: generate the AI analysis for a client and store it on the portal.
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { isAiEnabled, generateClientAnalysis } from "@/lib/ai";
import { parseAiAnalysis } from "@/lib/aiPrompt";
import type { AiAnalysis, Client, ClientData } from "@/lib/clients";

async function loadClient(slug: string): Promise<Client | undefined> {
  const rows = (await getSql()`SELECT id, slug, name, logo, color, data FROM clients WHERE slug = ${slug} LIMIT 1`) as unknown as Client[];
  return rows[0];
}

async function storeAnalysis(client: Client, ai: AiAnalysis): Promise<{ ok: boolean; error?: string }> {
  const data = (client.data || {}) as ClientData;
  data.analysis = data.analysis || { organic: { headline: { en: "", ar: "" }, metrics: [] }, paid: { spend: "", note: { en: "", ar: "" }, campaigns: [] } };
  data.analysis.ai = ai;
  try {
    await getSql()`UPDATE clients SET data = ${JSON.stringify(data)}::jsonb, updated_at = now() WHERE id = ${client.id}`;
  } catch {
    return { ok: false, error: "Database write failed." };
  }
  revalidatePath(`/portal/${client.slug}`);
  return { ok: true };
}

export async function generateAiAnalysis(slug: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await getSession())) return { ok: false, error: "unauthorized" };
  if (!isAiEnabled()) return { ok: false, error: "AI isn't connected — set ANTHROPIC_API_KEY, or use the copy-paste prompt instead." };

  const client = await loadClient(slug);
  if (!client) return { ok: false, error: "Client not found." };

  let ai;
  try {
    ai = await generateClientAnalysis(client);
  } catch (e) {
    console.error("[ai] generation failed:", e);
    return { ok: false, error: "Generation failed — check the API key and try again." };
  }
  return storeAnalysis(client, ai);
}

// External path: admin pastes JSON produced by any AI from the copied prompt.
export async function saveManualAiAnalysis(slug: string, raw: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await getSession())) return { ok: false, error: "unauthorized" };
  const ai = parseAiAnalysis(raw);
  if (!ai) return { ok: false, error: "Couldn't read that — paste the full JSON the prompt asks for." };
  const client = await loadClient(slug);
  if (!client) return { ok: false, error: "Client not found." };
  return storeAnalysis(client, ai);
}

export async function clearAiAnalysis(slug: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await getSession())) return { ok: false, error: "unauthorized" };
  const client = await loadClient(slug);
  if (!client) return { ok: false, error: "Client not found." };
  const data = (client.data || {}) as ClientData;
  if (data.analysis) delete data.analysis.ai;
  try {
    await getSql()`UPDATE clients SET data = ${JSON.stringify(data)}::jsonb, updated_at = now() WHERE id = ${client.id}`;
  } catch {
    return { ok: false, error: "Database write failed." };
  }
  revalidatePath(`/portal/${slug}`);
  return { ok: true };
}
