import Link from "next/link";
import { isDbEnabled } from "@/lib/db";
import { getClients } from "@/lib/clients";
import ClientSelectOrType from "@/components/admin/ClientSelectOrType";
import ConfirmButton from "@/components/admin/ConfirmButton";
import { createProposalFromTab, setProposalArchived, deleteProposal } from "../actions";

export const dynamic = "force-dynamic";

const ERR: Record<string, string> = {
  client: "Pick a client or type a name.",
};

function badge(label: string, tone: "green" | "orange" | "neutral") {
  const cls =
    tone === "green"
      ? "text-green-700 bg-green-50 border border-green-200"
      : tone === "orange"
      ? "text-orange-deep bg-orange-50"
      : "text-neutral-500 bg-neutral-100";
  return <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${cls}`}>{label}</span>;
}

export default async function ProposalsAdmin({ searchParams }: { searchParams: { ok?: string; error?: string; archived?: string } }) {
  const dbOff = !isDbEnabled();
  const showArchived = searchParams.archived === "1";
  const all = dbOff ? [] : await getClients();
  const withProposal = all.filter((c) => c.data.onboarding || c.data.proposal);
  const archivedCount = withProposal.filter((c) => c.data.proposal?.archived).length;
  const clients = withProposal.filter((c) => (showArchived ? c.data.proposal?.archived : !c.data.proposal?.archived));

  return (
    <div>
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Proposals</h1>
        <div className="flex items-center gap-2 text-sm">
          <Link
            href="/admin/proposals"
            className={`rounded-full px-3 py-1.5 font-semibold ${!showArchived ? "bg-charcoal text-white" : "bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-400"}`}
          >
            Active
          </Link>
          <Link
            href="/admin/proposals?archived=1"
            className={`rounded-full px-3 py-1.5 font-semibold ${showArchived ? "bg-charcoal text-white" : "bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-400"}`}
          >
            Archived <span className="tabular-nums opacity-60">{archivedCount}</span>
          </Link>
        </div>
      </div>

      {searchParams.ok === "deleted" && (
        <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-md px-4 py-2.5 mb-6">Proposal deleted.</p>
      )}
      {searchParams.error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-4 py-2.5 mb-6">{ERR[searchParams.error] || "Something went wrong."}</p>
      )}
      {dbOff && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-4 py-3 mb-6">No database configured.</p>}

      {!dbOff && (
        <form action={createProposalFromTab} className="bg-white border border-neutral-200 rounded-xl p-4 mb-6 flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">Start a proposal</label>
            <ClientSelectOrType clients={all.map((c) => ({ slug: c.slug, name: c.name || c.slug }))} />
          </div>
          <button className="bg-orange text-white font-semibold rounded-md px-5 py-2.5 text-sm hover:bg-orange-deep transition-colors">
            Start →
          </button>
          <p className="text-xs text-neutral-400 basis-full sm:basis-auto sm:ml-auto">
            Opens the client&apos;s page to prepare pricing, timeline &amp; the send.
          </p>
        </form>
      )}

      <div className="bg-white border border-neutral-200 rounded-xl divide-y divide-neutral-100">
        {clients.map((c) => {
          const p = c.data.proposal;
          const tone = p?.acceptedAt ? "green" : p?.published ? "orange" : "neutral";
          const label = p?.acceptedAt ? "Accepted" : p?.published ? "Sent" : "Draft";
          const when = p?.acceptedAt || p?.sentAt;
          return (
            <div key={c.slug} className="flex items-center gap-4 px-4 py-3 flex-wrap">
              <div className="flex-1 min-w-[160px]">
                <div className="font-semibold truncate">{c.name}</div>
                <div className="text-xs text-neutral-500 truncate">
                  /{c.slug}
                  {when && ` · ${new Date(when).toLocaleDateString("en-GB")}`}
                </div>
              </div>
              {badge(label, tone)}
              <Link href={`/portal/${c.slug}/proposal`} target="_blank" className="text-sm font-medium text-neutral-600 hover:text-orange">Preview ↗</Link>
              <Link href={`/admin/clients/${c.slug}/edit`} className="text-sm font-medium text-neutral-700 hover:text-orange">Prepare</Link>
              <form action={setProposalArchived}>
                <input type="hidden" name="slug" value={c.slug} />
                <input type="hidden" name="archived" value={p?.archived ? "" : "1"} />
                <button className="text-sm font-medium text-neutral-500 hover:text-charcoal">{p?.archived ? "Restore" : "Archive"}</button>
              </form>
              {p && (
                <form action={deleteProposal}>
                  <input type="hidden" name="slug" value={c.slug} />
                  <ConfirmButton
                    message={`Delete ${c.name}'s proposal? The client and their pricing stay; only the proposal goes.`}
                    className="text-sm font-medium text-neutral-400 hover:text-red-600"
                  >
                    Delete
                  </ConfirmButton>
                </form>
              )}
            </div>
          );
        })}
        {!dbOff && clients.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-neutral-500">
            {showArchived ? "No archived proposals." : "No proposals yet — start one above, or they appear when a client onboards."}
          </div>
        )}
      </div>
    </div>
  );
}
