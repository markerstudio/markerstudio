import { getSession, isPartnerOnly } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAgenda } from "@/lib/agenda";
import AgendaView from "@/components/admin/AgendaView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agenda — Marker Admin" };

export default async function AgendaPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (isPartnerOnly(user)) redirect("/admin/partner");

  const agenda = await getAgenda(14);

  return <AgendaView agenda={agenda} />;
}
