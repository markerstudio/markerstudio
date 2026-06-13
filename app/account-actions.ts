"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { getSql, isDbEnabled } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { createReset, findUserIdByEmail, getReset, consumeReset } from "@/lib/accounts";

// --- Public: forgot / reset password --------------------------------------

// A client asks to reset their password. We never reveal whether the email
// exists; if it does, we mint a reset token. Without outbound mail the studio
// shares the link (it shows under /admin/accounts), so we also flag the request.
export async function requestReset(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!email || !isDbEnabled()) redirect("/forgot?sent=1");
  try {
    const userId = await findUserIdByEmail(email);
    if (userId) {
      const token = randomBytes(24).toString("base64url");
      await createReset(userId, token);
    }
  } catch {
    /* swallow — never leak whether the account exists */
  }
  redirect("/forgot?sent=1");
}

// The client sets a new password from a reset link.
export async function submitReset(formData: FormData) {
  const token = String(formData.get("token") || "");
  const password = String(formData.get("password") || "");
  if (password.length < 8) redirect(`/reset/${token}?error=input`);

  const reset = await getReset(token);
  if (!reset || !reset.valid) redirect(`/reset/${token}?error=invalid`);

  const hash = await bcrypt.hash(password, 10);
  await getSql()`UPDATE users SET password_hash = ${hash} WHERE id = ${reset.userId}`;
  await consumeReset(reset.id);
  redirect("/login?reset=1");
}

// --- Admin: control client accounts ---------------------------------------

// Generate a reset link for a client login the studio can copy and send.
export async function adminCreateResetLink(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const id = Number(formData.get("id") || 0);
  const rows = (await getSql()`SELECT id FROM users WHERE id = ${id} AND role = 'client' LIMIT 1`) as unknown as { id: number }[];
  if (!rows[0]) redirect("/admin/accounts");
  const token = randomBytes(24).toString("base64url");
  await createReset(id, token);
  revalidatePath("/admin/accounts");
  redirect("/admin/accounts?ok=link");
}

// Set a client login's password directly (when the studio types it for them).
export async function adminSetClientPassword(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const id = Number(formData.get("id") || 0);
  const password = String(formData.get("password") || "");
  if (password.length < 8) redirect("/admin/accounts?error=invalid");
  const rows = (await getSql()`SELECT id FROM users WHERE id = ${id} AND role = 'client' LIMIT 1`) as unknown as { id: number }[];
  if (!rows[0]) redirect("/admin/accounts");
  const hash = await bcrypt.hash(password, 10);
  await getSql()`UPDATE users SET password_hash = ${hash} WHERE id = ${id}`;
  redirect("/admin/accounts?ok=pw");
}

// Revoke an outstanding reset link.
export async function adminRevokeReset(formData: FormData) {
  if (!(await getSession())) redirect("/login");
  const id = Number(formData.get("id") || 0);
  await getSql()`DELETE FROM password_resets WHERE id = ${id}`;
  revalidatePath("/admin/accounts");
  redirect("/admin/accounts?ok=revoked");
}
