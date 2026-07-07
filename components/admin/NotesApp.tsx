"use client";

/* Notes — the studio's wall of things not to forget. One glass composer on
   top (jot → Enter), a filter row, then the wall: pinned strip + masonry of
   note cards. A note links to a client, carries a freeform label (someone
   new / extra context), or stays a plain studio note. Everything is
   optimistic and rolls back on failure with an inline error line. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  Archive,
  Bold,
  CheckSquare,
  FileDown,
  FileText,
  Heading2,
  Italic,
  List,
  ListOrdered,
  NotebookPen,
  Pin,
  PinOff,
  Plus,
  Presentation,
  Printer,
  Search,
  StickyNote,
  Tag,
  Trash2,
} from "lucide-react";
import { EmptyState, Modal, Seg } from "@/components/ui/glass";
import NoteMarkdown, { escapeHtml, noteBodyToHtml } from "@/components/admin/NoteMarkdown";
import type { Note } from "@/lib/notes";
import {
  archiveNoteAction,
  createNoteAction,
  deleteNoteAction,
  setNotePinnedAction,
  updateNoteAction,
} from "@/app/admin/notes/actions";

export type SlimClient = { slug: string; name: string; color: string };

type LinkChoice = { slug: string | null; label: string | null };

/* ------------------------------------------------------------- helpers */

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const d = Math.floor(s / 86400);
  if (d === 1) return "yesterday";
  if (d < 7) return `${d}d ago`;
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// First non-empty line, with markdown markers stripped — for one-line previews
// (pinned strip, untitled cards) and export filename/title fallbacks.
function firstLine(text: string): string {
  const l = (text || "").split("\n").find((x) => x.trim()) || "";
  return l
    .replace(/^(#{1,2} |- \[[ xX]\] ?|- |\d+\. )/, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .trim();
}

function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "0px";
  el.style.height = `${el.scrollHeight}px`;
}

/* --------------------------------------------------------- link picker */

// Where a note points: Studio (default) · an existing client · "Someone
// new…" (a freeform label for a prospect or anything extra). Used by both
// the composer and the editor.
function LinkPicker({
  clients,
  value,
  onChange,
  drop = "down",
}: {
  clients: SlimClient[];
  value: LinkChoice;
  onChange: (v: LinkChoice) => void;
  drop?: "down" | "up";
}) {
  const [open, setOpen] = useState(false);
  const [newMode, setNewMode] = useState(false);
  const [labelDraft, setLabelDraft] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        setOpen(false);
        setNewMode(false);
      }
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => {
    if (newMode) labelInputRef.current?.focus();
  }, [newMode]);

  const current = value.slug ? clients.find((c) => c.slug === value.slug) : undefined;

  const pick = (v: LinkChoice) => {
    onChange(v);
    setOpen(false);
    setNewMode(false);
  };

  const commitLabel = () => {
    const l = labelDraft.trim();
    if (l) pick({ slug: null, label: l });
  };

  const optionCls = (on: boolean) =>
    `lq-press w-full flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-[13px] text-start hover:bg-white/70 ${
      on ? "font-semibold text-ink" : "text-charcoal-60"
    }`;

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setNewMode(false);
          setLabelDraft(value.label || "");
        }}
        title="Link this note to a client, someone new, or the studio"
        className="lq-press inline-flex items-center gap-1.5 rounded-full border border-charcoal/10 bg-white/70 ps-2 pe-2.5 py-1 text-[12px] font-display font-semibold text-charcoal-80 shadow-[inset_0_1px_0_rgba(255,255,255,.9)] max-w-[150px] sm:max-w-[200px]"
      >
        {current ? (
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: current.color }} />
        ) : value.label ? (
          <Tag className="w-3 h-3 text-orange-deep shrink-0" />
        ) : (
          <StickyNote className="w-3 h-3 text-charcoal-40 shrink-0" />
        )}
        <span className="truncate">{current?.name || value.label || "Studio"}</span>
        <span className="text-charcoal-40 text-[9px]" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <div
          className={`lq-pop lq-chrome absolute end-0 z-30 w-60 p-1.5 ${
            drop === "up" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          <div className="max-h-64 overflow-y-auto">
            <button type="button" onClick={() => pick({ slug: null, label: null })} className={optionCls(!value.slug && !value.label)}>
              <StickyNote className="w-3.5 h-3.5 text-charcoal-40 shrink-0" />
              <span className="truncate flex-1">Studio</span>
              {!value.slug && !value.label && <span className="text-orange text-xs">✓</span>}
            </button>
            {clients.map((c) => (
              <button key={c.slug} type="button" onClick={() => pick({ slug: c.slug, label: null })} className={optionCls(value.slug === c.slug)}>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                <span className="truncate flex-1">{c.name}</span>
                {value.slug === c.slug && <span className="text-orange text-xs">✓</span>}
              </button>
            ))}
          </div>
          <div className="border-t border-charcoal/10 mt-1.5 pt-1.5">
            {newMode ? (
              <div className="flex items-center gap-1.5 p-1">
                <input
                  ref={labelInputRef}
                  value={labelDraft}
                  onChange={(e) => setLabelDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitLabel();
                    }
                    if (e.key === "Escape") {
                      e.stopPropagation();
                      setNewMode(false);
                    }
                  }}
                  placeholder="Who or what is it about?"
                  className="lq-input flex-1 min-w-0 !py-1.5"
                />
                <button type="button" className="lq-btn lq-btn--primary lq-btn--sm lq-press shrink-0" onClick={commitLabel}>
                  Set
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setNewMode(true)} className={optionCls(false)}>
                <Tag className="w-3.5 h-3.5 text-orange-deep shrink-0" />
                <span className="truncate flex-1">Someone new…</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Display-only version for a note card's footer.
function LinkChip({ note, clients }: { note: Note; clients: SlimClient[] }) {
  if (note.client_slug) {
    const c = clients.find((x) => x.slug === note.client_slug);
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-charcoal/10 bg-white/70 px-2 py-0.5 text-[11px] font-display font-semibold text-charcoal-80 max-w-[150px]">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c?.color || "#303030" }} />
        <span className="truncate">{c?.name || note.client_slug}</span>
      </span>
    );
  }
  if (note.context_label) {
    return (
      <span className="lq-chip lq-chip--orange max-w-[150px]">
        <Tag className="w-3 h-3 shrink-0" />
        <span className="truncate">{note.context_label}</span>
      </span>
    );
  }
  return <span className="text-[11px] font-display font-semibold text-charcoal-40">Studio</span>;
}

/* -------------------------------------------------------------- export */

// "Export" in the editor footer: a small pop menu with two ways out —
// a plain .txt download, or a print-ready window (the user picks
// "Save as PDF" as the destination in the print dialog to get a PDF).
function ExportMenu({ note, onError }: { note: Note; onError: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  const exportText = () => {
    setOpen(false);
    const title = note.title.trim();
    const content = `${title || firstLine(note.body) || "Note"}\n\n${note.body}`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(title || "note").replace(/[\\/:*?"<>|]/g, "-").slice(0, 120)}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Opens a clean, self-contained print document and calls print() once it
  // loads — the user saves it as a PDF from the print dialog.
  const exportPdf = () => {
    setOpen(false);
    const w = window.open("", "_blank");
    if (!w) {
      onError("The print window was blocked — allow popups and try again.");
      return;
    }
    const title = note.title.trim() || firstLine(note.body) || "Note";
    const dateLine = new Date(note.created_at).toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    // All user text goes through escapeHtml / noteBodyToHtml (which escapes
    // before wrapping), so nothing from the note can inject markup here.
    const doc = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  body{font-family:'Poppins',-apple-system,'Segoe UI',system-ui,sans-serif;color:#232323;max-width:680px;margin:40px auto;padding:0 24px;line-height:1.55;font-size:14px}
  h1{font-size:22px;letter-spacing:-.01em;line-height:1.25;margin:0 0 4px}
  .meta{color:#8a8a8a;font-size:11.5px;margin:0 0 26px}
  h2{font-size:16px;margin:22px 0 6px}
  h3{font-size:14px;margin:18px 0 4px}
  p{margin:0 0 10px}
  ul,ol{margin:0 0 10px;padding-inline-start:22px}
  li{margin:2px 0}
  ul.check{list-style:none;padding-inline-start:2px}
  ul.check li{display:flex;gap:8px;align-items:flex-start}
  .box{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;flex:none;margin-top:3px;border:1.5px solid #b5b5b5;border-radius:4px;font-size:10px;line-height:1;color:#fff}
  .box.done{background:#F57F00;border-color:#F57F00}
  li.done .txt{color:#8a8a8a;text-decoration:line-through}
  @media print{body{margin:0 auto}}
</style>
</head>
<body dir="auto">
<h1>${escapeHtml(title)}</h1>
<p class="meta">${escapeHtml(dateLine)} · Marker Studio</p>
${noteBodyToHtml(note.body)}
<script>window.addEventListener('load',function(){setTimeout(function(){window.print()},200)})</script>
</body>
</html>`;
    w.document.open();
    w.document.write(doc);
    w.document.close();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="lq-btn lq-btn--glass lq-btn--sm lq-press"
      >
        <FileDown className="w-3.5 h-3.5" />
        Export
      </button>
      {open && (
        <div role="menu" className="lq-pop lq-chrome absolute start-0 bottom-full mb-2 z-30 w-44 p-1.5">
          <button
            type="button"
            role="menuitem"
            onClick={exportText}
            className="lq-press w-full flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-[13px] text-start text-charcoal-80 hover:bg-white/70"
          >
            <FileText className="w-3.5 h-3.5 text-charcoal-40 shrink-0" />
            Text (.txt)
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={exportPdf}
            className="lq-press w-full flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-[13px] text-start text-charcoal-80 hover:bg-white/70"
          >
            <Printer className="w-3.5 h-3.5 text-charcoal-40 shrink-0" />
            PDF
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- app */

export default function NotesApp({
  notes: initialNotes,
  clients,
  presetClient,
}: {
  notes: Note[];
  clients: SlimClient[];
  presetClient?: string;
}) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const notesRef = useRef(notes);
  notesRef.current = notes;

  // Inline error line (optimistic updates roll back to it, no toasts).
  const [err, setErrRaw] = useState<string | null>(null);
  const errTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setErr = useCallback((m: string | null) => {
    setErrRaw(m);
    if (errTimer.current) clearTimeout(errTimer.current);
    if (m) errTimer.current = setTimeout(() => setErrRaw(null), 6000);
  }, []);

  const patchLocal = useCallback((id: number, patch: Partial<Note>) => {
    setNotes((xs) => xs.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }, []);

  /* ---- composer ---- */
  const [cTitle, setCTitle] = useState("");
  const [cBody, setCBody] = useState("");
  const [cLink, setCLink] = useState<LinkChoice>(() =>
    presetClient && clients.some((c) => c.slug === presetClient)
      ? { slug: presetClient, label: null }
      : { slug: null, label: null }
  );
  const [cFocused, setCFocused] = useState(false);
  const [cBusy, setCBusy] = useState(false);
  const [flash, setFlash] = useState(false);
  const cTitleRef = useRef<HTMLInputElement>(null);
  const cBodyRef = useRef<HTMLTextAreaElement>(null);
  const tempId = useRef(-1);

  const composerExpanded = cFocused || !!cTitle.trim() || !!cBody.trim();

  const submitNote = useCallback(async () => {
    const title = cTitle.trim();
    const body = cBody.trim();
    if ((!title && !body) || cBusy) return;
    setCBusy(true);
    const id = tempId.current--;
    const now = new Date().toISOString();
    const temp: Note = {
      id,
      title,
      body,
      client_slug: cLink.slug,
      context_label: cLink.label,
      pinned: false,
      created_at: now,
      updated_at: now,
    };
    const keep = { title: cTitle, body: cBody };
    setNotes((xs) => [temp, ...xs]);
    setCTitle("");
    setCBody("");
    setFlash(true);
    setTimeout(() => setFlash(false), 700);
    cTitleRef.current?.focus();
    const res = await createNoteAction({ title, body, clientSlug: cLink.slug, contextLabel: cLink.label });
    setCBusy(false);
    if (res.ok && res.note) {
      const saved = res.note;
      setNotes((xs) => xs.map((n) => (n.id === id ? saved : n)));
    } else {
      setNotes((xs) => xs.filter((n) => n.id !== id));
      setCTitle(keep.title);
      setCBody(keep.body);
      setErr(res.error || "Couldn’t save the note.");
    }
  }, [cTitle, cBody, cBusy, cLink, setErr]);

  /* ---- filters + search ---- */
  const [filter, setFilter] = useState<string>(() =>
    presetClient && clients.some((c) => c.slug === presetClient) ? `c:${presetClient}` : "all"
  );
  const [query, setQuery] = useState("");

  const sorted = useMemo(
    () =>
      [...notes].sort(
        (a, b) => Number(b.pinned) - Number(a.pinned) || (a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0)
      ),
    [notes]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sorted.filter((n) => {
      if (filter === "studio" && (n.client_slug || n.context_label)) return false;
      if (filter === "new" && !n.context_label) return false;
      if (filter.startsWith("c:") && n.client_slug !== filter.slice(2)) return false;
      if (!q) return true;
      const clientName = n.client_slug ? clients.find((c) => c.slug === n.client_slug)?.name || "" : "";
      return `${n.title}\n${n.body}\n${n.context_label || ""}\n${clientName}`.toLowerCase().includes(q);
    });
  }, [sorted, filter, query, clients]);

  const pinnedVisible = visible.filter((n) => n.pinned);
  const wallVisible = visible.filter((n) => !n.pinned);
  const clientsWithNotes = useMemo(() => clients.filter((c) => notes.some((n) => n.client_slug === c.slug)), [clients, notes]);
  const hasNew = notes.some((n) => !!n.context_label);

  /* ---- pin / archive / delete ---- */
  const togglePin = useCallback(
    async (n: Note) => {
      if (n.id < 0) return;
      const next = !n.pinned;
      patchLocal(n.id, { pinned: next });
      const res = await setNotePinnedAction(n.id, next);
      if (!res.ok) {
        patchLocal(n.id, { pinned: n.pinned });
        setErr(res.error || "Couldn’t update the pin.");
      }
    },
    [patchLocal, setErr]
  );

  /* ---- editor (modal) ---- */
  const [editingId, setEditingId] = useState<number | null>(null);
  const editing = editingId != null ? notes.find((n) => n.id === editingId) || null : null;
  const snapRef = useRef<Note | null>(null); // the note as it was when opened — the rollback point
  const dirtyRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorBodyRef = useRef<HTMLTextAreaElement>(null);
  const [editorTab, setEditorTab] = useState<"write" | "preview">("write");
  const [fullscreen, setFullscreen] = useState(false); // meeting mode stretches the modal

  useEffect(() => {
    if (editingId == null) return;
    const ta = editorBodyRef.current;
    if (!ta) return;
    if (fullscreen) ta.style.height = ""; // meeting mode: the textarea fills the modal instead
    else autoGrow(ta);
  }, [editingId, fullscreen, editorTab]);

  const openNote = useCallback((n: Note) => {
    if (n.id < 0) return; // still being created — one beat later it's editable
    snapRef.current = n;
    dirtyRef.current = false;
    setEditorTab("write");
    setFullscreen(false);
    setEditingId(n.id);
  }, []);

  // Push the note's current (optimistic) state to the server. On failure the
  // note snaps back to how it looked when the editor opened.
  const persist = useCallback(
    async (id: number) => {
      const n = notesRef.current.find((x) => x.id === id);
      if (!n || !dirtyRef.current) return;
      if (!n.title.trim() && !n.body.trim()) return; // don't save an emptied note — close reverts it
      dirtyRef.current = false;
      const res = await updateNoteAction(id, {
        title: n.title,
        body: n.body,
        clientSlug: n.client_slug,
        contextLabel: n.context_label,
      });
      if (!res.ok) {
        const snap = snapRef.current;
        if (snap && snap.id === id) patchLocal(id, snap);
        setErr(res.error || "Couldn’t save the changes.");
      }
    },
    [patchLocal, setErr]
  );

  // Every keystroke updates the wall instantly; the server write is debounced.
  const editPatch = useCallback(
    (patch: Partial<Note>) => {
      if (editingId == null) return;
      patchLocal(editingId, { ...patch, updated_at: new Date().toISOString() });
      dirtyRef.current = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const id = editingId;
      saveTimer.current = setTimeout(() => void persist(id), 800);
    },
    [editingId, patchLocal, persist]
  );

  /* ---- formatting (editor toolbar + shortcuts) ---- */

  // Wrap / unwrap the textarea selection with an inline marker (** or *),
  // keeping the caret on the same text afterwards.
  const applyInline = useCallback(
    (marker: "**" | "*") => {
      const ta = editorBodyRef.current;
      if (!ta) return;
      const value = ta.value;
      const s = ta.selectionStart;
      const e = ta.selectionEnd;
      const sel = value.slice(s, e);
      const before = value.slice(0, s);
      const after = value.slice(e);
      let next: string;
      let ns: number;
      let ne: number;
      if (sel && before.endsWith(marker) && after.startsWith(marker)) {
        // already wrapped just outside the selection — unwrap
        next = before.slice(0, before.length - marker.length) + sel + after.slice(marker.length);
        ns = s - marker.length;
        ne = e - marker.length;
      } else if (sel.length >= marker.length * 2 && sel.startsWith(marker) && sel.endsWith(marker)) {
        // markers inside the selection — unwrap
        next = before + sel.slice(marker.length, sel.length - marker.length) + after;
        ns = s;
        ne = e - marker.length * 2;
      } else {
        next = before + marker + sel + marker + after;
        ns = s + marker.length;
        ne = e + marker.length;
      }
      editPatch({ body: next });
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(ns, ne);
        if (!fullscreen) autoGrow(ta);
      });
    },
    [editPatch, fullscreen]
  );

  // Prefix (or un-prefix) every line touched by the selection: heading,
  // bullet, numbered list, or checklist.
  const applyLinePrefix = useCallback(
    (kind: "h2" | "ul" | "ol" | "check") => {
      const ta = editorBodyRef.current;
      if (!ta) return;
      const value = ta.value;
      const s = ta.selectionStart;
      const e = ta.selectionEnd;
      const lineStart = value.lastIndexOf("\n", s - 1) + 1;
      let lineEnd = value.indexOf("\n", e);
      if (lineEnd === -1) lineEnd = value.length;
      const segment = value.slice(lineStart, lineEnd);
      const lines = segment.split("\n");
      const strip = (l: string) => l.replace(/^(#{1,2} |- \[[ xX]\] ?|- |\d+\. )/, "");
      const has = (l: string) =>
        kind === "h2"
          ? /^## /.test(l)
          : kind === "check"
          ? /^- \[[ xX]\]/.test(l)
          : kind === "ul"
          ? /^- (?!\[)/.test(l)
          : /^\d+\. /.test(l);
      const prefixFor = (i: number) =>
        kind === "h2" ? "## " : kind === "ul" ? "- " : kind === "check" ? "- [ ] " : `${i + 1}. `;
      const allHave = lines.every((l) => !l.trim() || has(l));
      const nextSegment = lines
        .map((l, i) => (!l.trim() && lines.length > 1 ? l : allHave ? strip(l) : prefixFor(i) + strip(l)))
        .join("\n");
      const next = value.slice(0, lineStart) + nextSegment + value.slice(lineEnd);
      editPatch({ body: next });
      const delta = nextSegment.length - segment.length;
      requestAnimationFrame(() => {
        ta.focus();
        const pos = Math.max(lineStart, Math.min(next.length, e + delta));
        ta.setSelectionRange(pos, pos);
        if (!fullscreen) autoGrow(ta);
      });
    },
    [editPatch, fullscreen]
  );

  // Preview checkboxes flip `- [ ]` ↔ `- [x]` on the exact source line and
  // ride the same debounced autosave as typing.
  const toggleCheckAtLine = useCallback(
    (lineIndex: number) => {
      const n = editingId != null ? notesRef.current.find((x) => x.id === editingId) : null;
      if (!n) return;
      const lines = n.body.split("\n");
      const m = lines[lineIndex] != null ? /^(\s*)- \[( |x|X)\] ?(.*)$/.exec(lines[lineIndex]) : null;
      if (!m) return;
      lines[lineIndex] = `${m[1]}- [${m[2] === " " ? "x" : " "}] ${m[3]}`;
      editPatch({ body: lines.join("\n") });
    },
    [editingId, editPatch]
  );

  /* ---- meeting mode ---- */
  const [meetingBusy, setMeetingBusy] = useState(false);

  // One tap when the meeting starts: create the note with an agenda/notes/
  // action-items skeleton and drop straight into the full-screen editor.
  const startMeetingNote = useCallback(async () => {
    if (meetingBusy) return;
    setMeetingBusy(true);
    const d = new Date();
    const weekday = d.toLocaleDateString("en-GB", { weekday: "long" });
    const dayMonth = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const res = await createNoteAction({
      title: `Meeting — ${weekday} ${dayMonth}`,
      body: "## Agenda\n- \n\n## Notes\n- \n\n## Action items\n- [ ] ",
      clientSlug: null,
      contextLabel: null,
    });
    setMeetingBusy(false);
    if (res.ok && res.note) {
      const saved = res.note;
      setNotes((xs) => [saved, ...xs]);
      snapRef.current = saved;
      dirtyRef.current = false;
      setEditorTab("write");
      setFullscreen(true);
      setEditingId(saved.id);
    } else {
      setErr(res.error || "Couldn’t start the meeting note.");
    }
  }, [meetingBusy, setErr]);

  const closeEditor = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (editingId != null) {
      const n = notesRef.current.find((x) => x.id === editingId);
      const snap = snapRef.current;
      if (n && !n.title.trim() && !n.body.trim() && snap && snap.id === editingId) {
        // Emptied out — restore what it said before instead of saving a blank.
        patchLocal(editingId, snap);
        dirtyRef.current = false;
      } else {
        void persist(editingId);
      }
    }
    setEditingId(null);
    setFullscreen(false);
  }, [editingId, patchLocal, persist]);

  const archiveEditing = useCallback(async () => {
    if (!editing) return;
    const n = editing;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    dirtyRef.current = false;
    setEditingId(null);
    setNotes((xs) => xs.filter((x) => x.id !== n.id));
    const res = await archiveNoteAction(n.id);
    if (!res.ok) {
      setNotes((xs) => [n, ...xs]);
      setErr(res.error || "Couldn’t archive the note.");
    }
  }, [editing, setErr]);

  const deleteEditing = useCallback(async () => {
    if (!editing) return;
    if (!window.confirm("Delete this note for good? There’s no undo.")) return;
    const n = editing;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    dirtyRef.current = false;
    setEditingId(null);
    setNotes((xs) => xs.filter((x) => x.id !== n.id));
    const res = await deleteNoteAction(n.id);
    if (!res.ok) {
      setNotes((xs) => [n, ...xs]);
      setErr(res.error || "Couldn’t delete the note.");
    }
  }, [editing, setErr]);

  /* ---- render bits ---- */

  const pill = (key: string, label: ReactNode) => {
    const on = filter === key;
    return (
      <button
        key={key}
        type="button"
        onClick={() => setFilter(key)}
        className={`lq-press shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-display font-semibold transition-colors ${
          on
            ? "bg-charcoal text-white shadow-[inset_0_1px_0_rgba(255,255,255,.2),0_8px_18px_-8px_rgba(48,48,48,.55)]"
            : "bg-white/70 border border-charcoal/10 text-charcoal-60 hover:text-charcoal-80 hover:bg-white"
        }`}
      >
        {label}
      </button>
    );
  };

  const pinButton = (n: Note, subtle = true) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        void togglePin(n);
      }}
      title={n.pinned ? "Unpin" : "Pin to the top"}
      aria-label={n.pinned ? "Unpin note" : "Pin note"}
      className={`lq-press shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
        n.pinned ? "bg-orange/15 text-orange-deep" : subtle ? "text-charcoal-40 hover:text-charcoal-80 hover:bg-charcoal/5" : "bg-charcoal/5 text-charcoal-60"
      }`}
    >
      {n.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
    </button>
  );

  const editingLink: LinkChoice = { slug: editing?.client_slug ?? null, label: editing?.context_label ?? null };

  return (
    <div className="space-y-5">
      {/* header */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-display font-bold uppercase tracking-[0.14em] text-charcoal-60">
            Everything you don’t want to forget
          </p>
          <h1 className="font-display font-extrabold text-[28px] tracking-tight text-ink leading-tight mt-1 flex items-center gap-2.5">
            Notes
            <span className="lq-chip">{notes.length === 1 ? "1 note" : `${notes.length} notes`}</span>
          </h1>
        </div>
      </header>

      {/* capture bar — the hero — with meeting mode one tap away */}
      <div className="flex flex-wrap items-start gap-2.5">
      <section
        onFocus={() => setCFocused(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setCFocused(false);
        }}
        className={`relative flex-1 min-w-[260px] rounded-[26px] transition-all duration-200 ${flash ? "ms-composer-flash" : ""}
          bg-gradient-to-b from-white/95 to-white/80 border border-charcoal/10
          shadow-[inset_0_1px_0_rgba(255,255,255,.95),0_10px_34px_-14px_rgba(48,48,48,.16)]
          focus-within:border-orange/50 focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,.95),0_14px_40px_-12px_rgba(255,145,0,0.35)] focus-within:ring-4 focus-within:ring-orange/10`}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => void submitNote()}
            disabled={cBusy || !(cTitle.trim() || cBody.trim())}
            aria-label="Save note"
            className={`lq-press shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 ${
              cTitle.trim() || cBody.trim()
                ? "bg-gradient-to-br from-[#FFA226] to-[#F57F00] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.5),0_6px_14px_-4px_rgba(255,145,0,.6)] scale-100"
                : "bg-charcoal/5 text-charcoal-40 scale-90"
            }`}
          >
            <Plus className="w-4 h-4" />
          </button>
          <input
            ref={cTitleRef}
            value={cTitle}
            onChange={(e) => setCTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void submitNote();
              }
              if (e.key === "Escape") (e.target as HTMLInputElement).blur();
            }}
            placeholder="Jot something…"
            className="relative flex-1 min-w-0 bg-transparent focus:outline-none placeholder:text-charcoal-40/70 text-ink text-[15px]"
            enterKeyHint="done"
          />
          <LinkPicker clients={clients} value={cLink} onChange={setCLink} />
        </div>
        {composerExpanded && (
          <div className="px-4 pb-3 space-y-2.5">
            <textarea
              ref={cBodyRef}
              value={cBody}
              onChange={(e) => {
                setCBody(e.target.value);
                autoGrow(e.currentTarget);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void submitNote();
                }
              }}
              rows={2}
              placeholder="Add the details — paste anything, it keeps your line breaks…"
              className="w-full resize-none bg-transparent focus:outline-none text-[15px] leading-relaxed text-charcoal-80 placeholder:text-charcoal-40/70 min-h-[52px]"
            />
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-charcoal-40">Enter on the title saves · ⌘/Ctrl+Enter saves from here</span>
              <span className="flex-1" />
              <button
                type="button"
                onClick={() => void submitNote()}
                disabled={cBusy || !(cTitle.trim() || cBody.trim())}
                className="lq-btn lq-btn--primary lq-btn--sm lq-press disabled:opacity-50"
              >
                Save note
              </button>
            </div>
          </div>
        )}
      </section>
      <button
        type="button"
        onClick={() => void startMeetingNote()}
        disabled={meetingBusy}
        title="Start a full-screen meeting note with agenda, notes and action items"
        className="lq-btn lq-btn--dark lq-press shrink-0 mt-2 disabled:opacity-60"
      >
        <Presentation className="w-4 h-4" />
        Meeting note
      </button>
      </div>

      {err && <p className="text-[12px] font-semibold text-rose-700 px-2">{err}</p>}

      {/* filter row */}
      {notes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {pill("all", "All")}
          {pill("studio", "Studio")}
          {clientsWithNotes.map((c) =>
            pill(
              `c:${c.slug}`,
              <>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />
                {c.name}
              </>
            )
          )}
          {hasNew &&
            pill(
              "new",
              <>
                <Tag className="w-3 h-3" />
                New
              </>
            )}
          <span className="flex-1" />
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-charcoal-40 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notes…"
              className="lq-input !rounded-full !ps-9 !py-2 w-[180px] sm:w-[220px]"
            />
          </div>
        </div>
      )}

      {/* the wall */}
      {notes.length === 0 ? (
        <section className="lq-card lq-rise">
          <EmptyState
            icon={<NotebookPen className="w-5 h-5" />}
            title="Your first note is one keystroke away"
            sub="Jot it above — link it to a client, tag someone new, or keep it for the studio."
          />
        </section>
      ) : visible.length === 0 ? (
        <section className="lq-card lq-rise">
          <EmptyState
            icon={<Search className="w-5 h-5" />}
            title="Nothing matches"
            sub="Try a different word, or clear the filter."
            action={
              <button
                type="button"
                className="lq-btn lq-btn--glass lq-btn--sm lq-press"
                onClick={() => {
                  setFilter("all");
                  setQuery("");
                }}
              >
                Show everything
              </button>
            }
          />
        </section>
      ) : (
        <>
          {pinnedVisible.length > 0 && (
            <section className="lq-card p-4 lq-rise">
              <p className="flex items-center gap-1.5 text-[10px] font-display font-bold uppercase tracking-[0.12em] text-charcoal-60 mb-1">
                <Pin className="w-3 h-3" /> Pinned
              </p>
              <div className="divide-y divide-charcoal/5">
                {pinnedVisible.map((n) => (
                  <div
                    key={n.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openNote(n)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openNote(n);
                      }
                    }}
                    className="lq-press w-full flex items-center gap-3 py-2.5 cursor-pointer"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-display font-bold tracking-tight text-ink truncate">
                        {n.title || firstLine(n.body) || "Untitled"}
                      </span>
                      {!!n.body && !!n.title && (
                        <span className="block text-[12px] text-charcoal-60 truncate mt-0.5">{firstLine(n.body)}</span>
                      )}
                    </span>
                    <span className="hidden sm:inline-flex shrink-0">
                      <LinkChip note={n} clients={clients} />
                    </span>
                    <span className="text-[11px] text-charcoal-40 tabular-nums shrink-0">{timeAgo(n.updated_at)}</span>
                    {pinButton(n)}
                  </div>
                ))}
              </div>
            </section>
          )}

          {wallVisible.length > 0 && (
            <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 lq-stagger">
              {wallVisible.map((n, i) => (
                <article
                  key={n.id}
                  onClick={() => openNote(n)}
                  style={{ "--i": Math.min(i, 10) } as CSSProperties}
                  className={`lq-card lq-card--hover p-4 mb-4 break-inside-avoid cursor-pointer ${n.id < 0 ? "opacity-60" : ""}`}
                >
                  {!!n.title && (
                    <h3 className="font-display font-bold text-[14px] tracking-tight text-ink leading-snug">{n.title}</h3>
                  )}
                  {!!n.body && (
                    <div className={n.title ? "mt-1.5" : ""}>
                      {/* clamp mode: first lines only, checkboxes read-only */}
                      <NoteMarkdown body={n.body} clamp />
                    </div>
                  )}
                  <footer className="mt-3 flex items-center gap-2">
                    <LinkChip note={n} clients={clients} />
                    <span className="flex-1" />
                    <span className="text-[11px] text-charcoal-40 tabular-nums shrink-0">{timeAgo(n.updated_at)}</span>
                    {pinButton(n)}
                  </footer>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {/* editor — regular modal, or the stretched meeting-mode variant */}
      <Modal
        open={!!editing}
        onClose={closeEditor}
        className={fullscreen ? "!w-[min(96vw,860px)] !h-[92dvh] !max-h-none flex flex-col" : ""}
      >
        {editing && (
          <div className={fullscreen ? "flex flex-col h-full min-h-0 gap-3" : "space-y-3"}>
            <input
              value={editing.title}
              onChange={(e) => editPatch({ title: e.target.value })}
              placeholder="Title"
              className={`w-full bg-transparent focus:outline-none font-display font-bold tracking-tight text-ink placeholder:text-charcoal-40/70 ${
                fullscreen ? "text-[22px]" : "text-[18px]"
              }`}
            />
            {/* Write / Preview + the formatting toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              <Seg<"write" | "preview">
                value={editorTab}
                onChange={setEditorTab}
                options={[
                  { value: "write", label: "Write" },
                  { value: "preview", label: "Preview" },
                ]}
              />
              <span className="flex-1" />
              {editorTab === "write" && (
                <div role="toolbar" aria-label="Formatting" className="flex items-center gap-0.5">
                  {(
                    [
                      { icon: <Bold className="w-4 h-4" />, label: "Bold (⌘/Ctrl+B)", run: () => applyInline("**") },
                      { icon: <Italic className="w-4 h-4" />, label: "Italic (⌘/Ctrl+I)", run: () => applyInline("*") },
                      { icon: <Heading2 className="w-4 h-4" />, label: "Heading", run: () => applyLinePrefix("h2") },
                      { icon: <List className="w-4 h-4" />, label: "Bullet list", run: () => applyLinePrefix("ul") },
                      { icon: <ListOrdered className="w-4 h-4" />, label: "Numbered list", run: () => applyLinePrefix("ol") },
                      { icon: <CheckSquare className="w-4 h-4" />, label: "Checklist", run: () => applyLinePrefix("check") },
                    ] as { icon: ReactNode; label: string; run: () => void }[]
                  ).map((b) => (
                    <button
                      key={b.label}
                      type="button"
                      title={b.label}
                      aria-label={b.label}
                      onMouseDown={(e) => e.preventDefault()} // keep the textarea selection alive
                      onClick={b.run}
                      className="lq-press w-7 h-7 rounded-lg flex items-center justify-center text-charcoal-60 hover:text-ink hover:bg-charcoal/5"
                    >
                      {b.icon}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {editorTab === "write" ? (
              <textarea
                ref={editorBodyRef}
                value={editing.body}
                onChange={(e) => {
                  editPatch({ body: e.target.value });
                  if (!fullscreen) autoGrow(e.currentTarget);
                }}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
                    const k = e.key.toLowerCase();
                    if (k === "b") {
                      e.preventDefault();
                      applyInline("**");
                    } else if (k === "i") {
                      e.preventDefault();
                      applyInline("*");
                    }
                  }
                }}
                placeholder="Write it down…"
                rows={4}
                className={`w-full resize-none bg-transparent focus:outline-none leading-relaxed text-charcoal-80 placeholder:text-charcoal-40/70 ${
                  fullscreen ? "flex-1 min-h-0 overflow-y-auto text-[16px]" : "min-h-[120px] text-[15px]"
                }`}
              />
            ) : (
              <div className={fullscreen ? "flex-1 min-h-0 overflow-y-auto" : "min-h-[120px]"}>
                {editing.body.trim() ? (
                  <NoteMarkdown body={editing.body} onToggleCheck={toggleCheckAtLine} />
                ) : (
                  <p className="text-[14px] text-charcoal-40">Nothing to preview yet — write something first.</p>
                )}
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <LinkPicker
                clients={clients}
                value={editingLink}
                onChange={(v) => editPatch({ client_slug: v.slug, context_label: v.label })}
                drop="up"
              />
              <span className="text-[11px] text-charcoal-40 tabular-nums">
                Created {timeAgo(editing.created_at)} · edited {timeAgo(editing.updated_at)}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-charcoal/5">
              {pinButton(editing, false)}
              <ExportMenu note={editing} onError={setErr} />
              <button type="button" className="lq-btn lq-btn--ghost lq-btn--sm lq-press" onClick={() => void archiveEditing()}>
                <Archive className="w-3.5 h-3.5" />
                Archive
              </button>
              <span className="flex-1" />
              <button type="button" className="lq-btn lq-btn--danger lq-btn--sm lq-press" onClick={() => void deleteEditing()}>
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
              <button type="button" className="lq-btn lq-btn--primary lq-btn--sm lq-press" onClick={closeEditor}>
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
