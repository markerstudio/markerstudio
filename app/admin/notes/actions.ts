"use server";

// Server actions for the Notes app. Same contract as the deliverables board:
// every action guards the session, returns { ok } / { ok:false, error }, and
// revalidates the notes page. Partner-only (Ramzi) and photographer-only
// (Ameer) accounts are confined to their own areas — no notes access.
import { getSession, isPartnerOnly, isPhotographerOnly } from "@/lib/auth";
import {
  createNote,
  updateNote,
  setNotePinned,
  archiveNote,
  deleteNote,
  type Note,
} from "@/lib/notes";

type Result = { ok: boolean; error?: string };

async function guard(): Promise<Result | null> {
  const user = await getSession();
  if (!user) return { ok: false, error: "Not signed in." };
  if (isPartnerOnly(user) || isPhotographerOnly(user)) return { ok: false, error: "No access." };
  return null;
}

// Where a note points: an existing client, a freeform label (someone new /
// extra context), or nothing (a plain studio note). Slug wins when both come.
function cleanLink(input: { clientSlug?: string | null; contextLabel?: string | null }): {
  clientSlug: string | null;
  contextLabel: string | null;
} {
  const slug = String(input.clientSlug || "").trim().toLowerCase().slice(0, 120);
  const label = String(input.contextLabel || "").trim().slice(0, 120);
  if (slug) return { clientSlug: slug, contextLabel: null };
  if (label) return { clientSlug: null, contextLabel: label };
  return { clientSlug: null, contextLabel: null };
}

export async function createNoteAction(input: {
  title?: string;
  body?: string;
  clientSlug?: string | null;
  contextLabel?: string | null;
}): Promise<Result & { note?: Note }> {
  const denied = await guard();
  if (denied) return denied;
  const title = String(input.title || "").trim().slice(0, 300);
  const body = String(input.body || "").trim().slice(0, 20000);
  if (!title && !body) return { ok: false, error: "Write something first." };
  try {
    const note = await createNote({ title, body, ...cleanLink(input) });
    if (!note) return { ok: false, error: "Save failed — no database." };
    return { ok: true, note };
  } catch {
    return { ok: false, error: "Save failed — try again." };
  }
}

export async function updateNoteAction(
  id: number,
  patch: { title?: string; body?: string; clientSlug?: string | null; contextLabel?: string | null }
): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;
  if (!Number.isFinite(id) || id <= 0) return { ok: false, error: "Missing note." };
  const p: { title?: string; body?: string; clientSlug?: string | null; contextLabel?: string | null } = {};
  if (patch.title !== undefined) p.title = String(patch.title).trim().slice(0, 300);
  if (patch.body !== undefined) p.body = String(patch.body).trim().slice(0, 20000);
  // The link travels as a pair — when either field is sent, resolve both so a
  // note can move client → label → studio without leftovers.
  if (patch.clientSlug !== undefined || patch.contextLabel !== undefined) {
    const link = cleanLink(patch);
    p.clientSlug = link.clientSlug;
    p.contextLabel = link.contextLabel;
  }
  if (p.title !== undefined && p.body !== undefined && !p.title && !p.body) {
    return { ok: false, error: "A note needs a title or some text." };
  }
  try {
    const ok = await updateNote(id, p);
    if (!ok) return { ok: false, error: "Note not found — refresh the page." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Save failed — try again." };
  }
}

export async function setNotePinnedAction(id: number, pinned: boolean): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;
  if (!Number.isFinite(id) || id <= 0) return { ok: false, error: "Missing note." };
  try {
    const ok = await setNotePinned(id, !!pinned);
    if (!ok) return { ok: false, error: "Save failed — no database." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Save failed — try again." };
  }
}

export async function archiveNoteAction(id: number): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;
  if (!Number.isFinite(id) || id <= 0) return { ok: false, error: "Missing note." };
  try {
    const ok = await archiveNote(id);
    if (!ok) return { ok: false, error: "Save failed — no database." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Archive failed — try again." };
  }
}

export async function deleteNoteAction(id: number): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;
  if (!Number.isFinite(id) || id <= 0) return { ok: false, error: "Missing note." };
  try {
    const ok = await deleteNote(id);
    if (!ok) return { ok: false, error: "Save failed — no database." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Delete failed — try again." };
  }
}
