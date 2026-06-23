"use client";

import React, { useEffect, useState } from "react";
import { Fingerprint } from "lucide-react";
import { startAuthentication } from "@simplewebauthn/browser";

// "Sign in with Face ID / Touch ID" — drives the WebAuthn assertion ceremony.
// Purely additive: it only renders when the browser supports passkeys, and any
// failure just surfaces a message and leaves the password form untouched.
export function PasskeyLoginButton() {
  const [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && !!window.PublicKeyCredential);
  }, []);

  if (!supported) return null;

  async function signIn() {
    setError(null);
    setBusy(true);
    try {
      const optRes = await fetch("/api/webauthn/login/options", { method: "POST" });
      if (!optRes.ok) throw new Error((await optRes.json().catch(() => ({})))?.error || "Could not start.");
      const optionsJSON = await optRes.json();

      const assertion = await startAuthentication({ optionsJSON });

      const verifyRes = await fetch("/api/webauthn/login/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response: assertion }),
      });
      const data = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok || !data?.ok) throw new Error(data?.error || "Sign-in failed.");
      window.location.assign(data.redirect || "/admin");
    } catch (e: unknown) {
      // The user cancelling the OS prompt throws — don't shout about that.
      const name = (e as { name?: string })?.name;
      if (name === "NotAllowedError" || name === "AbortError") {
        setError(null);
      } else {
        setError((e as Error)?.message || "Face ID / Touch ID sign-in didn't work.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-element animate-delay-650">
      <div className="relative my-2 flex items-center">
        <div className="flex-grow border-t border-charcoal-20" />
        <span className="mx-3 text-xs uppercase tracking-wide text-charcoal-60">or</span>
        <div className="flex-grow border-t border-charcoal-20" />
      </div>
      <button
        type="button"
        onClick={signIn}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-charcoal-20 bg-white py-3.5 font-semibold text-ink transition-colors hover:border-orange hover:text-orange disabled:opacity-60"
      >
        <Fingerprint className="h-5 w-5" />
        {busy ? "Waiting for Face ID / Touch ID…" : "Sign in with Face ID / Touch ID"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
