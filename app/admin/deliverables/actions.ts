"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession, canSeeDeliverables } from "@/lib/auth";
import { updateDeliverablesBlock, saveDeliverablesBlock, type ClientDeliverables, type Deliverable, type DeliverableStatus } from "@/lib/clients";
import { updateStudioDeliverables, STUDIO_SLUG } from "@/lib/studio";
import { genId } from "@/lib/deliverables";

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
  if (slug && slug !== STUDIO_SLUG) {
    revalidatePath(`/portal/${slug}`);
    revalidatePath(`/admin/clients/${slug}/edit`);
  }
}

// Mutate the right store: the studio (no-client) list or a client's block.
async function mutateItems(slug: string, mutate: (items: Deliverable[]) => void) {
  if (slug === STUDIO_SLUG) {
    await updateStudioDeliverables(mutate);
  } else {
    await updateDeliverablesBlock(slug, (block) => {
      block.active = block.active ?? true;
      block.items = block.items ?? [];
      mutate(block.items);
    });
  }
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
  await mutateItems(slug, (items) => {
    const item = (id && items.find((x) => x.id === id)) || items[idx];
    if (item) item.status = status;
  });
  revalidateDeliverable(slug);
}

// Add a task from the board — to a specific client, or to the studio (no client).
export async function addDeliverableAction(formData: FormData) {
  await guard();
  const slug = String(formData.get("slug") || "").trim() || STUDIO_SLUG;
  const title = String(formData.get("title") || "").trim();
  const due = String(formData.get("due") || "").trim();
  const detail = String(formData.get("detail") || "").trim();
  const kind = String(formData.get("kind") || "milestone") === "recurring" ? "recurring" : "milestone";
  if (!title) redirect("/admin/deliverables");
  const item: Deliverable = { id: genId(), title, due: due || undefined, detail: detail || undefined, status: "todo", kind, source: "manual" };
  await mutateItems(slug, (items) => { items.push(item); });
  revalidateDeliverable(slug);
  redirect("/admin/deliverables");
}

export async function removeDeliverableAction(formData: FormData) {
  await guard();
  const slug = String(formData.get("slug") || "").trim();
  const id = String(formData.get("id") || "").trim();
  if (!slug || !id) redirect("/admin/deliverables");
  await mutateItems(slug, (items) => {
    const i = items.findIndex((x) => x.id === id);
    if (i >= 0) items.splice(i, 1);
  });
  revalidateDeliverable(slug);
  redirect("/admin/deliverables");
}

// Approve a client-requested task — it becomes a normal tracked deliverable.
export async function approveRequestAction(formData: FormData) {
  await guard();
  const slug = String(formData.get("slug") || "").trim();
  const id = String(formData.get("id") || "").trim();
  if (!slug || slug === STUDIO_SLUG || !id) redirect("/admin/deliverables");
  await updateDeliverablesBlock(slug, (block) => {
    const item = (block.items ?? []).find((x) => x.id === id);
    if (item) item.pending = false;
  });
  revalidateDeliverable(slug);
  redirect("/admin/deliverables");
}

// Reject a client request — removed silently (the client just sees it disappear).
export async function rejectRequestAction(formData: FormData) {
  await guard();
  const slug = String(formData.get("slug") || "").trim();
  const id = String(formData.get("id") || "").trim();
  if (!slug || slug === STUDIO_SLUG || !id) redirect("/admin/deliverables");
  await updateDeliverablesBlock(slug, (block) => {
    block.items = (block.items ?? []).filter((x) => x.id !== id);
  });
  revalidateDeliverable(slug);
  redirect("/admin/deliverables");
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
