"use client";

import { useRef, useState, type ReactNode } from "react";
import { upload } from "@vercel/blob/client";
import { UploadCloud } from "lucide-react";
import FileUpload from "@/components/FileUpload";
import { saveSection, addClientDocuments } from "@/app/admin/clients/section-actions";
import { Text, Rows, SaveButton } from "./fields";
import type { ClientData, DocItem } from "@/lib/clients";

// Give an uploaded file a sensible Type chip from its name / MIME.
function typeFor(name: string, contentType: string): string {
  if (contentType.includes("pdf") || /\.pdf$/i.test(name)) return "PDF";
  if (contentType.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg)$/i.test(name)) return "Image";
  if (/\.(docx?|pages)$/i.test(name)) return "DOC";
  if (/\.(xlsx?|csv|numbers)$/i.test(name)) return "Sheet";
  return "File";
}
const titleFor = (name: string) => name.replace(/\.[^.]+$/, "");

// Browsers sometimes report an empty file.type (common for HEIC, some docs).
// Infer a content type from the extension so the upload token accepts it.
function contentTypeFor(file: File): string | undefined {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
    webp: "image/webp", gif: "image/gif", svg: "image/svg+xml", heic: "image/heic",
    heif: "image/heif", avif: "image/avif", tiff: "image/tiff", bmp: "image/bmp",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    csv: "text/csv", txt: "text/plain", zip: "application/zip",
  };
  return map[ext] || "application/octet-stream";
}

// Mirrors the portal's Documents tab: client-facing files, plus (server-rendered)
// the proposal & agreement builder cards passed in as a slot.
export default function DocumentsTab({ slug, data, patch, docsSlot }: { slug: string; data: ClientData; patch: (p: Partial<ClientData>) => void; docsSlot?: ReactNode }) {
  // Existing clients (created before this key existed) may have no documents
  // array — default it so the tab always renders and saves cleanly.
  const docs = data.documents ?? [];

  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [note, setNote] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  // Bulk upload: send every dropped/selected file straight to Blob, append a
  // document row per success, then persist the batch in one atomic append so it
  // saves without waiting for "Save files" (which is what broke adding to an
  // already-populated client before).
  async function bulkUpload(files: FileList | File[] | null) {
    const list = files ? Array.from(files) : [];
    if (!list.length || busy) return;
    setBusy(true);
    setNote(null);
    setProgress({ done: 0, total: list.length });
    const uploaded: DocItem[] = [];
    let failed = 0;
    let firstError = "";
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      try {
        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/upload",
          contentType: contentTypeFor(file),
        });
        uploaded.push({ title: titleFor(file.name), type: typeFor(file.name, file.type), url: blob.url });
      } catch (e) {
        failed++;
        // Keep the real reason (bad/missing BLOB_READ_WRITE_TOKEN, too large,
        // signed out, unsupported type) — a bare count is impossible to debug.
        if (!firstError) firstError = e instanceof Error ? e.message : "";
      }
      setProgress({ done: i + 1, total: list.length });
    }
    if (uploaded.length) {
      patch({ documents: [...docs, ...uploaded] }); // instant UI
      const res = await addClientDocuments(slug, uploaded); // persist (append-only)
      setNote(
        res.ok
          ? { tone: "ok", text: `Added ${uploaded.length} file${uploaded.length === 1 ? "" : "s"}${failed ? ` · ${failed} failed` : ""} — saved.` }
          : { tone: "err", text: res.error || "Uploaded, but saving failed — hit “Save files”." }
      );
    } else {
      setNote({
        tone: "err",
        text: firstError
          ? `Upload failed — ${firstError}`
          : failed
          ? `Couldn’t upload ${failed} file${failed === 1 ? "" : "s"}.`
          : "Nothing to upload.",
      });
    }
    setBusy(false);
    setProgress(null);
  }

  return (
    <div className="space-y-6">
      {docsSlot}

      <section className="lq-card p-5">
        <h2 className="font-display font-bold text-[16px] tracking-tight text-ink mb-1">Client files</h2>
        <p className="text-[12.5px] text-charcoal-60 mb-4">Drop in PDFs or images — several at once — or paste a link. Clients open / download these from their portal.</p>

        {/* Bulk drop zone — select or drag multiple files; each becomes a row and saves right away. */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload files"
          onClick={() => !busy && inputRef.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !busy && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); bulkUpload(e.dataTransfer.files); }}
          className={`flex flex-col items-center justify-center text-center gap-1.5 rounded-2xl border-2 border-dashed px-4 py-8 cursor-pointer transition-colors ${
            drag ? "border-orange bg-orange/5" : "border-charcoal/15 hover:border-orange/60"
          } ${busy ? "opacity-70 pointer-events-none" : ""}`}
        >
          <UploadCloud aria-hidden className="text-orange" size={26} />
          <span className="font-display font-bold text-[14px] text-ink">
            {busy && progress ? `Uploading ${progress.done}/${progress.total}…` : "Drop files here or click to upload"}
          </span>
          <span className="text-[12px] text-charcoal-60">PDF, images, docs — up to 25&nbsp;MB each. Bulk upload supported.</span>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx,.csv"
            className="hidden"
            onChange={(e) => { bulkUpload(e.target.files); e.target.value = ""; }}
            disabled={busy}
          />
        </div>
        {note && <p className={`text-sm mt-2 ${note.tone === "ok" ? "text-emerald-700" : "text-rose-600"}`}>{note.text}</p>}

        <div className="mt-5 mb-2 text-[11px] font-display font-bold uppercase tracking-[0.1em] text-charcoal-40">
          {docs.length ? `${docs.length} file${docs.length === 1 ? "" : "s"} · edit titles, types & links` : "No files yet"}
        </div>
        <Rows<DocItem> items={docs} onChange={(documents) => patch({ documents })} blank={{ title: "", type: "PDF", url: "" }} addLabel="Add document"
          render={(doc, set) => (
            <div className="pr-16">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Text label="Title" value={doc.title} onChange={(title) => set({ title })} placeholder="Proposal" />
                <Text label="Type" value={doc.type} onChange={(type) => set({ type })} placeholder="PDF" />
                <Text label="URL" value={doc.url} onChange={(url) => set({ url })} placeholder="https://…" />
              </div>
              <div className="mt-2 flex items-center gap-3 flex-wrap">
                <FileUpload accept="application/pdf,image/*" label="Replace file" compact
                  onUploaded={({ url, name, contentType }) => set({ url, title: doc.title || titleFor(name), type: contentType.includes("pdf") ? "PDF" : doc.type || "File" })} />
                {doc.url && <a href={doc.url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-charcoal-60 hover:text-orange-deep no-underline">Open ↗</a>}
              </div>
            </div>
          )} />
        <SaveButton onSave={() => saveSection(slug, { documents: data.documents ?? [] })} label="Save files" />
      </section>
    </div>
  );
}
