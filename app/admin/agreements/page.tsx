import Link from "next/link";
import { isDbEnabled } from "@/lib/db";
import { getClients } from "@/lib/clients";
import ClientSelectOrType from "@/components/admin/ClientSelectOrType";
import ConfirmButton from "@/components/admin/ConfirmButton";
import { createAgreementFromTab, setAgreementArchived, deleteAgreement } from "../doc-actions";

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

  const stats = [
    { label: "Drafts", value: String(drafts), note: "being prepared" },
    { label: "Out for signature", value: String(awaiting), note: "sent to clients", accent: awaiting > 0 },
    { label: "Signed", value: String(signedCount), note: "agreements in force", green: signedCount > 0 },
  ];

  return (
    <div>
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agreements</h1>
          <p className="text-sm text-neutral-500 mt-0.5">The studio&apos;s standard contract as a paged, bilingual, e-signable document.</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link
            href="/admin/agreements"
            className={`rounded-full px-3 py-1.5 font-semibold ${!showArchived ? "bg-charcoal text-white" : "bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-400"}`}
          >
            Active
          </Link>
          <Link
            href="/admin/agreements?archived=1"
            className={`rounded-full px-3 py-1.5 font-semibold ${showArchived ? "bg-charcoal text-white" : "bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-400"}`}
          >
            Archived <span className="tabular-nums opacity-60">{archivedCount}</span>
          </Link>
        </div>
      </div>

      {searchParams.ok === "deleted" && (
        <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-md px-4 py-2.5 mb-6">Agreement deleted.</p>
      )}
      {searchParams.error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-4 py-2.5 mb-6">{ERR[searchParams.error] || "Something went wrong."}</p>
      )}
      {dbOff && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-4 py-3 mb-6">No database configured.</p>}

      {!dbOff && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {stats.map((s) => (
            <div key={s.label} className="adm-rise bg-white border border-neutral-200 rounded-xl px-4 py-3.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{s.label}</div>
              <div className={`mt-1 text-2xl font-extrabold tabular-nums ${s.green ? "text-green-700" : s.accent ? "text-orange-deep" : "text-neutral-900"}`}>
                {s.value}
              </div>
              <div className="text-xs text-neutral-400">{s.note}</div>
            </div>
          ))}
        </div>
      )}

      {!dbOff && (
        <form action={createAgreementFromTab} className="bg-white border border-neutral-200 rounded-xl p-4 mb-6 flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">Start an agreement</label>
            <ClientSelectOrType clients={all.map((c) => ({ slug: c.slug, name: c.name || c.slug }))} />
          </div>
          <button className="bg-orange text-white font-semibold rounded-md px-5 py-2.5 text-sm hover:bg-orange-deep transition-colors">
            Open builder →
          </button>
          <p className="text-xs text-neutral-400 basis-full sm:basis-auto sm:ml-auto">
            Starts from the studio&apos;s standard contract — edit any clause, then send for e-signature.
          </p>
        </form>
      )}

      <div className="bg-white border border-neutral-200 rounded-xl divide-y divide-neutral-100">
        {clients.map((c) => {
          const a = c.data.agreement;
          const tone = a?.acceptedAt ? "green" : a?.published ? "orange" : "neutral";
          const label = a?.acceptedAt ? "Signed" : a?.published ? "Sent" : "Draft";
          const when = a?.acceptedAt || a?.sentAt;
          return (
            <div key={c.slug} className="flex items-center gap-4 px-4 py-3 flex-wrap">
              <div className="flex-1 min-w-[160px]">
                <div className="font-semibold truncate">
                  {c.name}
                  {a?.signedName && <span className="ml-2 text-xs font-normal text-neutral-500">signed by {a.signedName}</span>}
                </div>
                <div className="text-xs text-neutral-500 truncate">
                  /{c.slug}
                  {when && ` · ${new Date(when).toLocaleDateString("en-GB")}`}
                </div>
              </div>
              {badge(label, tone)}
              <Link href={`/admin/agreements/${c.slug}`} className="text-sm font-semibold text-charcoal hover:text-orange">
                Builder →
              </Link>
              <Link href={`/portal/${c.slug}/agreement`} target="_blank" className="text-sm font-medium text-neutral-600 hover:text-orange">
                Client view ↗
              </Link>
              <form action={setAgreementArchived}>
                <input type="hidden" name="slug" value={c.slug} />
                <input type="hidden" name="archived" value={a?.archived ? "" : "1"} />
                <button className="text-sm font-medium text-neutral-500 hover:text-charcoal">{a?.archived ? "Restore" : "Archive"}</button>
              </form>
              {a && (
                <form action={deleteAgreement}>
                  <input type="hidden" name="slug" value={c.slug} />
                  <ConfirmButton
                    message={`Delete ${c.name}'s agreement? The client record stays; only the agreement goes.`}
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
            {showArchived ? "No archived agreements." : "No agreements yet — start one above, or they appear when a client onboards."}
          </div>
        )}
      </div>
    </div>
  );
}
