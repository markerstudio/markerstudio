import Link from "next/link";
import { createClient } from "@/app/admin/actions";
import { getProjects } from "@/lib/projects";
import { getSession, isPartnerOnly } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Creation is one field: the name. Everything else — plan, portal content,
// logins, Notion/Meta — is authored in the tabbed editor you land in next.
export default async function NewClientPage({ searchParams }: { searchParams: { error?: string } }) {
  const projects = await getProjects().catch(() => []);
  const projectLogos = projects.map((p) => ({ slug: p.slug, name: p.name.en, logo: p.logo })).filter((p) => p.logo);
  const partnerOnly = isPartnerOnly(await getSession());

  return (
    <div className="space-y-5 max-w-[720px]">
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
          <p className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-orange-deep">You&apos;re here · Start now</p>
          <p className="text-[13px] text-charcoal-80 mt-1 leading-snug">
            Name the client, open their workspace, build as you go. Best when the deal is already agreed.
          </p>
        </div>
        <Link href="/admin/proposals" className="flex-1 min-w-[240px] p-4 no-underline hover:bg-white/70 lq-press">
          <p className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-charcoal-60">Or · From proposal &amp; agreement →</p>
          <p className="text-[13px] text-charcoal-80 mt-1 leading-snug">
            Start with the paperwork: create a proposal, send it, e-sign the agreement — the portal grows out of it.
          </p>
        </Link>
      </div>

      <form action={createClient} className="lq-card lq-rise p-5 space-y-5">
        {searchParams.error === "name" && (
          <p className="text-sm text-rose-700">Give the client a name first.</p>
        )}
        <div>
          <label className="block text-[11px] font-display font-bold uppercase tracking-[0.1em] text-charcoal-60 mb-1" htmlFor="nc-name">Client / brand name</label>
          <input id="nc-name" name="name" required autoFocus className="lq-input w-full !text-[17px] !py-3" placeholder="Gardenia" />
          <p className="text-xs text-charcoal-40 mt-1.5">That&apos;s all that&apos;s required — you&apos;ll land in their workspace to set up the plan, portal and logins.</p>
        </div>

        <details>
          <summary className="cursor-pointer select-none text-[12px] font-display font-bold uppercase tracking-[0.1em] text-charcoal-60">Optional — logo, color{partnerOnly ? "" : ", owner"}</summary>
          <div className="pt-4 space-y-4">
            <div>
              <label className="block text-[11px] font-display font-bold uppercase tracking-[0.1em] text-charcoal-60 mb-1" htmlFor="nc-logo">Logo URL</label>
              <input id="nc-logo" name="logo" className="lq-input w-full" placeholder="https://…/logo.png" list="nc-project-logos" />
              {projectLogos.length > 0 && (
                <datalist id="nc-project-logos">
                  {projectLogos.map((p) => <option key={p.slug} value={p.logo}>{p.name}</option>)}
                </datalist>
              )}
            </div>
            <div className="flex items-end gap-6 flex-wrap">
              <div>
                <label className="block text-[11px] font-display font-bold uppercase tracking-[0.1em] text-charcoal-60 mb-1" htmlFor="nc-color">Accent color</label>
                <input id="nc-color" name="color" type="color" defaultValue="#303030" className="h-10 w-16 rounded-lg border border-charcoal/10 bg-white p-1" />
              </div>
              {!partnerOnly && (
                <div>
                  <label className="block text-[11px] font-display font-bold uppercase tracking-[0.1em] text-charcoal-60 mb-1" htmlFor="nc-owner">Owner</label>
                  <select id="nc-owner" name="owner" className="lq-input">
                    <option value="marker">Marker Studio (books in Notion)</option>
                    <option value="ramzi">Ramzi — partner client (kept out of Notion)</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        </details>

        <button className="lq-btn lq-btn--primary">Create &amp; open workspace →</button>
      </form>
    </div>
  );
}
