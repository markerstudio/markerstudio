import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClient } from "@/lib/clients";
import { getLiveNotionClient } from "@/lib/notion";
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
  const editing = canEdit && searchParams?.edit === "1";

  // Auto-refresh finance/plan from Notion on view (cached ~5 min). Skipped while
  // an admin is editing, so they work against the saved snapshot. Only overwrite
  // fields Notion actually returned, so a partial read never wipes saved data.
  if (!editing && client.data?.notionPageId) {
    const live = await getLiveNotionClient(client.data.notionPageId);
    if (live) {
      const d = client.data;
      d.plan = {
        ...d.plan,
        name: live.planName || d.plan.name,
        active: live.active,
        start: live.start || d.plan.start,
        end: live.end || d.plan.end,
        balance: live.balance || d.plan.balance,
      };
      d.finance = {
        monthlyFee: live.monthlyFee || d.finance?.monthlyFee || "",
        progress: live.progress || d.finance?.progress || 0,
        brandingFee: live.brandingFee || d.finance?.brandingFee || "",
        brandingProgress: live.brandingProgress || d.finance?.brandingProgress || 0,
        brandingLeft: live.brandingLeft || d.finance?.brandingLeft || "",
      };
      if (live.invoices.length) d.invoices = live.invoices;
    }
  }

  return <PortalView client={client} canEdit={canEdit} initialEdit={editing} />;
}
