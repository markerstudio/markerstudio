import Link from "next/link";
import { isDbEnabled } from "@/lib/db";
import { getConsentForms, getConsentSignatures, type ConsentSignature } from "@/lib/consents";
import ConsentLinkActions from "@/components/admin/ConsentLinkActions";
import ConfirmButton from "@/components/admin/ConfirmButton";
import { createConsentForm, deleteConsentForm, deleteConsentSignature } from "../consent-actions";

export const dynamic = "force-dynamic";

const OK: Record<string, string> = {
  created: "Consent form created — open it on the iPad or send the link below.",
  deleted: "Consent form deleted.",
  "signature-deleted": "Signature deleted.",
};
const ERR: Record<string, string> = {
  label: "Give the form a label (e.g. the shoot or client name).",
};

const inputCls =
  "border border-neutral-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange/40 focus:border-orange";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function ConsentsAdmin({ searchParams }: { searchParams: { ok?: string; error?: string } }) {
  const dbOff = !isDbEnabled();
  const forms = await getConsentForms();
  const signaturesByForm = new Map<number, ConsentSignature[]>(
    await Promise.all(forms.map(async (f) => [f.id, await getConsentSignatures(f.id)] as const))
  );
  const totalSignatures = forms.reduce((n, f) => n + f.signatures, 0);

  const stats = [
    { label: "Forms", value: String(forms.length), note: "signing links" },
    { label: "Signatures", value: String(totalSignatures), note: "consents collected", green: totalSignatures > 0 },
    {
      label: "Latest",
      value: forms.some((f) => f.last_signed_at)
        ? fmtDate(forms.map((f) => f.last_signed_at).filter(Boolean).sort().reverse()[0] as string)
        : "—",
      note: "most recent signature",
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Consent forms</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Photo/video release forms — sign in person on an iPad (finger or pencil) or send the link to a client. One link can collect any number of signatures.
        </p>
      </div>

      {searchParams.ok && (
        <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-md px-4 py-2.5 mb-6">{OK[searchParams.ok] || "Done."}</p>
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
              <div className={`mt-1 text-2xl font-extrabold tabular-nums ${s.green ? "text-green-700" : "text-neutral-900"}`}>{s.value}</div>
              <div className="text-xs text-neutral-400">{s.note}</div>
            </div>
          ))}
        </div>
      )}

      {!dbOff && (
        <form action={createConsentForm} className="bg-white border border-neutral-200 rounded-xl p-4 mb-6 flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">New consent form</label>
            <input name="label" required className={`${inputCls} w-full`} placeholder="e.g. Bethlehem shoot — June 2026" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">Opens in</label>
            <select name="lang" className={inputCls} defaultValue="en">
              <option value="en">English</option>
              <option value="ar">عربي</option>
            </select>
          </div>
          <button className="bg-orange text-white font-semibold rounded-md px-5 py-2.5 text-sm hover:bg-orange-deep transition-colors">
            Create signing link →
          </button>
          <p className="text-xs text-neutral-400 basis-full">
            Signers can switch language on the page — this only sets which one it opens in.
          </p>
        </form>
      )}

      <div className="space-y-4">
        {forms.map((f) => {
          const sigs = signaturesByForm.get(f.id) || [];
          return (
            <div key={f.id} className="bg-white border border-neutral-200 rounded-xl">
              <div className="flex items-center gap-4 px-4 py-3 flex-wrap border-b border-neutral-100">
                <div className="flex-1 min-w-[180px]">
                  <div className="font-semibold truncate">{f.label}</div>
                  <div className="text-xs text-neutral-500">
                    Created {fmtDate(f.created_at)} · {f.signatures} signature{f.signatures === 1 ? "" : "s"}
                  </div>
                </div>
                <ConsentLinkActions token={f.token} label={f.label} />
                <form action={deleteConsentForm}>
                  <input type="hidden" name="id" value={f.id} />
                  <ConfirmButton
                    message={`Delete "${f.label}"? The link stops working and its ${f.signatures} signature${f.signatures === 1 ? "" : "s"} are removed.`}
                    className="text-sm font-medium text-neutral-400 hover:text-red-600"
                  >
                    Delete
                  </ConfirmButton>
                </form>
              </div>
              {sigs.length > 0 ? (
                <div className="divide-y divide-neutral-100">
                  {sigs.map((s) => (
                    <div key={s.id} className="flex items-center gap-4 px-4 py-2.5 flex-wrap">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.signature} alt="" className="h-10 w-24 object-contain border border-neutral-100 rounded bg-neutral-50" />
                      <div className="flex-1 min-w-[140px]">
                        <div className="text-sm font-semibold">{s.name}</div>
                        <div className="text-xs text-neutral-500">
                          {fmtDate(s.signed_at)}
                          {s.contact && ` · ${s.contact}`}
                        </div>
                      </div>
                      <Link href={`/admin/consents/${s.id}`} className="text-sm font-semibold text-charcoal hover:text-orange whitespace-nowrap">
                        View / print →
                      </Link>
                      <form action={deleteConsentSignature}>
                        <input type="hidden" name="id" value={s.id} />
                        <ConfirmButton message={`Delete ${s.name}'s signed consent? This can't be undone.`} className="text-sm font-medium text-neutral-400 hover:text-red-600">
                          Delete
                        </ConfirmButton>
                      </form>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-4 text-sm text-neutral-400">No signatures yet — open the link or send it to collect them.</div>
              )}
            </div>
          );
        })}
        {!dbOff && forms.length === 0 && (
          <div className="bg-white border border-neutral-200 rounded-xl px-4 py-10 text-center text-sm text-neutral-500">
            No consent forms yet — create one above to get a signing link.
          </div>
        )}
      </div>
    </div>
  );
}
