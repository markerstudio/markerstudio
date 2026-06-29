"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession, canSeePhotographer } from "@/lib/auth";
import { updatePhotoBlock, type PhotoSessionStatus, type PhotoTaskStatus } from "@/lib/clients";

const SESSION_STATES: PhotoSessionStatus[] = ["planned", "confirmed", "shot", "delivered"];
const TASK_STATES: PhotoTaskStatus[] = ["todo", "doing", "done"];

// Both actions are usable by any admin and by the photographers — but never by a
// partner-only account (Ramzi). They edit only the photo block (via updatePhotoBlock,
// a scoped jsonb_set write), targeting the row by its stable id and falling back to
// index for legacy rows not yet re-saved — so a concurrent settings edit is never
// clobbered and a reordered list never flips the wrong row.
async function guard() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (!canSeePhotographer(user)) redirect("/admin");
}

// Revalidate everywhere a shoot/shot status is shown: the photographer portal,
// the client's own portal, and the admin client editor.
function revalidatePhoto(slug: string) {
  revalidatePath("/admin/photographer");
  revalidatePath(`/portal/${slug}`);
  revalidatePath(`/admin/clients/${slug}/edit`);
}

export async function setShotStatusById(formData: FormData) {
  await guard();
  const slug = String(formData.get("slug") || "").trim();
  const id = String(formData.get("id") || "").trim();
  const idx = Number(formData.get("idx") ?? -1);
  const status = String(formData.get("status") || "") as PhotoTaskStatus;
  if (!slug || !TASK_STATES.includes(status)) redirect("/admin/photographer");
  await updatePhotoBlock(slug, (photo) => {
    const shots = photo.shots ?? [];
    const shot = (id && shots.find((x) => x.id === id)) || shots[idx];
    if (shot) shot.status = status;
  });
  revalidatePhoto(slug);
}

export async function setSessionStatusById(formData: FormData) {
  await guard();
  const slug = String(formData.get("slug") || "").trim();
  const id = String(formData.get("id") || "").trim();
  const idx = Number(formData.get("idx") ?? -1);
  const status = String(formData.get("status") || "") as PhotoSessionStatus;
  if (!slug || !SESSION_STATES.includes(status)) redirect("/admin/photographer");
  await updatePhotoBlock(slug, (photo) => {
    const sessions = photo.sessions ?? [];
    const session = (id && sessions.find((x) => x.id === id)) || sessions[idx];
    if (session) session.status = status;
  });
  revalidatePhoto(slug);
}
