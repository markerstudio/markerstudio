import { getSession, isPartnerOnly, isPhotographerOnly } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listNotes } from "@/lib/notes";
import { getClients } from "@/lib/clients";
import NotesApp, { type SlimClient } from "@/components/admin/NotesApp";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notes — Marker Admin" };

// Slim client list for the link picker — just enough to name and colour a
// note's chip. Archived clients stay out; a DB hiccup means an empty list,
// never a broken page (studio notes still work without clients).
async function slimClients(): Promise<SlimClient[]> {
  try {
    const clients = await getClients();
    return clients
      .filter((c) => !c.data?.archived)
      .map((c) => ({ slug: c.slug, name: c.name || c.slug, color: c.color || "#303030" }));
  } catch {
    return [];
  }
}

export default async function NotesPage({ searchParams }: { searchParams?: { client?: string } }) {
  const user = await getSession();
  if (!user) redirect("/login");
  if (isPartnerOnly(user)) redirect("/admin/partner");
  if (isPhotographerOnly(user)) redirect("/admin/photographer");

  const [notes, clients] = await Promise.all([listNotes(), slimClients()]);
  const presetClient = String(searchParams?.client || "").trim() || undefined;

  return <NotesApp notes={notes} clients={clients} presetClient={presetClient} />;
}
