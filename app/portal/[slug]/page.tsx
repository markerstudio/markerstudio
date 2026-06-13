import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getClient } from "@/lib/clients";
import { getLiveNotionClient } from "@/lib/notion";
import { getLiveMetaAnalysis } from "@/lib/meta";
import { isDbEnabled } from "@/lib/db";
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
      };
      if (live.invoices.length) d.invoices = live.invoices;
    }
  }

  // Live Meta (Facebook + Instagram) insights — fetched server-side (the access
  // token stays here, never reaching the client component) and merged into the
  // Analysis tab. Cached ~15 min; falls back silently to the saved metrics.
  if (!editing && isDbEnabled() && client.data.analysis) {
    const meta = await getLiveMetaAnalysis(client.id);
    if (meta) {
      if (meta.organic.length) client.data.analysis.organic.metrics = meta.organic;
      if (meta.campaigns.length) {
        client.data.analysis.paid.campaigns = meta.campaigns;
        if (meta.spend) client.data.analysis.paid.spend = meta.spend;
      }
    }
  }

  const ar = client.data.onboarding?.lang === "ar";
  const proposalSent = !!client.data.proposal?.published;
  const proposalAccepted = !!client.data.proposal?.acceptedAt;
  const agreementSent = !!client.data.agreement?.published;
  const agreementSigned = !!client.data.agreement?.acceptedAt;

  // Banners only appear once the studio has actually sent each document.
  let banner: { text: string; cta: string; href: string } | null = null;
  if (proposalSent && !proposalAccepted) {
    banner = {
      text: ar ? "عرضك جاهز للمراجعة." : "Your proposal is ready to review.",
      cta: ar ? "عرض العرض ←" : "View proposal →",
      href: `/portal/${client.slug}/proposal`,
    };
  } else if (agreementSent && !agreementSigned) {
    banner = {
      text: ar ? "اتفاقية الخدمة جاهزة للتوقيع." : "Your service agreement is ready to sign.",
      cta: ar ? "مراجعة وتوقيع ←" : "Review & sign →",
      href: `/portal/${client.slug}/agreement`,
    };
  }

  return (
    <>
      {banner && (
        <div className="bg-orange text-white" dir={ar ? "rtl" : "ltr"}>
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-2.5 text-sm">
            <span className="font-medium">{banner.text}</span>
            <Link href={banner.href} className="shrink-0 font-semibold underline underline-offset-2 hover:opacity-90">
              {banner.cta}
            </Link>
          </div>
        </div>
      )}
      <PortalView client={client} canEdit={canEdit} initialEdit={editing} />
    </>
  );
}
