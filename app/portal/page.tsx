import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClientById } from "@/lib/clients";

export const dynamic = "force-dynamic";

// Sends each role to the right place: admins to the client manager, clients to
// their own portal.
export default async function PortalIndex() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.role !== "client") redirect("/admin/clients");

  const client = s.clientId ? await getClientById(s.clientId) : undefined;
  if (!client) redirect("/login");
  redirect(`/portal/${client.slug}`);
}
