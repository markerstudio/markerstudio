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
    <div className="flex items-center gap-2 text-sm whitespace-nowrap">
      <a href={`/consent/${token}`} target="_blank" className="lq-btn lq-btn--glass lq-btn--sm no-underline">
        Open ↗
      </a>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="lq-btn lq-btn--primary lq-btn--sm"
      >
        {copied ? "Copied ✓" : "Copy link"}
      </button>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(message)}`}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-charcoal-60 hover:text-orange-deep no-underline"
      >
        WhatsApp
      </a>
      <a
        href={`mailto:?subject=${encodeURIComponent(`Consent form — ${label}`)}&body=${encodeURIComponent(message)}`}
        className="font-medium text-charcoal-60 hover:text-orange-deep no-underline"
      >
        Email
      </a>
    </div>
  );
}
