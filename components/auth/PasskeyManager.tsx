"use client";

import React, { useState } from "react";
import { Fingerprint, Plus } from "lucide-react";
import { startRegistration } from "@simplewebauthn/browser";

// "Add Face ID / Touch ID on this device" — drives the WebAuthn registration
// ceremony, then reloads so the new passkey shows in the list below.
export function AddPasskeyButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supported = typeof window !== "undefined" && !!window.PublicKeyCredential;

  async function add() {
    setError(null);
    setBusy(true);
    try {
      const optRes = await fetch("/api/webauthn/register/options", { method: "POST" });
      if (!optRes.ok) throw new Error((await optRes.json().catch(() => ({})))?.error || "Could not start.");
      const optionsJSON = await optRes.json();

      const attestation = await startRegistration({ optionsJSON });

      // A friendly label so people can tell their devices apart in the list.
      const label =
        typeof navigator !== "undefined" && /Mac/i.test(navigator.platform)
          ? "Mac (Touch ID / Face ID)"
          : typeof navigator !== "undefined" && /iPhone|iPad/i.test(navigator.userAgent)
          ? "iPhone / iPad (Face ID)"
          : "This device";

      const verifyRes = await fetch("/api/webauthn/register/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response: attestation, label }),
      });
      const data = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok || !data?.ok) throw new Error(data?.error || "Could not add the passkey.");
      window.location.assign("/account/security?added=1");
    } catch (e: unknown) {
      const name = (e as { name?: string })?.name;
      if (name === "NotAllowedError" || name === "AbortError") {
        setError(null);
      } else {
        setError((e as Error)?.message || "Setting up Face ID / Touch ID didn't work.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (!supported) {
    return <p className="text-sm text-charcoal-60">This browser doesn’t support passkeys. Open the app on a device with Touch ID or Face ID.</p>;
  }

  return (
    <div>
      <button
        type="button"
        onClick={add}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-xl bg-orange px-5 py-3 font-semibold text-white transition-colors hover:bg-orange-deep disabled:opacity-60"
      >
        {busy ? <Fingerprint className="h-5 w-5 animate-pulse" /> : <Plus className="h-5 w-5" />}
        {busy ? "Waiting for Face ID / Touch ID…" : "Set up Face ID / Touch ID on this device"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
