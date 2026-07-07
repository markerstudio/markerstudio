import Link from "next/link";
import { isDbEnabled } from "@/lib/db";
import { getClients } from "@/lib/clients";
import ClientSelectOrType from "@/components/admin/ClientSelectOrType";
import ConfirmButton from "@/components/admin/ConfirmButton";
import { StatTile, EmptyState } from "@/components/ui/glass";
import { createProposalFromTab, setProposalArchived, deleteProposal } from "../actions";

export const dynamic = "force-dynamic";

const ERR: Record<string, string> = {
  client: "Pick a client or type a name.",
};

function badge(label: string, tone: "green" | "orange" | "neutral") {
  const cls = tone === "green" ? "lq-chip--green" : tone === "orange" ? "lq-chip--orange" : "";
  return <span className={`lq-chip ${cls} !text-[11px]`}>{label}</span>;
}

export default async function ProposalsAdmin({ searchParams }: { searchParams: { ok?: string; error?: string; archived?: string } }) {
  const dbOff = !isDbEnabled();
  const showArchived = searchParams.archived === "1";
  const all = dbOff ? [] : await getClients();
  // Archived clients are parked — keep them out of the proposal pipeline entirely.
  const withProposal = all.filter((c) => !c.data.archived && (c.data.onboarding || c.data.proposal));
  const archivedCount = withProposal.filter((c) => c.data.proposal?.archived).length;
  const clients = withProposal.filter((c) => (showArchived ? c.data.proposal?.archived : !c.data.proposal?.archived));

  // Pipeline stats across non-archived proposals.
  const active = withProposal.filter((c) => !c.data.proposal?.archived);
  const drafts = active.filter((c) => !c.data.proposal?.published && !c.data.proposal?.acceptedAt).length;
  const awaiting = active.filter((c) => c.data.proposal?.published && !c.data.proposal?.acceptedAt).length;
  const acceptedList = active.filter((c) => c.data.proposal?.acceptedAt);
  let wonMonthly = 0;
  let wonOnce = 0;
  for (const c of acceptedList) {
    const sel = c.data.proposal?.selection;
    if (sel) {
      wonMonthly += sel.monthly || 0;
      wonOnce += sel.once || 0;
    }
  }

  return (
    <div className="space-y-5">
      <header className="lq-rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-display font-bold uppercase tracking-[0.14em] text-charcoal-60">Sales pipeline</p>
          <h1 className="font-display font-extrabold text-[28px] tracking-tight text-ink leading-tight mt-1">Proposals</h1>
          <p className="text-sm text-charcoal-60 mt-1">Paged, bilingual documents — built in the studio, accepted in the portal.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/admin/proposals"
            className={`lq-btn lq-btn--sm no-underline ${!showArchived ? "lq-btn--dark" : "lq-btn--glass"}`}
          >
            Active
          </Link>
          <Link
            href="/admin/proposals?archived=1"
            className={`lq-btn lq-btn--sm no-underline ${showArchived ? "lq-btn--dark" : "lq-btn--glass"}`}
          >
            Archived <span className="tabular-nums opacity-60">{archivedCount}</span>
          </Link>
        </div>
      </header>

      {searchParams.ok === "deleted" && (
        <p className="lq-card text-sm text-emerald-800 px-4 py-2.5 !border-emerald-300/40">Proposal deleted.</p>
      )}
      {searchParams.error && (
        <p className="lq-card text-sm text-rose-700 px-4 py-2.5 !border-rose-300/40">{ERR[searchParams.error] || "Something went wrong."}</p>
      )}
      {dbOff && <p className="lq-card text-sm text-amber-800 px-4 py-3 !border-amber-300/40">No database configured.</p>}

      {!dbOff && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <StatTile label="Drafts" value={String(drafts)} sub="being prepared" delay={40} />
          <StatTile label="Awaiting acceptance" value={String(awaiting)} sub="sent to clients" tone={awaiting > 0 ? "accent" : "neutral"} delay={90} />
          <StatTile label="Accepted" value={String(acceptedList.length)} sub="proposals won" tone={acceptedList.length > 0 ? "good" : "neutral"} delay={140} />
          <StatTile
            label="Won value"
            value={wonMonthly || wonOnce ? `${(wonMonthly + wonOnce).toLocaleString("en-US")} ₪` : "—"}
            sub={wonMonthly ? `${wonMonthly.toLocaleString("en-US")} ₪/mo recurring` : "from accepted selections"}
            delay={190}
          />
        </div>
      )}

      {!dbOff && (
        <form action={createProposalFromTab} className="lq-card lq-rise p-5 flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-[11px] font-display font-bold uppercase tracking-[0.1em] text-charcoal-60 mb-1.5">Start a proposal</label>
            <ClientSelectOrType clients={all.map((c) => ({ slug: c.slug, name: c.name || c.slug }))} />
          </div>
          <button className="lq-btn lq-btn--primary">
            Open builder →
          </button>
          <p className="text-xs text-charcoal-40 basis-full sm:basis-auto sm:ms-auto">
            Starts from the studio template — cover, scope, work plan, selectable pricing &amp; acceptance.
          </p>
        </form>
      )}

      <div className="lq-card lq-rise divide-y divide-charcoal/5 overflow-hidden">
        {clients.map((c) => {
          const p = c.data.proposal;
          const tone = p?.acceptedAt ? "green" : p?.published ? "orange" : "neutral";
          const label = p?.acceptedAt ? "Accepted" : p?.published ? "Sent" : "Draft";
          const when = p?.acceptedAt || p?.sentAt;
          const sel = p?.selection;
          return (
            <div key={c.slug} className="flex items-center gap-4 px-5 py-3 flex-wrap transition-colors hover:bg-white/60">
              <div className="flex-1 min-w-[160px]">
                <div className="font-semibold text-ink truncate">{c.name}</div>
                <div className="text-xs text-charcoal-60 truncate">
                  /{c.slug}
                  {when && ` · ${new Date(when).toLocaleDateString("en-GB")}`}
                  {p?.acceptedAt && sel && (sel.monthly || sel.once)
                    ? ` · ${[sel.monthly ? `${sel.monthly.toLocaleString("en-US")} ${sel.currency}/mo` : "", sel.once ? `${sel.once.toLocaleString("en-US")} ${sel.currency}` : ""].filter(Boolean).join(" + ")}`
                    : ""}
                  {p?.acceptedAt && p.acceptedBy ? ` · by ${p.acceptedBy}` : ""}
                </div>
              </div>
              {badge(label, tone)}
              <Link href={`/admin/proposals/${c.slug}`} className="text-sm font-semibold text-ink hover:text-orange-deep no-underline">
                Builder →
              </Link>
              <Link href={`/portal/${c.slug}/proposal`} target="_blank" className="text-sm font-medium text-charcoal-60 hover:text-orange-deep no-underline">
                Client view ↗
              </Link>
              <form action={setProposalArchived}>
                <input type="hidden" name="slug" value={c.slug} />
                <input type="hidden" name="archived" value={p?.archived ? "" : "1"} />
                <button className="text-sm font-medium text-charcoal-40 hover:text-ink">{p?.archived ? "Restore" : "Archive"}</button>
              </form>
              {p && (
                <form action={deleteProposal}>
                  <input type="hidden" name="slug" value={c.slug} />
                  <ConfirmButton
                    message={`Delete ${c.name}'s proposal? The client and their pricing stay; only the proposal goes.`}
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
            icon="📄"
            title={showArchived ? "No archived proposals" : "No proposals yet"}
            sub={showArchived ? "Archived proposals will land here." : "Start one above, or they appear when a client onboards."}
          />
        )}
      </div>
    </div>
  );
}
