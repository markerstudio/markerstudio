"use client";

// The document toolbar: Print (system dialog — print CSS zeroes the page
// margin so browsers can't stamp their headers/footers), a real PDF file
// download, and a PNG snapshot. PDF/PNG capture the page's [data-doc] node
// client-side (lib/docCapture), so they behave identically online and in
// the desktop app — the DMG saves through the native panel; an older app
// build without that bridge falls back to the print dialog.
import { useState } from "react";
import { downloadDocImage, downloadDocPdf } from "@/lib/docCapture";

const BTN =
  "inline-flex h-9 items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-700 hover:border-neutral-400 hover:text-neutral-900 disabled:opacity-60";

export default function PrintButton({
  label,
  basename = "marker-document",
}: {
  label: string;
  /** Filename (without extension) for the PDF / image downloads. */
  basename?: string;
}) {
  const [busy, setBusy] = useState<"pdf" | "png" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = (kind: "pdf" | "png") => async () => {
    if (busy) return;
    setBusy(kind);
    setErr(null);
    try {
      const handled = await (kind === "pdf" ? downloadDocPdf : downloadDocImage)(basename);
      if (!handled) window.print(); // desktop app predating the saveFile bridge
    } catch (e) {
      // Say WHAT failed — a silent fallback taught us (twice) that "nothing
      // happened" is the worst possible error message.
      setErr(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="print:hidden flex flex-wrap items-center justify-end gap-2">
      {err && (
        <p role="alert" className="w-full text-right text-xs font-medium text-rose-700">
          {err} — the Print button still works as a fallback.
        </p>
      )}
      <button type="button" onClick={() => window.print()} className={BTN} title="System print dialog">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" />
        </svg>
        Print
      </button>
      <button type="button" onClick={run("pdf")} disabled={!!busy} className={BTN} title="Download as a PDF file">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
        </svg>
        {busy === "pdf" ? "Preparing…" : label}
      </button>
      <button type="button" onClick={run("png")} disabled={!!busy} className={BTN} title="Download as an image">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
        {busy === "png" ? "Preparing…" : "Image"}
      </button>
    </div>
  );
}
