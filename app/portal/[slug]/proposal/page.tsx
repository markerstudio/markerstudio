import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClient } from "@/lib/clients";
import { resolveProposalDoc } from "@/lib/docs";
import { acceptProposalDoc } from "@/app/portal-doc-actions";
import ProposalDocument from "@/components/docs/ProposalDocument";

export const dynamic = "force-dynamic";
export const metadata = { title: "Proposal · Marker Studio", robots: { index: false, follow: false } };

export default async function ProposalPage({ params }: { params: { slug: string } }) {
  const s = await getSession();
  if (!s) redirect("/login");

  const client = await getClient(params.slug);
  if (!client) notFound();
  if (s.role === "client" && s.clientId !== client.id) redirect("/portal");

  // Clients only see the proposal once the studio has sent it; admins preview freely.
  const p = client.data.proposal;
  if (s.role === "client" && !p?.published) redirect(`/portal/${client.slug}`);

  const doc = resolveProposalDoc(client.name, client.data);
  const status = p?.acceptedAt ? "accepted" : p?.published ? "sent" : "draft";
  const accepted = p?.acceptedAt
    ? {
        at: p.acceptedAt,
        by: p.acceptedBy || client.data.onboarding?.brandName || client.name,
        title: p.acceptedTitle,
        notes: p.acceptedNotes,
        selection: p.selection,
      }
    : null;

  const ar = client.data.onboarding?.lang === "ar";
  return (
    <main style={{ background: "#33312e", minHeight: "100vh" }}>
      {/* Way back home — the document is a dead end without it. */}
      <a
        href={`/portal/${client.slug}`}
        dir={ar ? "rtl" : "ltr"}
        className="print:hidden fixed top-4 start-4 z-50 lq-btn lq-btn--glass lq-btn--sm no-underline"
      >
        {ar ? "→ البوابة" : "← Portal"}
      </a>
      <ProposalDocument
        doc={doc}
        clientName={client.name}
        clientSlug={client.slug}
        mode="portal"
        status={status}
        accepted={accepted}
        onAccept={acceptProposalDoc}
        initialLang={client.data.onboarding?.lang === "ar" ? "ar" : "en"}
      />
    </main>
  );
}
