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

      {/* Two ways in — the doc-first path was easy to miss after the redesign. */}
      <div className="lq-card lq-rise flex flex-wrap items-stretch gap-0 overflow-hidden !p-0 divide-y sm:divide-y-0 sm:divide-x divide-charcoal/5">
        <div className="flex-1 min-w-[240px] p-4 bg-orange/[0.05]">
          <p className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-orange-deep">You&apos;re here · Manual</p>
          <p className="text-[13px] text-charcoal-80 mt-1 leading-snug">
            Fill the portal yourself — identity, plan, fees. Best when the deal is already agreed.
          </p>
        </div>
        <Link href="/admin/proposals" className="flex-1 min-w-[240px] p-4 no-underline hover:bg-white/70 lq-press">
          <p className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-charcoal-60">Or · From proposal &amp; agreement →</p>
          <p className="text-[13px] text-charcoal-80 mt-1 leading-snug">
            Start with the paperwork: create a proposal for a new name, send it, e-sign the agreement — the client portal grows out of it.
          </p>
        </Link>
      </div>

      <ClientForm projectLogos={projectLogos} />
    </div>
  );
}
