"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { restoreSnapshot, withParam } from "@/lib/undo";

// The Undo button in UndoBanner posts here: re-insert the snapshotted rows and
// land back where the delete happened.
export async function undoDeleteAction(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const id = Number(formData.get("id") || 0);
  const back = String(formData.get("back") || "/admin").trim() || "/admin";
  const res = await restoreSnapshot(id);

  if (res.slug) {
    revalidatePath(`/portal/${res.slug}`);
    revalidatePath(`/work/${res.slug}`);
  }
  if (res.kind === "project") revalidatePath("/");
  revalidatePath("/admin/clients");
  revalidatePath("/admin/invoices");

  redirect(withParam(back, res.ok ? "restored" : "undoError", res.ok ? res.label || "1" : "1"));
}
