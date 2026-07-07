import Link from "next/link";
import { isDbEnabled } from "@/lib/db";
import { getClients } from "@/lib/clients";
import ClientSelectOrType from "@/components/admin/ClientSelectOrType";
import ConfirmButton from "@/components/admin/ConfirmButton";
import { StatTile, EmptyState } from "@/components/ui/glass";
import { createAgreementFromTab, setAgreementArchived, deleteAgreement } from "../doc-actions";

export const dynamic = "force-dynamic";

const ERR: Record<string, string> = {
  client: "Pick a client or type a name.",
};

function badge(label: string, tone: "green" | "orange" | "neutral") {
  const cls = tone === "green" ? "lq-chip--green" : tone === "orange" ? "lq-chip--orange" : "";
  return <span className={`lq-chip ${cls} !text-[11px]`}>{label}</span>;
}

export default async function AgreementsAdmin({ searchParams }: { searchParams: { ok?: string; error?: string; archived?: string } }) {
  const dbOff = !isDbEnabled();
  const showArchived = searchParams.archived === "1";
  const all = dbOff ? [] : await getClients();
  // Archived clients are parked — keep them out of the agreement pipeline entirely.
  const withAgreement = all.filter((c) => !c.data.archived && (c.data.onboarding || c.data.agreement));
  const archivedCount = withAgreement.filter((c) => c.data.agreement?.archived).length;
  const clients = withAgreement.filter((c) => (showArchived ? c.data.agreement?.archived : !c.data.agreement?.archived));

  const active = withAgreement.filter((c) => !c.data.agreement?.archived);
  const drafts = active.filter((c) => !c.data.agreement?.published && !c.data.agreement?.acceptedAt).length;
  const awaiting = active.filter((c) => c.data.agreement?.published && !c.data.agreement?.acceptedAt).length;
  const signedCount = active.filter((c) => c.data.agreement?.acceptedAt).length;

  return (
    <div className="space-y-5">
      <header className="lq-rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-display font-bold uppercase tracking-[0.14em] text-charcoal-60">Contracts</p>
          <h1 className="font-display font-extrabold text-[28px] tracking-tight text-ink leading-tight mt-1">Agreements</h1>
          <p className="text-sm text-charcoal-60 mt-1">The studio&apos;s standard contract as a paged, bilingual, e-signable document.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/admin/agreements"
            className={`lq-btn lq-btn--sm no-underline ${!showArchived ? "lq-btn--dark" : "lq-btn--glass"}`}
          >
            Active
          </Link>
          <Link
            href="/admin/agreements?archived=1"
            className={`lq-btn lq-btn--sm no-underline ${showArchived ? "lq-btn--dark" : "lq-btn--glass"}`}
          >
            Archived <span className="tabular-nums opacity-60">{archivedCount}</span>
          </Link>
        </div>
      </header>

      {searchParams.ok === "deleted" && (
        <p className="lq-card text-sm text-emerald-800 px-4 py-2.5 !border-emerald-300/40">Agreement deleted.</p>
      )}
      {searchParams.error && (
        <p className="lq-card text-sm text-rose-700 px-4 py-2.5 !border-rose-300/40">{ERR[searchParams.error] || "Something went wrong."}</p>
      )}
      {dbOff && <p className="lq-card text-sm text-amber-800 px-4 py-3 !border-amber-300/40">No database configured.</p>}

      {!dbOff && (
        <div className="grid sm:grid-cols-3 gap-3.5">
          <StatTile label="Drafts" value={String(drafts)} sub="being prepared" delay={40} />
          <StatTile label="Out for signature" value={String(awaiting)} sub="sent to clients" tone={awaiting > 0 ? "accent" : "neutral"} delay={90} />
          <StatTile label="Signed" value={String(signedCount)} sub="agreements in force" tone={signedCount > 0 ? "good" : "neutral"} delay={140} />
        </div>
      )}

      {!dbOff && (
        <form action={createAgreementFromTab} className="lq-card lq-rise p-5 flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-[11px] font-display font-bold uppercase tracking-[0.1em] text-charcoal-60 mb-1.5">Start an agreement</label>
            <ClientSelectOrType clients={all.map((c) => ({ slug: c.slug, name: c.name || c.slug }))} />
          </div>
          <button className="lq-btn lq-btn--primary">
            Open builder →
          </button>
          <p className="text-xs text-charcoal-40 basis-full sm:basis-auto sm:ms-auto">
            Starts from the studio&apos;s standard contract — edit any clause, then send for e-signature.
          </p>
        </form>
      )}

      <div className="lq-card lq-rise divide-y divide-charcoal/5 overflow-hidden">
        {clients.map((c) => {
          const a = c.data.agreement;
          const tone = a?.acceptedAt ? "green" : a?.published ? "orange" : "neutral";
          const label = a?.acceptedAt ? "Signed" : a?.published ? "Sent" : "Draft";
          const when = a?.acceptedAt || a?.sentAt;
          return (
            <div key={c.slug} className="flex items-center gap-4 px-5 py-3 flex-wrap transition-colors hover:bg-white/60">
              <div className="flex-1 min-w-[160px]">
                <div className="font-semibold text-ink truncate">
                  {c.name}
                  {a?.signedName && <span className="ms-2 text-xs font-normal text-charcoal-60">signed by {a.signedName}</span>}
                </div>
                <div className="text-xs text-charcoal-60 truncate">
                  /{c.slug}
                  {when && ` · ${new Date(when).toLocaleDateString("en-GB")}`}
                </div>
              </div>
              {badge(label, tone)}
              <Link href={`/admin/agreements/${c.slug}`} className="text-sm font-semibold text-ink hover:text-orange-deep no-underline">
                Builder →
              </Link>
              <Link href={`/portal/${c.slug}/agreement`} target="_blank" className="text-sm font-medium text-charcoal-60 hover:text-orange-deep no-underline">
                Client view ↗
              </Link>
              <form action={setAgreementArchived}>
                <input type="hidden" name="slug" value={c.slug} />
                <input type="hidden" name="archived" value={a?.archived ? "" : "1"} />
                <button className="text-sm font-medium text-charcoal-40 hover:text-ink">{a?.archived ? "Restore" : "Archive"}</button>
              </form>
              {a && (
                <form action={deleteAgreement}>
                  <input type="hidden" name="slug" value={c.slug} />
                  <ConfirmButton
                    message={`Delete ${c.name}'s agreement? The client record stays; only the agreement goes.`}
                    className="text-sm font-medium text-charcoal-40 hover:text-rose-600"
                  >
                    Delete
                  </ConfirmButton>
                </form>
              )}
            </div>
          );
        })}
        {!dbOff && clients.length === 0 && (
          <EmptyState
            icon="✍️"
            title={showArchived ? "No archived agreements" : "No agreements yet"}
            sub={showArchived ? "Archived agreements will land here." : "Start one above, or they appear when a client onboards."}
          />
        )}
      </div>
    </div>
  );
}
