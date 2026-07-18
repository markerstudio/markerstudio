import { getSession, isPartnerOnly, isPhotographerOnly } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getNote } from "@/lib/notes";
import { notePrintHtml } from "@/lib/noteHtml";

// The note as a clean print document — no admin chrome, auto-opens the print
// dialog ("Save as PDF"). Exists mainly for the desktop app: WKWebView can't
// open a blank window and write into it the way the browser export does, so
// the DMG opens this route in a native preview window instead. Lives outside
// /admin to skip the shell layout; the session guard below mirrors /admin/notes.
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: "Note — Marker Studio", robots: { index: false, follow: false } };
}

export default async function NotePrintPage({ params }: { params: { id: string } }) {
  const user = await getSession();
  if (!user) redirect("/login");
  if (isPartnerOnly(user)) redirect("/admin/partner");
  if (isPhotographerOnly(user)) redirect("/admin/photographer");

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const note = await getNote(id);
  if (!note) notFound();

  const { html } = notePrintHtml(note);
  // Everything in `html` is escaped by lib/noteHtml before any tag wrapping —
  // note text cannot inject markup here.
  return <div dir="auto" dangerouslySetInnerHTML={{ __html: html }} />;
}
