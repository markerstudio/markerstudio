"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { isDbEnabled } from "@/lib/db";
import { deleteCredential } from "@/lib/webauthn";

// Remove a passkey from the signed-in user's account (e.g. a lost device).
export async function removePasskey(formData: FormData) {
  const user = await getSession();
  if (!user) redirect("/login");
  if (!isDbEnabled()) redirect("/account/security");
  const id = Number(formData.get("id") || 0);
  if (id) await deleteCredential(user.id, id);
  revalidatePath("/account/security");
  redirect("/account/security?removed=1");
}
