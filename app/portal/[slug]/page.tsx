import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getClient } from "@/lib/clients";
import { clientInvoiceFinanceIls, clientStoriesFinanceIls } from "@/lib/invoices";
import { amountLabelToIls } from "@/lib/money";
import { getLiveNotionClient } from "@/lib/notion";
import { getLiveMetaAnalysis } from "@/lib/meta";
import { isDbEnabled, getSql } from "@/lib/db";
import PortalView from "@/components/PortalView";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const client = await getClient(params.slug);
  return { title: client ? `${client.name} · Portal` : "Portal", robots: { index: false, follow: false } };
}

export default async function PortalPage({ params }: { params: { slug: string } }) {
  const s = await getSession();
  if (!s) redirect("/login");

  const client = await getClient(params.slug);
  if (!client) notFound();

  // Clients may only view their own portal; admins may view (and edit) any.
  if (s.role === "client" && s.clientId !== client.id) redirect("/portal");

  // Archived clients are parked: the client can't open the portal (a redirect
  // would loop via /portal, so show a notice instead). Admins still see it.
  if (s.role === "client" && client.data?.archived) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-cream px-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold text-charcoal mb-2">This portal isn&apos;t active right now</h1>
          <p className="text-neutral-600">
            Your portal is paused. If you think this is a mistake, please reach out to Marker Studio and we&apos;ll get you back in.
          </p>
        </div>
      </main>
    );
  }

  // Portal is view-only. Editing a client's content lives in admin Settings
  // (/admin/clients/[slug]/edit) — the in-portal editor was removed.

  // Auto-refresh finance/plan from Notion on view (cached ~5 min). Only overwrite
  // fields Notion actually returned, so a partial read never wipes saved data —
  // and spread the existing finance so app-only fields (stories fee/active,
  // totals) survive the refresh. The pulled snapshot is then PERSISTED so recent
  // payments stay intact in the app without a manual "Refresh from Notion" each
  // visit (best-effort; never blocks the render).
  if (client.data?.notionPageId) {
    const before = JSON.stringify(client.data);
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
        ...d.finance,
        monthlyFee: live.monthlyFee || d.finance?.monthlyFee || "",
        progress: live.progress || d.finance?.progress || 0,
        brandingFee: live.brandingFee || d.finance?.brandingFee || "",
      };
      if (live.invoices.length) d.invoices = live.invoices;
    }
    if (isDbEnabled() && JSON.stringify(client.data) !== before) {
      try {
        await getSql()`UPDATE clients SET data = ${JSON.stringify(client.data)}::jsonb, updated_at = now() WHERE id = ${client.id}`;
      } catch {
        /* best-effort — the in-memory snapshot still renders this view */
      }
    }
  }

  // Client-facing money is the COMBINED figure — marketing/branding + stories —
  // so a 1,800 invoice split 1,000 stories / 800 marketing never reads as "800
  // left". How we combine depends on where the marketing money lives:
  //   • Linked to Notion: Notion OWNS the marketing/branding balance (the block
  //     above already set it). We only ADD the app's stories on top — never
  //     replace Notion's number — so a Notion-driven client is never clobbered.
  //   • Not linked: everything lives in the app's own invoices (which already
  //     include the stories lines), so we use that combined figure directly.
  if (isDbEnabled()) {
    try {
      const d = client.data;
      if (d.notionPageId) {
        const stories = await clientStoriesFinanceIls(client.id, client.slug);
        if (stories.billedIls > 0) {
          const markerLeft = amountLabelToIls(d.plan?.balance || "");
          const combinedLeft = markerLeft + stories.openIls;
          d.plan = { ...d.plan, balance: `${combinedLeft.toLocaleString("en-US")} ILS` };
          // Fold the stories side into Paid %. Reconstruct Marker's paid/total
          // from Notion's balance + progress (clean when 0<p<100), then combine.
          if (!d.finance) d.finance = { monthlyFee: "", progress: 0 };
          const p = Math.max(0, Math.min(100, d.finance.progress || 0));
          // Reconstruct Marker's paid from (left, progress%). Clamp it: near
          // p=100 the ratio explodes, so cap at 100× the balance (≈99% paid) to
          // keep the combined % sane. Money-left above is exact regardless.
          const markerPaid = p > 0 && p < 100 ? Math.min(markerLeft * 100, (markerLeft * p) / (100 - p)) : 0;
          const total = markerPaid + markerLeft + stories.billedIls;
          const paid = markerPaid + stories.collectedIls;
          if (total > 0) d.finance.progress = Math.max(0, Math.min(100, Math.round((paid / total) * 100)));
        }
      } else {
        const appFin = await clientInvoiceFinanceIls(client.id);
        if (appFin.count > 0) {
          d.plan = { ...d.plan, balance: `${appFin.openIls.toLocaleString("en-US")} ILS` };
          if (!d.finance) d.finance = { monthlyFee: "", progress: 0 };
          d.finance.progress = appFin.totalIls > 0 ? Math.round((appFin.paidIls / appFin.totalIls) * 100) : d.finance.progress;
        }
      }
    } catch {
      /* keep the Notion / saved figures */
    }
  }

  // Live Meta (Facebook + Instagram) insights — fetched server-side (the access
  // token stays here, never reaching the client component) and merged into the
  // Analysis tab. Cached ~15 min; falls back silently to the saved metrics.
  let metaLive = false;
  if (isDbEnabled() && client.data.analysis) {
    const meta = await getLiveMetaAnalysis(client.id);
    if (meta && (meta.organic.length || meta.campaigns.length)) {
      metaLive = true;
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
      <PortalView client={client} metaLive={metaLive} />
    </>
  );
}
