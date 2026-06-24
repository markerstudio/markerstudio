"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession, canSeePhotographer } from "@/lib/auth";
import { updateClientData, type PhotoSessionStatus, type PhotoTaskStatus } from "@/lib/clients";

const SESSION_STATES: PhotoSessionStatus[] = ["planned", "confirmed", "shot", "delivered"];
const TASK_STATES: PhotoTaskStatus[] = ["todo", "doing", "done"];

// Both actions are usable by any admin and by the photographers — but never by a
// partner-only account (Ramzi). They edit only the photo block, by index, so a
// concurrent settings edit never gets clobbered. Best-effort, then revalidate
// the photographer portal and the client's own portal (the client may see it).
async function guard() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (!canSeePhotographer(user)) redirect("/admin");
}

export async function setShotStatusAction(formData: FormData) {
  await guard();
  const slug = String(formData.get("slug") || "").trim();
  const idx = Number(formData.get("idx") || -1);
  const status = String(formData.get("status") || "") as PhotoTaskStatus;
  if (!slug || idx < 0 || !TASK_STATES.includes(status)) redirect("/admin/photographer");
  await updateClientData(slug, (d) => {
    const shot = d.photo?.shots?.[idx];
    if (shot) shot.status = status;
  });
  revalidatePath("/admin/photographer");
  revalidatePath(`/portal/${slug}`);
}

export async function setSessionStatusAction(formData: FormData) {
  await guard();
  const slug = String(formData.get("slug") || "").trim();
  const idx = Number(formData.get("idx") || -1);
  const status = String(formData.get("status") || "") as PhotoSessionStatus;
  if (!slug || idx < 0 || !SESSION_STATES.includes(status)) redirect("/admin/photographer");
  await updateClientData(slug, (d) => {
    const session = d.photo?.sessions?.[idx];
    if (session) session.status = status;
  });
  revalidatePath("/admin/photographer");
  revalidatePath(`/portal/${slug}`);
}
