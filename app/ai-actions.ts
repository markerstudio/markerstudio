"use server";

// Admin-only: generate the AI analysis for a client and store it on the portal.
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { isAiEnabled, generateClientAnalysis } from "@/lib/ai";
import type { Client, ClientData } from "@/lib/clients";

export async function generateAiAnalysis(slug: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await getSession())) return { ok: false, error: "unauthorized" };
  if (!isAiEnabled()) return { ok: false, error: "AI isn't connected — set ANTHROPIC_API_KEY." };

  const sql = getSql();
  const rows = (await sql`SELECT id, slug, name, logo, color, data FROM clients WHERE slug = ${slug} LIMIT 1`) as unknown as Client[];
  const client = rows[0];
  if (!client) return { ok: false, error: "Client not found." };

  let ai;
  try {
    ai = await generateClientAnalysis(client);
  } catch (e) {
    console.error("[ai] generation failed:", e);
    return { ok: false, error: "Generation failed — check the API key and try again." };
  }

  const data = (client.data || {}) as ClientData;
  data.analysis = data.analysis || { organic: { headline: { en: "", ar: "" }, metrics: [] }, paid: { spend: "", note: { en: "", ar: "" }, campaigns: [] } };
  data.analysis.ai = ai;

  try {
    await sql`UPDATE clients SET data = ${JSON.stringify(data)}::jsonb, updated_at = now() WHERE id = ${client.id}`;
  } catch {
    return { ok: false, error: "Saved analysis but the database write failed." };
  }
  revalidatePath(`/portal/${slug}`);
  return { ok: true };
}
