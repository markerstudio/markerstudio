"use client";

// Small "get updates on this device" button for the client portal top bar.
// One tap subscribes the device to Web Push (after that, the studio's Notify
// panel can reach it). Hides itself where push can never work; bilingual.
import { useEffect, useState } from "react";
import { subscribeToPush, pushSupported } from "@/lib/pushClient";

export default function EnablePushButton({ lang = "en" }: { lang?: "en" | "ar" }) {
  const [state, setState] = useState<"idle" | "busy" | "on" | "hidden">("idle");
  const t = (en: string, ar: string) => (lang === "ar" ? ar : en);

  useEffect(() => {
    if (!pushSupported()) {
      setState("hidden");
      return;
    }
    if (Notification.permission === "granted") {
      // Possibly already subscribed — reflect it (and quietly refresh the
      // subscription binding to this account).
      navigator.serviceWorker.getRegistration("/sw.js").then(async (reg) => {
        if (reg && (await reg.pushManager.getSubscription())) setState("on");
      });
    }
  }, []);

  if (state === "hidden") return null;
  if (state === "on") {
    return (
      <span className="ms-push-chip on" title={t("Notifications are on for this device", "الإشعارات مفعّلة على هذا الجهاز")}>
        🔔 {t("On", "مفعّل")}
      </span>
    );
  }
  return (
    <button
      type="button"
      className="ms-push-chip"
      disabled={state === "busy"}
      onClick={async () => {
        setState("busy");
        const r = await subscribeToPush();
        setState(r === "ok" ? "on" : "idle");
      }}
      title={t("Get updates from the studio on this device", "استقبل تحديثات الاستوديو على هذا الجهاز")}
    >
      🔔 {state === "busy" ? "…" : t("Get updates", "فعّل الإشعارات")}
    </button>
  );
}
