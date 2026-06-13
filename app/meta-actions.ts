"use server";

// Admin actions for the Meta (Facebook + Instagram) connection. Connecting and
// syncing are studio-only; the token is written to the server-side `client_meta`
// table and never returned to the browser.

import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import { getSession } from "@/lib/auth";
import { getSql } from "@/lib/db";
import {
  saveMetaConnection,
  deleteMetaConnection,
  getMetaConnection,
  fetchMetaAnalysis,
} from "@/lib/meta";
import type { ClientData } from "@/lib/clients";

async function clientIdForSlug(slug: string): Promise<number | null> {
  const rows = (await getSql()`SELECT id FROM clients WHERE slug = ${slug} LIMIT 1`) as unknown as { id: number }[];
  return rows[0]?.id ?? null;
}

// Save (or update) the Page/IG/Ad-account IDs + token for a client.
export async function connectMeta(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const slug = String(formData.get("slug") || "").trim();
  const id = await clientIdForSlug(slug);
  if (!id) redirect("/admin/clients");
  await saveMetaConnection(id, {
    fbPageId: String(formData.get("fbPageId") || ""),
    igUserId: String(formData.get("igUserId") || ""),
    adAccountId: String(formData.get("adAccountId") || ""),
    pageToken: String(formData.get("pageToken") || "").trim(),
  });
  revalidateTag("meta-live");
  redirect(`/admin/clients/${slug}/edit?ok=meta-saved`);
}

// Pull live insights now and persist a snapshot into the portal's Analysis tab,
// so the latest numbers show even if a later live fetch fails.
export async function syncMetaNow(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const slug = String(formData.get("slug") || "").trim();
  const id = await clientIdForSlug(slug);
  if (!id) redirect("/admin/clients");

  const conn = await getMetaConnection(id);
  if (!conn) redirect(`/admin/clients/${slug}/edit?error=meta-none`);

  let analysis;
  try {
    analysis = await fetchMetaAnalysis(conn);
  } catch {
    redirect(`/admin/clients/${slug}/edit?error=meta-fetch`);
  }

  const sql = getSql();
  const rows = (await sql`SELECT data FROM clients WHERE id = ${id} LIMIT 1`) as unknown as { data: ClientData }[];
  if (!rows[0]) redirect("/admin/clients");
  const data = rows[0].data;
  data.analysis = data.analysis || { organic: { headline: { en: "", ar: "" }, metrics: [] }, paid: { spend: "", note: { en: "", ar: "" }, campaigns: [] } };
  if (analysis.organic.length) data.analysis.organic.metrics = analysis.organic;
  if (analysis.campaigns.length) {
    data.analysis.paid.campaigns = analysis.campaigns;
    if (analysis.spend) data.analysis.paid.spend = analysis.spend;
  }

  await sql`UPDATE clients SET data = ${JSON.stringify(data)}::jsonb, updated_at = now() WHERE id = ${id}`;
  revalidateTag("meta-live");
  revalidatePath(`/portal/${slug}`);
  const n = analysis.organic.length + analysis.campaigns.length;
  redirect(`/admin/clients/${slug}/edit?ok=meta-synced-${n}`);
}

export async function disconnectMeta(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const slug = String(formData.get("slug") || "").trim();
  const id = await clientIdForSlug(slug);
  if (!id) redirect("/admin/clients");
  await deleteMetaConnection(id);
  revalidateTag("meta-live");
  redirect(`/admin/clients/${slug}/edit?ok=meta-removed`);
}
