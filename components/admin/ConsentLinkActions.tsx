"use client";

import { useState } from "react";

/* Share actions for a consent form's signing link: open it (e.g. to hand the
   iPad to a participant), copy it, or send it to a client via WhatsApp or
   email. Built client-side because the absolute URL needs window.origin. */
export default function ConsentLinkActions({ token, label }: { token: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}/consent/${token}`;
  const message = `Marker Studio® — please review and sign this photo/video consent form: ${url}`;

  return (
    <div className="flex items-center gap-3 text-sm whitespace-nowrap">
      <a href={`/consent/${token}`} target="_blank" className="font-semibold text-charcoal hover:text-orange">
        Open ↗
      </a>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="font-medium text-orange hover:text-orange-deep"
      >
        {copied ? "Copied ✓" : "Copy link"}
      </button>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(message)}`}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-neutral-600 hover:text-orange"
      >
        WhatsApp
      </a>
      <a
        href={`mailto:?subject=${encodeURIComponent(`Consent form — ${label}`)}&body=${encodeURIComponent(message)}`}
        className="font-medium text-neutral-600 hover:text-orange"
      >
        Email
      </a>
    </div>
  );
}
