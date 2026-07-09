"use client";

import { useState } from "react";
import { uploadFile } from "@/lib/uploadClient";

// Small reusable upload button. Sends the file to our /api/upload route (which
// writes it to Vercel Blob), then hands the public URL back to the caller.
export default function FileUpload({
  accept = "image/*,application/pdf",
  label = "Upload",
  compact = false,
  onUploaded,
}: {
  accept?: string;
  label?: string;
  compact?: boolean;
  onUploaded: (file: { url: string; name: string; contentType: string }) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setErr("");
    try {
      const blob = await uploadFile(file);
      onUploaded(blob);
    } catch (e) {
      // Surface the real reason (Blob rejection, too large, signed-out) instead
      // of a blanket "failed" — otherwise the upload is impossible to debug.
      const msg = e instanceof Error ? e.message : "";
      setErr(msg ? `Upload failed — ${msg}` : "Upload failed.");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <label
        className={`cursor-pointer inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white font-medium text-neutral-700 hover:border-orange hover:text-orange transition-colors ${
          compact ? "px-2.5 py-1 text-xs" : "px-3 py-2 text-sm"
        } ${busy ? "opacity-60 pointer-events-none" : ""}`}
      >
        {busy ? "Uploading…" : label}
        <input type="file" accept={accept} className="hidden" onChange={onChange} disabled={busy} />
      </label>
      {err && <span className="text-xs text-red-600 max-w-[260px] break-words">{err}</span>}
    </span>
  );
}
