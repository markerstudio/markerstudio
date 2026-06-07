import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClient } from "@/lib/clients";
import PortalView from "@/components/PortalView";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const client = await getClient(params.slug);
  return { title: client ? `${client.name} · Portal` : "Portal", robots: { index: false, follow: false } };
}

export default async function PortalPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { edit?: string };
}) {
  const s = await getSession();
  if (!s) redirect("/login");

  const client = await getClient(params.slug);
  if (!client) notFound();

  // Clients may only view their own portal; admins may view (and edit) any.
  if (s.role === "client" && s.clientId !== client.id) redirect("/portal");

  const canEdit = s.role === "admin";
  return <PortalView client={client} canEdit={canEdit} initialEdit={canEdit && searchParams?.edit === "1"} />;
}
