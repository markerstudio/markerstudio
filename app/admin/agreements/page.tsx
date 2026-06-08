import Link from "next/link";
import { isDbEnabled } from "@/lib/db";
import { getClients } from "@/lib/clients";

export const dynamic = "force-dynamic";

function badge(label: string, tone: "green" | "orange" | "neutral") {
  const cls =
    tone === "green"
      ? "text-green-700 bg-green-50 border border-green-200"
      : tone === "orange"
      ? "text-orange-deep bg-orange-50"
      : "text-neutral-500 bg-neutral-100";
  return <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${cls}`}>{label}</span>;
}

export default async function AgreementsAdmin() {
  const dbOff = !isDbEnabled();
  const clients = dbOff ? [] : (await getClients()).filter((c) => c.data.onboarding || c.data.agreement);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-6">Agreements</h1>

      {dbOff && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-4 py-3 mb-6">No database configured.</p>
      )}

      <div className="bg-white border border-neutral-200 rounded-xl divide-y divide-neutral-100">
        {clients.map((c) => {
          const a = c.data.agreement;
          const tone = a?.acceptedAt ? "green" : a?.published ? "orange" : "neutral";
          const label = a?.acceptedAt ? "Signed" : a?.published ? "Sent" : "Draft";
          const when = a?.acceptedAt || a?.sentAt;
          return (
            <div key={c.slug} className="flex items-center gap-4 px-4 py-3">
              <div className="flex-1 min-w-0">
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
              <Link href={`/portal/${c.slug}/agreement`} target="_blank" className="text-sm font-medium text-neutral-600 hover:text-orange">Preview ↗</Link>
              <Link href={`/admin/clients/${c.slug}/edit`} className="text-sm font-medium text-neutral-700 hover:text-orange">Prepare</Link>
            </div>
          );
        })}
        {!dbOff && clients.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-neutral-500">No agreements yet — they appear here once a client onboards.</div>
        )}
      </div>
    </div>
  );
}
