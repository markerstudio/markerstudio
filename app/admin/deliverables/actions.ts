"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession, canSeeDeliverables } from "@/lib/auth";
import { updateDeliverablesBlock, saveDeliverablesBlock, type ClientDeliverables, type DeliverableStatus } from "@/lib/clients";

const STATES: DeliverableStatus[] = ["todo", "doing", "review", "done"];

async function guard() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (!canSeeDeliverables(user)) redirect("/admin");
}

// Everywhere a deliverable's status is shown: the cross-client board, the client's
// own portal, and the admin client editor.
function revalidateDeliverable(slug: string) {
  revalidatePath("/admin/deliverables");
  revalidatePath(`/portal/${slug}`);
  revalidatePath(`/admin/clients/${slug}/edit`);
}

// Advance one deliverable's status, targeting by stable id (index fallback for
// legacy rows). Writes only the deliverables subtree (no clobber).
export async function setDeliverableStatusById(formData: FormData) {
  await guard();
  const slug = String(formData.get("slug") || "").trim();
  const id = String(formData.get("id") || "").trim();
  const idx = Number(formData.get("idx") ?? -1);
  const status = String(formData.get("status") || "") as DeliverableStatus;
  if (!slug || !STATES.includes(status)) redirect("/admin/deliverables");
  await updateDeliverablesBlock(slug, (block) => {
    const items = block.items ?? [];
    const item = (id && items.find((x) => x.id === id)) || items[idx];
    if (item) item.status = status;
  });
  revalidateDeliverable(slug);
}

// Save the whole deliverables block for a client (from the editor tab). Generation
// happens client-side (lib/deliverables is pure), so this just persists the result.
export async function saveDeliverablesSection(slug: string, block: ClientDeliverables): Promise<{ ok: boolean; error?: string }> {
  const user = await getSession();
  if (!user) return { ok: false, error: "Not signed in." };
  if (!slug) return { ok: false, error: "Missing client." };
  const ok = await saveDeliverablesBlock(slug, block);
  if (!ok) return { ok: false, error: "Save failed — no database." };
  revalidateDeliverable(slug);
  return { ok: true };
}
