import Link from "next/link";
import { notFound } from "next/navigation";
import { getClient } from "@/lib/clients";
import PortalEditor from "@/components/admin/PortalEditor";

export const dynamic = "force-dynamic";

// Dedicated, structured editor for a client's portal content (studio-only).
export default async function PortalEditorPage({ params }: { params: { slug: string } }) {
  const client = await getClient(params.slug);
  if (!client) notFound();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <Link href={`/admin/clients/${client.slug}/edit`} className="text-sm text-neutral-500 hover:text-neutral-900">← {client.name} settings</Link>
          <h1 className="text-2xl font-bold tracking-tight mt-1">Portal content</h1>
          <p className="text-sm text-neutral-500">Everything the client sees in their portal — entered here, kept clean for them.</p>
        </div>
      </div>
      <PortalEditor client={client} />
    </div>
  );
}
