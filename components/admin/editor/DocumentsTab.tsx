"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { upload } from "@vercel/blob/client";
import { UploadCloud, GripVertical, FolderPlus, X, Check, Pencil } from "lucide-react";
import FileUpload from "@/components/FileUpload";
import { saveSection, addClientDocuments } from "@/app/admin/clients/section-actions";
import type { ClientData, DocItem } from "@/lib/clients";

// Give an uploaded file a sensible Type chip from its name / MIME.
function typeFor(name: string, contentType: string): string {
  if (contentType.includes("pdf") || /\.pdf$/i.test(name)) return "PDF";
  if (contentType.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg|heic|heif|avif|tiff|bmp)$/i.test(name)) return "Image";
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

const UNGROUPED = "__ungrouped__";
const lbl = "block text-[10px] font-display font-bold uppercase tracking-[0.1em] text-charcoal-40 mb-1";
const inp = "lq-input w-full";

// Mirrors the portal's Documents tab: client-facing files organised into
// folders, drag-to-reorder within/across folders, and bulk upload. All changes
// persist automatically (structural changes immediately; text on blur) so
// nothing is lost by forgetting to hit save.
export default function DocumentsTab({ slug, data, patch, docsSlot }: { slug: string; data: ClientData; patch: (p: Partial<ClientData>) => void; docsSlot?: ReactNode }) {
  // Existing clients (created before these keys existed) may have neither — default
  // both so the tab always renders and saves cleanly.
  const docs = useMemo(() => data.documents ?? [], [data.documents]);
  const folders = useMemo(() => data.docFolders ?? [], [data.docFolders]);

  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [note, setNote] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "err">("idle");
  const [uploadTarget, setUploadTarget] = useState<string>(""); // folder new uploads land in ("" = Ungrouped)
  const [newFolder, setNewFolder] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropHint, setDropHint] = useState<string | null>(null); // folder currently hovered

  // Persist the whole block (documents + folder list). Structural edits call this
  // directly; text edits call it on blur.
  async function persist(nextDocs: DocItem[], nextFolders: string[]) {
    patch({ documents: nextDocs, docFolders: nextFolders });
    setStatus("saving");
    const res = await saveSection(slug, { documents: nextDocs, docFolders: nextFolders });
    setStatus(res.ok ? "saved" : "err");
    if (!res.ok) setNote({ tone: "err", text: res.error || "Save failed." });
  }

  // ---- bulk upload -------------------------------------------------------
  async function bulkUpload(files: FileList | File[] | null) {
    const list = files ? Array.from(files) : [];
    if (!list.length || busy) return;
    setBusy(true);
    setNote(null);
    setProgress({ done: 0, total: list.length });
    const folder = uploadTarget.trim();
    const uploaded: DocItem[] = [];
    let failed = 0;
    let firstError = "";
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      try {
        const blob = await upload(file.name, file, { access: "public", handleUploadUrl: "/api/upload", contentType: contentTypeFor(file) });
        uploaded.push({ title: titleFor(file.name), type: typeFor(file.name, file.type), url: blob.url, ...(folder ? { folder } : {}) });
      } catch (e) {
        failed++;
        if (!firstError) firstError = e instanceof Error ? e.message : "";
      }
      setProgress({ done: i + 1, total: list.length });
    }
    if (uploaded.length) {
      patch({ documents: [...docs, ...uploaded] }); // instant UI
      const res = await addClientDocuments(slug, uploaded); // persist (append-only)
      setNote(
        res.ok
          ? { tone: "ok", text: `Added ${uploaded.length} file${uploaded.length === 1 ? "" : "s"}${folder ? ` to “${folder}”` : ""}${failed ? ` · ${failed} failed` : ""} — saved.` }
          : { tone: "err", text: res.error || "Uploaded, but saving failed — try again." }
      );
    } else {
      setNote({ tone: "err", text: firstError ? `Upload failed — ${firstError}` : failed ? `Couldn’t upload ${failed} file${failed === 1 ? "" : "s"}.` : "Nothing to upload." });
    }
    setBusy(false);
    setProgress(null);
  }

  // ---- folder ops --------------------------------------------------------
  function addFolder() {
    const name = newFolder.trim();
    if (!name || folders.includes(name)) { setNewFolder(""); return; }
    persist(docs, [...folders, name]);
    setUploadTarget(name);
    setNewFolder("");
  }
  function renameFolder(from: string, toRaw: string) {
    const to = toRaw.trim();
    setRenaming(null);
    if (!to || to === from || folders.includes(to)) return;
    persist(
      docs.map((d) => ((d.folder || "") === from ? { ...d, folder: to } : d)),
      folders.map((f) => (f === from ? to : f)),
    );
    if (uploadTarget === from) setUploadTarget(to);
  }
  function deleteFolder(name: string) {
    // Keep the files — just move them back to Ungrouped.
    persist(
      docs.map((d) => ((d.folder || "") === name ? { ...d, folder: undefined } : d)),
      folders.filter((f) => f !== name),
    );
    if (uploadTarget === name) setUploadTarget("");
  }

  // ---- per-doc ops (index into the flat array) ---------------------------
  const setDoc = (idx: number, p: Partial<DocItem>) => patch({ documents: docs.map((d, i) => (i === idx ? { ...d, ...p } : d)) });
  const saveDoc = () => persist(docs, folders); // called on blur / discrete change
  const removeDoc = (idx: number) => persist(docs.filter((_, i) => i !== idx), folders);
  const moveToFolder = (idx: number, folder: string) => persist(docs.map((d, i) => (i === idx ? { ...d, folder: folder || undefined } : d)), folders);

  // ---- drag reorder ------------------------------------------------------
  // Move the dragged item to sit before `targetIdx` (or to the end of `folder`
  // when dropping on a folder body), re-tagging its folder.
  function reorder(fromIdx: number, targetIdx: number | null, folder: string) {
    const arr = [...docs];
    const [item] = arr.splice(fromIdx, 1);
    item.folder = folder || undefined;
    let insertAt: number;
    if (targetIdx == null) {
      let last = -1;
      arr.forEach((d, i) => { if ((d.folder || "") === folder) last = i; });
      insertAt = last + 1;
    } else {
      insertAt = targetIdx > fromIdx ? targetIdx - 1 : targetIdx;
    }
    arr.splice(insertAt, 0, item);
    persist(arr, folders);
  }

  // Groups to render: every named folder in order, then Ungrouped last.
  const groups: { key: string; name: string; items: { doc: DocItem; idx: number }[] }[] = [
    ...folders.map((name) => ({ key: name, name, items: [] as { doc: DocItem; idx: number }[] })),
    { key: UNGROUPED, name: "Ungrouped", items: [] as { doc: DocItem; idx: number }[] },
  ];
  docs.forEach((doc, idx) => {
    const f = doc.folder || "";
    const g = (f && folders.includes(f)) ? groups.find((x) => x.key === f)! : groups[groups.length - 1];
    g.items.push({ doc, idx });
  });

  const folderOptions = ["", ...folders]; // "" = Ungrouped

  return (
    <div className="space-y-6">
      {docsSlot}

      <section className="lq-card p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-display font-bold text-[16px] tracking-tight text-ink mb-1">Client files</h2>
            <p className="text-[12.5px] text-charcoal-60 mb-4">Drop in files — several at once — or paste a link. Sort them into folders and drag to reorder. Everything saves automatically.</p>
          </div>
          <span className={`text-xs ${status === "err" ? "text-rose-600" : "text-charcoal-40"}`}>
            {status === "saving" ? "Saving…" : status === "saved" ? "Saved ✓" : status === "err" ? "Save failed" : ""}
          </span>
        </div>

        {/* Folders bar */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          {folders.map((f) =>
            renaming === f ? (
              <span key={f} className="inline-flex items-center gap-1 rounded-full bg-white border border-orange/40 px-2 py-1">
                <input autoFocus value={renameVal} onChange={(e) => setRenameVal(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") renameFolder(f, renameVal); if (e.key === "Escape") setRenaming(null); }}
                  className="text-[13px] outline-none bg-transparent w-24" />
                <button type="button" onClick={() => renameFolder(f, renameVal)} className="text-emerald-600" aria-label="Save name"><Check size={14} /></button>
                <button type="button" onClick={() => setRenaming(null)} className="text-charcoal-40" aria-label="Cancel"><X size={14} /></button>
              </span>
            ) : (
              <span key={f} className="lq-chip lq-chip--orange inline-flex items-center gap-1.5 !py-1.5">
                {f}
                <button type="button" onClick={() => { setRenaming(f); setRenameVal(f); }} className="opacity-60 hover:opacity-100" aria-label={`Rename ${f}`}><Pencil size={12} /></button>
                <button type="button" onClick={() => deleteFolder(f)} className="opacity-60 hover:opacity-100 hover:text-rose-600" aria-label={`Delete ${f}`}><X size={13} /></button>
              </span>
            )
          )}
          <span className="inline-flex items-center gap-1 rounded-full bg-white/60 border border-charcoal/10 px-2 py-1">
            <FolderPlus size={14} className="text-charcoal-40" />
            <input value={newFolder} onChange={(e) => setNewFolder(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addFolder(); }} placeholder="New folder"
              className="text-[13px] outline-none bg-transparent w-28" />
            {newFolder.trim() && <button type="button" onClick={addFolder} className="text-orange font-semibold text-xs">Add</button>}
          </span>
        </div>

        {/* Bulk drop zone */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <label className="text-[11px] font-display font-bold uppercase tracking-[0.1em] text-charcoal-60">Upload into</label>
          <select value={uploadTarget} onChange={(e) => setUploadTarget(e.target.value)} className="lq-input !py-1 !text-[13px] w-auto">
            <option value="">Ungrouped</option>
            {folders.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload files"
          onClick={() => !busy && inputRef.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !busy && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); if (dragIdx == null) setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { if (dragIdx != null) return; e.preventDefault(); setDrag(false); bulkUpload(e.dataTransfer.files); }}
          className={`flex flex-col items-center justify-center text-center gap-1.5 rounded-2xl border-2 border-dashed px-4 py-7 cursor-pointer transition-colors ${
            drag ? "border-orange bg-orange/5" : "border-charcoal/15 hover:border-orange/60"
          } ${busy ? "opacity-70 pointer-events-none" : ""}`}
        >
          <UploadCloud aria-hidden className="text-orange" size={24} />
          <span className="font-display font-bold text-[14px] text-ink">
            {busy && progress ? `Uploading ${progress.done}/${progress.total}…` : "Drop files here or click to upload"}
          </span>
          <span className="text-[12px] text-charcoal-60">PDF, images (incl. HEIC), Office docs, zips — up to 25&nbsp;MB each.</span>
          <input ref={inputRef} type="file" multiple accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx,.csv,.zip" className="hidden"
            onChange={(e) => { bulkUpload(e.target.files); e.target.value = ""; }} disabled={busy} />
        </div>
        {note && <p className={`text-sm mt-2 ${note.tone === "ok" ? "text-emerald-700" : "text-rose-600"}`}>{note.text}</p>}

        {/* Grouped, reorderable list */}
        <div className="mt-5 space-y-5">
          {groups.map((g) => {
            if (g.key === UNGROUPED && g.items.length === 0) return null; // hide empty Ungrouped
            return (
              <div
                key={g.key}
                onDragOver={(e) => { if (dragIdx != null) { e.preventDefault(); setDropHint(g.key); } }}
                onDrop={(e) => { if (dragIdx != null) { e.preventDefault(); reorder(dragIdx, null, g.key === UNGROUPED ? "" : g.name); setDragIdx(null); setDropHint(null); } }}
                className={`rounded-2xl p-3 transition-colors ${dropHint === g.key ? "bg-orange/5 ring-1 ring-orange/40" : ""}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[11px] font-display font-bold uppercase tracking-[0.1em] text-charcoal-60">{g.name}</span>
                  <span className="text-[11px] text-charcoal-40">{g.items.length} file{g.items.length === 1 ? "" : "s"}</span>
                </div>
                {g.items.length === 0 ? (
                  <p className="text-[12.5px] text-charcoal-40 italic px-1 py-2">Empty — drag files here or upload into this folder.</p>
                ) : (
                  <div className="space-y-2">
                    {g.items.map(({ doc, idx }) => (
                      <div
                        key={idx}
                        draggable
                        onDragStart={() => setDragIdx(idx)}
                        onDragEnd={() => { setDragIdx(null); setDropHint(null); }}
                        onDragOver={(e) => { if (dragIdx != null) e.preventDefault(); }}
                        onDrop={(e) => { if (dragIdx != null) { e.preventDefault(); e.stopPropagation(); reorder(dragIdx, idx, g.key === UNGROUPED ? "" : g.name); setDragIdx(null); setDropHint(null); } }}
                        className={`bg-white/70 border border-charcoal/5 rounded-2xl p-3 relative ${dragIdx === idx ? "opacity-40" : ""}`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="mt-6 cursor-grab active:cursor-grabbing text-charcoal-30 shrink-0" aria-label="Drag to reorder"><GripVertical size={16} /></span>
                          <div className="flex-1 min-w-0 pr-14">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div><label className={lbl}>Title</label><input className={inp} value={doc.title} placeholder="Proposal" onChange={(e) => setDoc(idx, { title: e.target.value })} onBlur={saveDoc} /></div>
                              <div><label className={lbl}>Type</label><input className={inp} value={doc.type} placeholder="PDF" onChange={(e) => setDoc(idx, { type: e.target.value })} onBlur={saveDoc} /></div>
                              <div><label className={lbl}>URL</label><input className={inp} value={doc.url} placeholder="https://…" onChange={(e) => setDoc(idx, { url: e.target.value })} onBlur={saveDoc} /></div>
                            </div>
                            <div className="mt-2 flex items-center gap-3 flex-wrap">
                              <div className="inline-flex items-center gap-1.5">
                                <span className="text-[11px] text-charcoal-40">Folder</span>
                                <select value={doc.folder && folders.includes(doc.folder) ? doc.folder : ""} onChange={(e) => moveToFolder(idx, e.target.value)} className="lq-input !py-1 !text-[12.5px] w-auto">
                                  {folderOptions.map((f) => <option key={f || UNGROUPED} value={f}>{f || "Ungrouped"}</option>)}
                                </select>
                              </div>
                              <FileUpload accept="application/pdf,image/*" label="Replace file" compact
                                onUploaded={({ url, name, contentType }) => { setDoc(idx, { url, title: doc.title || titleFor(name), type: contentType.includes("pdf") ? "PDF" : doc.type || "File" }); setTimeout(saveDoc, 0); }} />
                              {doc.url && <a href={doc.url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-charcoal-60 hover:text-orange-deep no-underline">Open ↗</a>}
                            </div>
                          </div>
                          <button type="button" onClick={() => removeDoc(idx)} className="absolute top-3 right-3 text-xs font-semibold text-charcoal-40 hover:text-rose-700">Remove</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <button type="button" onClick={() => persist([...docs, { title: "", type: "PDF", url: "", ...(uploadTarget ? { folder: uploadTarget } : {}) }], folders)}
            className="text-sm font-semibold text-orange hover:text-orange-deep">+ Add document{uploadTarget ? ` to “${uploadTarget}”` : ""}</button>
        </div>
      </section>
    </div>
  );
}
