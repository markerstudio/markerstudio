"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { savePhotoBlock, type ClientPhoto } from "@/lib/clients";

// Per-section saves for the client editor. Each writes ONE subtree of the client's
// JSONB via jsonb_set (see lib/clients setClientDataPath), so saving one section
// can never clobber another section — or a concurrent photographer-portal edit.
// Phase B will add the remaining section savers here alongside savePhotoSection.

export async function savePhotoSection(
  slug: string,
  photo: ClientPhoto,
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!slug) return { ok: false, error: "Missing client." };
  const ok = await savePhotoBlock(slug, photo);
  if (!ok) return { ok: false, error: "Save failed — no database." };
  revalidatePath(`/portal/${slug}`);
  revalidatePath(`/admin/clients/${slug}/edit`);
  revalidatePath("/admin/photographer");
  return { ok: true };
}
