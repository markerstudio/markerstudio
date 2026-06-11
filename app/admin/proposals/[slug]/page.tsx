import { notFound } from "next/navigation";
import { getClient } from "@/lib/clients";
import { resolveProposalDoc } from "@/lib/docs";
import ProposalBuilder from "@/components/admin/docbuilder/ProposalBuilder";
import { briefText } from "@/components/admin/docbuilder/ai";

export const dynamic = "force-dynamic";
export const metadata = { title: "Proposal builder · Admin" };

export default async function ProposalBuilderPage({ params }: { params: { slug: string } }) {
  const client = await getClient(params.slug);
  if (!client) notFound();

  const p = client.data.proposal;
  const doc = resolveProposalDoc(client.name, client.data);
  const status = p?.acceptedAt ? "accepted" : p?.published ? "sent" : "draft";
  const accepted = p?.acceptedAt
    ? { at: p.acceptedAt, by: p.acceptedBy, title: p.acceptedTitle, notes: p.acceptedNotes, selection: p.selection }
    : null;

  return (
    <ProposalBuilder
      slug={client.slug}
      clientName={client.name || client.slug}
      initialDoc={doc}
      status={status}
      accepted={accepted}
      sentAt={p?.sentAt}
      briefText={briefText(client.name || client.slug, client.data.onboarding)}
    />
  );
}
