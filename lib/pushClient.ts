// Browser-side Web Push enrolment — shared by the admin notification bell and
// the client portal's enable button. Pure client module (no server imports).

export type PushEnrollResult = "ok" | "unsupported" | "denied" | "unconfigured" | "error";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

// Register the service worker, subscribe this device, and hand the
// subscription to the server tied to the signed-in account.
export async function subscribeToPush(): Promise<PushEnrollResult> {
  if (!pushSupported()) return "unsupported";
  try {
    const keyRes = await fetch("/api/push/vapid", { cache: "no-store" });
    if (!keyRes.ok) return "unconfigured";
    const { key } = (await keyRes.json()) as { key?: string };
    if (!key) return "unconfigured";

    const perm = await Notification.requestPermission();
    if (perm !== "granted") return "denied";

    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ||
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key) as unknown as BufferSource,
      }));

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON(), ua: navigator.userAgent.slice(0, 250) }),
    });
    return res.ok ? "ok" : "error";
  } catch {
    return "error";
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!pushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => undefined);
      await sub.unsubscribe();
    }
  } catch {
    /* nothing to undo */
  }
}
