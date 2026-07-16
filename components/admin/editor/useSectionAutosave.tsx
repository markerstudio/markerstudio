"use client";

// One auto-save contract for every editor tab (platform plan: "one client-data
// store"). The tab hands over the exact fields it persists; the hook journals
// them to localStorage before every network attempt, saves 1.2s after the last
// edit, parks offline failures and flushes on reconnect (plus a slow retry),
// restores day-old drafts on mount, saves immediately on ⌘S, and warns when
// closing with unsaved work. Render <SyncPill {...sync} /> as the footer.

import { useCallback, useEffect, useRef, useState } from "react";

export type SyncState = "idle" | "saving" | "saved" | "offline" | "error";

export function useSectionAutosave<T>({
  slug,
  section,
  payload,
  save,
  onRestore,
}: {
  slug: string;
  /** Stable name for the draft key — e.g. "plancontent", "dashboard". */
  section: string;
  /** The exact fields this tab persists — recompute every render. */
  payload: T;
  save: (payload: T) => Promise<{ ok: boolean; error?: string }>;
  /** Apply a journaled draft on mount (crash / offline recovery). */
  onRestore?: (draft: T) => void;
}) {
  const draftKey = `ms-draft:${section}:${slug}`;
  const [state, setState] = useState<SyncState>("idle");
  const [dirty, setDirty] = useState(false);

  const latest = useRef(payload);
  latest.current = payload;
  const serialized = JSON.stringify(payload);
  // The first render is the server truth; every successful save moves it.
  const baseline = useRef<string | null>(null);
  if (baseline.current === null) baseline.current = serialized;
  const savingRef = useRef(false);
  const saveRef = useRef(save);
  saveRef.current = save;
  const onRestoreRef = useRef(onRestore);
  onRestoreRef.current = onRestore;

  const flush = useCallback(async () => {
    if (savingRef.current) return;
    const snap = JSON.stringify(latest.current);
    if (snap === baseline.current) { setDirty(false); return; }
    savingRef.current = true;
    setState("saving");
    try {
      const r = await saveRef.current(latest.current);
      savingRef.current = false;
      if (r.ok) {
        baseline.current = snap;
        try { localStorage.removeItem(draftKey); } catch { /* private mode */ }
        if (JSON.stringify(latest.current) !== snap) { flush(); return; } // edits landed mid-save
        setDirty(false);
        setState("saved");
      } else {
        setState("error");
      }
    } catch {
      savingRef.current = false;
      setState(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "error");
    }
  }, [draftKey]);

  // Restore a journaled draft (max a day old) once on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const d = JSON.parse(raw) as { v?: number; at?: number; payload?: T };
      if (!d || d.v !== 2 || Date.now() - (d.at || 0) > 24 * 3600 * 1000 || d.payload === undefined) {
        localStorage.removeItem(draftKey);
        return;
      }
      onRestoreRef.current?.(d.payload);
    } catch { /* corrupt draft — ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced save: journal the draft first, push 1.2s after the last change.
  useEffect(() => {
    if (serialized === baseline.current) return;
    setDirty(true);
    try { localStorage.setItem(draftKey, JSON.stringify({ v: 2, at: Date.now(), payload: latest.current })); } catch { /* storage full */ }
    const t = setTimeout(flush, 1200);
    return () => clearTimeout(t);
  }, [serialized, draftKey, flush]);

  // Reconnect flush, slow retry on failure, ⌘S saves now, unload guard.
  useEffect(() => {
    const onOnline = () => { if (dirty) flush(); };
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); flush(); } };
    const onLeave = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener("online", onOnline);
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onLeave);
    const retry = setInterval(() => { if (dirty && !savingRef.current && (state === "offline" || state === "error")) flush(); }, 30000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onLeave);
      clearInterval(retry);
    };
  }, [dirty, state, flush]);

  return { state, dirty, saveNow: flush };
}

// The auto-save footer every tab shares (styles: .ms-sync in globals.css).
export function SyncPill({ state, dirty, saveNow }: { state: SyncState; dirty: boolean; saveNow: () => void }) {
  return (
    <div className="flex items-center gap-3 sticky bottom-0 bg-paper/95 py-3">
      <span className={`ms-sync ${state === "saving" ? "is-saving" : state === "offline" ? "is-offline" : state === "error" ? "is-error" : dirty ? "is-dirty" : "is-clean"}`}>
        {state === "saving"
          ? "Saving…"
          : state === "offline"
          ? "Offline — changes kept safe, will sync when you're back"
          : state === "error"
          ? "Couldn't save — retrying automatically"
          : dirty
          ? "Editing…"
          : state === "saved"
          ? "All changes saved ✓"
          : "Auto-save is on"}
      </span>
      {(state === "error" || state === "offline") && (
        <button type="button" onClick={saveNow} className="lq-btn lq-btn--glass lq-btn--sm">Save now</button>
      )}
    </div>
  );
}
