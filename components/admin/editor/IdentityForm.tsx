"use client";

import { useState } from "react";
import FileUpload from "@/components/FileUpload";
import { saveIdentity } from "@/app/admin/clients/section-actions";
import { Field } from "@/components/ui/glass";
import { input, lbl } from "./fields";
import type { Client } from "@/lib/clients";

// Identity lives in table columns (slug/name/logo/color) + the owner key, so it
// posts to the dedicated saveIdentity form action rather than a JSONB merge.
// One form, grouped by what the owner is thinking about: who → how it looks →
// whose book it sits in.
export default function IdentityForm({ client, projectLogos = [] }: { client: Client; projectLogos?: { slug: string; name: string; logo: string }[] }) {
  const [logo, setLogo] = useState(client.logo ?? "");
  const [color, setColor] = useState(client.color ?? "#303030");

  return (
    <form action={saveIdentity} className="lq-card p-5 space-y-6">
      <input type="hidden" name="originalSlug" value={client.slug} />

      <div>
        <h2 className="font-display font-bold text-[16px] tracking-tight text-ink mb-1">Name &amp; address</h2>
        <p className="text-[12.5px] text-charcoal-60 mb-4">How the client is called, and where their portal lives.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
          <Field label="Client name">
            <input name="name" defaultValue={client.name} required className={input} placeholder="Dr. Jack Sabat" />
          </Field>
          <Field label="Slug" hint={`Sets the portal address: /portal/${client.slug}. Lowercase letters, numbers and dashes.`}>
            <input name="slug" defaultValue={client.slug} required pattern="[a-z0-9-]+" className={input} placeholder="dr-jack-sabat" />
          </Field>
        </div>
      </div>

      <div className="border-t border-charcoal/5 pt-5">
        <h2 className="font-display font-bold text-[16px] tracking-tight text-ink mb-1">Brand look</h2>
        <p className="text-[12.5px] text-charcoal-60 mb-4">The logo and colour tint the portal and this admin page.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
          <Field label="Brand colour">
            <span className="flex items-center gap-2">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 rounded-lg border border-charcoal/10 bg-white/75 p-1" aria-label="Brand colour" />
              <input name="color" value={color} onChange={(e) => setColor(e.target.value)} className={input} />
            </span>
          </Field>
          <div className="md:col-span-2">
            <span className={lbl}>Logo</span>
            <input type="hidden" name="logo" value={logo} />
            <div className="flex items-start gap-3 flex-wrap">
              <div className="h-14 w-14 shrink-0 rounded-xl border border-charcoal/10 bg-charcoal flex items-center justify-center overflow-hidden">
                {logo
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={logo} alt="" className="max-h-[80%] max-w-[80%] object-contain" />
                  : <span className="text-[10px] text-white/60">No logo</span>}
              </div>
              <div className="flex-1 min-w-[220px] space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <FileUpload accept="image/*" label="Upload image" onUploaded={({ url }) => setLogo(url)} />
                  {projectLogos.length > 0 && (
                    <select className={`${input} max-w-[230px]`} value="" onChange={(e) => { if (e.target.value) setLogo(e.target.value); }}>
                      <option value="">Pick from posted projects…</option>
                      {projectLogos.filter((p) => p.logo).map((p) => (
                        <option key={p.slug} value={p.logo}>{p.name}</option>
                      ))}
                    </select>
                  )}
                  {logo && <button type="button" onClick={() => setLogo("")} className="text-xs font-semibold text-charcoal-40 hover:text-rose-700">Clear</button>}
                </div>
                <input value={logo} onChange={(e) => setLogo(e.target.value)} className={input} placeholder="…or paste a logo URL" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-charcoal/5 pt-5">
        <h2 className="font-display font-bold text-[16px] tracking-tight text-ink mb-1">Ownership</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 mt-4">
          <Field label="Owner" hint="Ramzi's clients are visible only to Ramzi and the super admin.">
            <select name="owner" className={input} defaultValue={client.data.owner || "marker"}>
              <option value="marker">Marker</option>
              <option value="ramzi">Ramzi (partner)</option>
            </select>
          </Field>
        </div>
      </div>

      <div className="pt-1">
        <button className="lq-btn lq-btn--primary">Save identity</button>
      </div>
    </form>
  );
}
