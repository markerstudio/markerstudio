"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { savePhotoBlock, mergeClientData, updateClientData, type ClientData, type ClientPhoto, type DocItem } from "@/lib/clients";

// Per-section saves for the tabbed client editor. Each writes only the keys its
// tab owns, via a shallow top-level merge (lib/clients mergeClientData → Postgres
// `||`) against the live row — so saving one section can never clobber another, or
// a concurrent photographer-portal edit (the photo key is never in the payload).

function revalidateClient(slug: string) {
  revalidatePath(`/portal/${slug}`);
  revalidatePath(`/admin/clients/${slug}/edit`);
}

// Generic content-section save (Dashboard, Plan, Social, Analysis, Finance,
// Documents). `fields` carries only that section's top-level keys.
export async function saveSection(
  slug: string,
  fields: Partial<ClientData>,
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!slug) return { ok: false, error: "Missing client." };
  const ok = await mergeClientData(slug, fields);
  if (!ok) return { ok: false, error: "Save failed — no database." };
  revalidateClient(slug);
  return { ok: true };
}

// Append newly-uploaded client files to the documents list in one atomic
// read-mutate-write. Used by the Documents tab's bulk uploader so a drop of
// several PDFs persists immediately (and can never clobber the rows a
// concurrent edit already saved — it only ever adds).
export async function addClientDocuments(
  slug: string,
  items: DocItem[],
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!slug) return { ok: false, error: "Missing client." };
  const clean = (items || [])
    .map((it) => {
      const folder = String(it?.folder || "").trim();
      return { title: String(it?.title || "").trim(), type: String(it?.type || "File").trim() || "File", url: String(it?.url || "").trim(), ...(folder ? { folder } : {}) };
    })
    .filter((it) => it.url);
  if (!clean.length) return { ok: false, error: "Nothing to add." };
  await updateClientData(slug, (d) => {
    d.documents = [...(d.documents ?? []), ...clean];
  });
  revalidateClient(slug);
  return { ok: true };
}

// Photography block — saved on its own key (jsonb_set) so it's independent of the
// rest of the form and of the photographer portal.
export async function savePhotoSection(
  slug: string,
  photo: ClientPhoto,
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!slug) return { ok: false, error: "Missing client." };
  const ok = await savePhotoBlock(slug, photo);
  if (!ok) return { ok: false, error: "Save failed — no database." };
  revalidateClient(slug);
  revalidatePath("/admin/photographer");
  return { ok: true };
}

// Identity lives in table columns (slug/name/logo/color) plus the `owner` key, so
// it gets its own form action. Slug rename is supported; logins reference the row
// by id, so they follow automatically.
export async function saveIdentity(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  const original = String(formData.get("originalSlug") || "").trim();
  const slug = String(formData.get("slug") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const logo = String(formData.get("logo") || "").trim();
  const color = String(formData.get("color") || "#303030").trim();
  const owner = (String(formData.get("owner") || "marker") === "ramzi" ? "ramzi" : "marker") as "marker" | "ramzi";
  if (!original || !slug) redirect(`/admin/clients/${original || "new"}/edit?error=invalid&tab=settings`);

  const sql = getSql();
  await sql`
    UPDATE clients
    SET slug = ${slug}, name = ${name}, logo = ${logo}, color = ${color},
        data = COALESCE(data, '{}'::jsonb) || ${JSON.stringify({ owner })}::jsonb,
        updated_at = now()
    WHERE slug = ${original}
  `;
  revalidateClient(slug);
  if (original !== slug) {
    revalidatePath(`/portal/${original}`);
    revalidatePath(`/admin/clients/${original}/edit`);
  }
  redirect(`/admin/clients/${slug}/edit?ok=saved&tab=settings`);
}
