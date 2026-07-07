import Link from "next/link";
import { isDbEnabled } from "@/lib/db";
import { getConsentForms, getConsentSignatures, type ConsentSignature } from "@/lib/consents";
import ConsentLinkActions from "@/components/admin/ConsentLinkActions";
import ConfirmButton from "@/components/admin/ConfirmButton";
import { StatTile, EmptyState } from "@/components/ui/glass";
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

  return (
    <div className="space-y-5">
      <header className="lq-rise">
        <p className="text-[11px] font-display font-bold uppercase tracking-[0.14em] text-charcoal-60">Photo & video releases</p>
        <h1 className="font-display font-extrabold text-[28px] tracking-tight text-ink leading-tight mt-1">Consent forms</h1>
        <p className="text-sm text-charcoal-60 mt-1">
          Photo/video release forms — sign in person on an iPad (finger or pencil) or send the link to a client. One link can collect any number of signatures.
        </p>
      </header>

      {searchParams.ok && (
        <p className="lq-card text-sm text-emerald-800 px-4 py-2.5 !border-emerald-300/40">{OK[searchParams.ok] || "Done."}</p>
      )}
      {searchParams.error && (
        <p className="lq-card text-sm text-rose-700 px-4 py-2.5 !border-rose-300/40">{ERR[searchParams.error] || "Something went wrong."}</p>
      )}
      {dbOff && <p className="lq-card text-sm text-amber-800 px-4 py-3 !border-amber-300/40">No database configured.</p>}

      {!dbOff && (
        <div className="grid sm:grid-cols-3 gap-3.5">
          <StatTile label="Forms" value={String(forms.length)} sub="signing links" delay={40} />
          <StatTile label="Signatures" value={String(totalSignatures)} sub="consents collected" tone={totalSignatures > 0 ? "good" : "neutral"} delay={90} />
          <StatTile
            label="Latest"
            value={
              forms.some((f) => f.last_signed_at)
                ? fmtDate(forms.map((f) => f.last_signed_at).filter(Boolean).sort().reverse()[0] as string)
                : "—"
            }
            sub="most recent signature"
            delay={140}
          />
        </div>
      )}

      {!dbOff && (
        <form action={createConsentForm} className="lq-card lq-rise p-5 flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-[11px] font-display font-bold uppercase tracking-[0.1em] text-charcoal-60 mb-1.5">New consent form</label>
            <input name="label" required className="lq-input w-full" placeholder="e.g. Bethlehem shoot — June 2026" />
          </div>
          <div>
            <label className="block text-[11px] font-display font-bold uppercase tracking-[0.1em] text-charcoal-60 mb-1.5">Opens in</label>
            <select name="lang" className="lq-input" defaultValue="en">
              <option value="en">English</option>
              <option value="ar">عربي</option>
            </select>
          </div>
          <button className="lq-btn lq-btn--primary">
            Create signing link →
          </button>
          <p className="text-xs text-charcoal-40 basis-full">
            Signers can switch language on the page — this only sets which one it opens in.
          </p>
        </form>
      )}

      <div className="space-y-4 lq-stagger">
        {forms.map((f, i) => {
          const sigs = signaturesByForm.get(f.id) || [];
          return (
            <div key={f.id} style={{ "--i": i } as React.CSSProperties} className="lq-card overflow-hidden">
              <div className="flex items-center gap-4 px-5 py-3.5 flex-wrap border-b border-charcoal/5">
                <div className="flex-1 min-w-[180px]">
                  <div className="font-display font-bold tracking-tight text-ink truncate">{f.label}</div>
                  <div className="text-xs text-charcoal-60">
                    Created {fmtDate(f.created_at)} · {f.signatures} signature{f.signatures === 1 ? "" : "s"}
                  </div>
                </div>
                <ConsentLinkActions token={f.token} label={f.label} />
                <form action={deleteConsentForm}>
                  <input type="hidden" name="id" value={f.id} />
                  <ConfirmButton
                    message={`Delete "${f.label}"? The link stops working and its ${f.signatures} signature${f.signatures === 1 ? "" : "s"} are removed.`}
                    className="text-sm font-medium text-charcoal-40 hover:text-rose-600"
                  >
                    Delete
                  </ConfirmButton>
                </form>
              </div>
              {sigs.length > 0 ? (
                <div className="divide-y divide-charcoal/5">
                  {sigs.map((s) => (
                    <div key={s.id} className="flex items-center gap-4 px-5 py-2.5 flex-wrap transition-colors hover:bg-white/60">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.signature} alt="" className="h-10 w-24 object-contain lq-well !rounded-lg" />
                      <div className="flex-1 min-w-[140px]">
                        <div className="text-sm font-semibold text-ink">{s.name}</div>
                        <div className="text-xs text-charcoal-60">
                          {fmtDate(s.signed_at)}
                          {s.contact && ` · ${s.contact}`}
                        </div>
                      </div>
                      <Link href={`/admin/consents/${s.id}`} className="text-sm font-semibold text-ink hover:text-orange-deep whitespace-nowrap no-underline">
                        View / print →
                      </Link>
                      <form action={deleteConsentSignature}>
                        <input type="hidden" name="id" value={s.id} />
                        <ConfirmButton message={`Delete ${s.name}'s signed consent? This can't be undone.`} className="text-sm font-medium text-charcoal-40 hover:text-rose-600">
                          Delete
                        </ConfirmButton>
                      </form>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-5 py-4 text-sm text-charcoal-40">No signatures yet — open the link or send it to collect them.</div>
              )}
            </div>
          );
        })}
        {!dbOff && forms.length === 0 && (
          <div className="lq-card lq-rise">
            <EmptyState icon="🖋️" title="No consent forms yet" sub="Create one above to get a signing link." />
          </div>
        )}
      </div>
    </div>
  );
}
