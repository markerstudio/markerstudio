"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession, canSeePartner } from "@/lib/auth";
import { addModelingSession, deleteModelingSession } from "@/lib/modelingSessions";

// Add one modeling session to Ramzi's private ledger. Walled off to Ramzi and
// the super admin — the same guard as the partner page itself.
export async function addModelingSessionAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canSeePartner(session)) redirect("/admin");

  const name = String(formData.get("name") || "").trim();
  const amount = parseFloat(String(formData.get("amount") || "0").replace(/[^0-9.]/g, "")) || 0;
  const currencyRaw = String(formData.get("currency") || "").trim().toUpperCase();
  const currency = currencyRaw === "USD" ? "USD" : "ILS";
  const sessionDate = String(formData.get("sessionDate") || "").trim();
  const note = String(formData.get("note") || "").trim();

  if (!name || amount <= 0) redirect("/admin/partner?error=modeling");

  await addModelingSession({ name, amount, currency, sessionDate: sessionDate || undefined, note: note || undefined });
  revalidatePath("/admin/partner");
  redirect("/admin/partner?ok=modeling-added");
}

export async function deleteModelingSessionAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canSeePartner(session)) redirect("/admin");

  const id = Number(formData.get("id") || 0);
  if (id) await deleteModelingSession(id);
  revalidatePath("/admin/partner");
  redirect("/admin/partner?ok=modeling-removed");
}
