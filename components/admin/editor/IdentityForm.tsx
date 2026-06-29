"use client";

import { useState } from "react";
import FileUpload from "@/components/FileUpload";
import { saveIdentity } from "@/app/admin/clients/section-actions";
import { input, lbl } from "./fields";
import type { Client } from "@/lib/clients";

// Identity lives in table columns (slug/name/logo/color) + the owner key, so it
// posts to the dedicated saveIdentity form action rather than a JSONB merge.
export default function IdentityForm({ client, projectLogos = [] }: { client: Client; projectLogos?: { slug: string; name: string; logo: string }[] }) {
  const [logo, setLogo] = useState(client.logo ?? "");
  const [color, setColor] = useState(client.color ?? "#303030");

  return (
    <form action={saveIdentity} className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
      <h2 className="font-bold mb-4">Identity</h2>
      <input type="hidden" name="originalSlug" value={client.slug} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
        <div><label className={lbl}>Slug</label><input name="slug" defaultValue={client.slug} required pattern="[a-z0-9-]+" className={input} placeholder="dr-jack-sabat" /></div>
        <div><label className={lbl}>Client name</label><input name="name" defaultValue={client.name} required className={input} placeholder="Dr. Jack Sabat" /></div>
        <div>
          <label className={lbl}>Owner</label>
          <select name="owner" className={input} defaultValue={client.data.owner || "marker"}>
            <option value="marker">Marker</option>
            <option value="ramzi">Ramzi (partner)</option>
          </select>
          <p className="text-[11px] text-neutral-400 mt-1">Ramzi&apos;s clients are visible only to Ramzi and the super admin.</p>
        </div>
        <div>
          <label className={lbl}>Brand colour</label>
          <div className="flex items-center gap-2">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 rounded border border-neutral-300 bg-white p-1" aria-label="Brand colour" />
            <input name="color" value={color} onChange={(e) => setColor(e.target.value)} className={input} />
          </div>
        </div>
        <div className="md:col-span-2">
          <label className={lbl}>Logo</label>
          <input type="hidden" name="logo" value={logo} />
          <div className="flex items-start gap-3 flex-wrap">
            <div className="h-14 w-14 shrink-0 rounded-lg border border-neutral-200 bg-neutral-900 flex items-center justify-center overflow-hidden">
              {logo
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={logo} alt="" className="max-h-[80%] max-w-[80%] object-contain" />
                : <span className="text-[10px] text-neutral-500">No logo</span>}
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
                {logo && <button type="button" onClick={() => setLogo("")} className="text-xs font-medium text-neutral-400 hover:text-red-600">Clear</button>}
              </div>
              <input value={logo} onChange={(e) => setLogo(e.target.value)} className={input} placeholder="…or paste a logo URL" />
            </div>
          </div>
        </div>
      </div>
      <div className="mt-5">
        <button className="bg-orange text-white font-semibold rounded-md px-6 py-2.5 text-sm hover:bg-orange-deep transition-colors">Save identity</button>
      </div>
    </form>
  );
}
