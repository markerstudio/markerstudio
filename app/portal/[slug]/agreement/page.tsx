import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClient } from "@/lib/clients";
import { resolveAgreementDoc } from "@/lib/docs";
import { signAgreementDoc } from "@/app/portal-doc-actions";
import AgreementDocument from "@/components/docs/AgreementDocument";

export const dynamic = "force-dynamic";
export const metadata = { title: "Service Agreement · Marker Studio", robots: { index: false, follow: false } };

export default async function AgreementPage({ params }: { params: { slug: string } }) {
  const s = await getSession();
  if (!s) redirect("/login");

  const client = await getClient(params.slug);
  if (!client) notFound();
  if (s.role === "client" && s.clientId !== client.id) redirect("/portal");

  const a = client.data.agreement;
  if (s.role === "client" && !a?.published) redirect(`/portal/${client.slug}`);

  const doc = resolveAgreementDoc(client.name, client.data);
  const status = a?.acceptedAt ? "signed" : a?.published ? "sent" : "draft";
  const signed = a?.acceptedAt ? { at: a.acceptedAt, by: a.signedName || client.name } : null;

  return (
    <main style={{ background: "#33312e", minHeight: "100vh" }}>
      <AgreementDocument
        doc={doc}
        clientName={client.name}
        clientSlug={client.slug}
        mode="portal"
        status={status}
        signed={signed}
        onSign={signAgreementDoc}
        initialLang={client.data.onboarding?.lang === "ar" ? "ar" : "en"}
      />
    </main>
  );
}
