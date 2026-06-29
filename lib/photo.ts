// Photography helpers — pure, client-safe (NO db/server imports), so both server
// pages and client components can share them. Types live in lib/clients.ts and
// are pulled in type-only (erased at build), so importing this file never drags
// the DB layer into a client bundle.
import type { ClientPhoto, PhotoSessionStatus, PhotoTaskStatus } from "@/lib/clients";

// Stable id for a shoot / shot. Uses crypto.randomUUID where available (browser
// + modern Node) and falls back to a random+time string otherwise.
export function genPhotoId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `p_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

// Return a copy of the photo block with an id on every shoot/shot that lacks one.
// Non-destructive: assigns ids in memory on read; they only become durable when
// the block is next saved. No bulk migration of stored data.
export function ensurePhotoIds(photo: ClientPhoto | undefined | null): ClientPhoto {
  const p = photo ?? {};
  return {
    ...p,
    sessions: (p.sessions ?? []).map((s) => (s.id ? s : { ...s, id: genPhotoId() })),
    shots: (p.shots ?? []).map((t) => (t.id ? t : { ...t, id: genPhotoId() })),
  };
}

// Status order + the "next" each tap advances to (wraps around).
export const SESSION_ORDER: PhotoSessionStatus[] = ["planned", "confirmed", "shot", "delivered"];
export const TASK_ORDER: PhotoTaskStatus[] = ["todo", "doing", "done"];
export const nextSession = (s: PhotoSessionStatus) => SESSION_ORDER[(SESSION_ORDER.indexOf(s) + 1) % SESSION_ORDER.length];
export const nextTask = (s: PhotoTaskStatus) => TASK_ORDER[(TASK_ORDER.indexOf(s) + 1) % TASK_ORDER.length];

export const SESSION_LABEL: Record<PhotoSessionStatus, string> = { planned: "Planned", confirmed: "Confirmed", shot: "Shot", delivered: "Delivered" };
export const TASK_LABEL: Record<PhotoTaskStatus, string> = { todo: "To do", doing: "In progress", done: "Done" };

export const SESSION_BADGE: Record<PhotoSessionStatus, string> = {
  planned: "text-neutral-600 bg-neutral-100 border-neutral-200",
  confirmed: "text-sky-700 bg-sky-50 border-sky-200",
  shot: "text-amber-700 bg-amber-50 border-amber-200",
  delivered: "text-emerald-700 bg-emerald-50 border-emerald-200",
};
export const TASK_BADGE: Record<PhotoTaskStatus, string> = {
  todo: "text-neutral-600 bg-neutral-100 border-neutral-200",
  doing: "text-amber-700 bg-amber-50 border-amber-200",
  done: "text-emerald-700 bg-emerald-50 border-emerald-200",
};
