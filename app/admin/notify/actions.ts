"use server";

// Send a push from the admin Notify panel: to yourself (test), all admins,
// all clients, or one client's devices.
import { getSession, isPartnerOnly, isPhotographerOnly } from "@/lib/auth";
import { isPushConfigured, sendPushTo, type PushTarget } from "@/lib/push";

export type SendPushInput = {
  title: string;
  body?: string;
  url?: string;
  target: "me" | "admins" | "clients" | `client:${number}` | string;
};

export type SendPushResult = { ok: boolean; sent?: number; failed?: number; devices?: number; error?: string };

export async function sendPushAction(input: SendPushInput): Promise<SendPushResult> {
  const user = await getSession();
  if (!user || user.role === "client") return { ok: false, error: "Not signed in." };
  if (isPartnerOnly(user) || isPhotographerOnly(user)) return { ok: false, error: "No access." };
  if (!isPushConfigured()) return { ok: false, error: "Push isn’t configured — set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY." };

  const title = String(input.title || "").trim().slice(0, 120);
  if (!title) return { ok: false, error: "Write a title first." };
  const body = String(input.body || "").trim().slice(0, 400) || undefined;
  const rawUrl = String(input.url || "").trim();
  // Only same-site destinations — a push must never send a client off-site.
  const url = rawUrl ? (rawUrl.startsWith("/") ? rawUrl : null) : undefined;
  if (url === null) return { ok: false, error: "The link must be a path on the site (starts with /)." };

  let target: PushTarget;
  const t = String(input.target || "me");
  if (t === "me") target = { kind: "me", userId: user.id };
  else if (t === "admins") target = { kind: "admins" };
  else if (t === "clients") target = { kind: "clients" };
  else if (t.startsWith("client:")) {
    const id = Number(t.slice(7));
    if (!Number.isFinite(id)) return { ok: false, error: "Pick a client." };
    target = { kind: "client", clientId: id };
  } else return { ok: false, error: "Pick who to notify." };

  const res = await sendPushTo(target, { title, body, url });
  if (res.devices === 0) {
    return {
      ok: false,
      ...res,
      error:
        t === "me"
          ? "This account has no subscribed devices yet — tap “Enable on this device” first."
          : "No subscribed devices for that audience yet — they need to enable notifications once.",
    };
  }
  return { ok: true, ...res };
}
