import Link from "next/link";
import ClientForm from "@/components/admin/ClientForm";
import { getProjects } from "@/lib/projects";

export const dynamic = "force-dynamic";

export default async function NewClientPage() {
  const projects = await getProjects().catch(() => []);
  const projectLogos = projects.map((p) => ({ slug: p.slug, name: p.name.en, logo: p.logo }));
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 lq-rise">
        <div>
          <p className="text-[11px] font-display font-bold uppercase tracking-[0.14em] text-charcoal-60">Clients</p>
          <h1 className="font-display font-extrabold text-[28px] tracking-tight text-ink leading-tight mt-1">New client</h1>
        </div>
        <Link href="/admin/clients" className="lq-btn lq-btn--glass lq-btn--sm no-underline">← Back to clients</Link>
      </header>
      <ClientForm projectLogos={projectLogos} />
    </div>
  );
}
