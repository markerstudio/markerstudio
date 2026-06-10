import { notFound } from "next/navigation";
import { getClient } from "@/lib/clients";
import { resolveAgreementDoc } from "@/lib/docs";
import AgreementBuilder from "@/components/admin/docbuilder/AgreementBuilder";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agreement builder · Admin" };

export default async function AgreementBuilderPage({ params }: { params: { slug: string } }) {
  const client = await getClient(params.slug);
  if (!client) notFound();

  const a = client.data.agreement;
  const doc = resolveAgreementDoc(client.name, client.data);
  const status = a?.acceptedAt ? "signed" : a?.published ? "sent" : "draft";
  const signed = a?.acceptedAt ? { at: a.acceptedAt, by: a.signedName || client.name } : null;

  return (
    <AgreementBuilder
      slug={client.slug}
      clientName={client.name || client.slug}
      initialDoc={doc}
      status={status}
      signed={signed}
      sentAt={a?.sentAt}
    />
  );
}
