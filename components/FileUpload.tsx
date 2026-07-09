"use client";

import { useState } from "react";
import { upload } from "@vercel/blob/client";
import { diagnoseUploadError } from "@/lib/uploadClient";

// Small reusable upload button. Streams the file straight to Vercel Blob via the
// /api/upload token route, then hands the public URL back to the caller.
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
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
        contentType: file.type || undefined,
      });
      onUploaded({ url: blob.url, name: file.name, contentType: file.type });
    } catch (e) {
      // Surface the real reason (bad/missing blob token, unsupported type,
      // too large, signed-out) instead of a blanket "failed" — otherwise the
      // upload is impossible to debug from the UI.
      const msg = e instanceof Error ? e.message : "";
      setErr(await diagnoseUploadError(msg ? `Upload failed — ${msg}` : "Upload failed."));
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
