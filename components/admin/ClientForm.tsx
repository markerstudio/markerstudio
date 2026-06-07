"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { saveClient } from "@/app/admin/actions";
import { toCSV, fromCSV } from "@/lib/portalCsv";
import { blankClientData, type Client, type ClientData } from "@/lib/clients";

const input = "w-full border border-neutral-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange/40 focus:border-orange";
const lbl = "block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1";

export default function ClientForm({ client }: { client?: Client }) {
  const [data, setData] = useState<ClientData>(client?.data ?? blankClientData());
  const [color, setColor] = useState(client?.color ?? "#303030");
  const [csvMsg, setCsvMsg] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  function downloadCsv() {
    const slug = (formRef.current?.elements.namedItem("slug") as HTMLInputElement | null)?.value || "client";
    const blob = new Blob([toCSV(data)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug || "client"}-portal.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        setData(fromCSV(String(reader.result)));
        setCsvMsg("Imported ✓ — Save changes to apply.");
      } catch {
        setCsvMsg("Couldn't read that CSV. Use the downloaded template as the starting point.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <form ref={formRef} action={saveClient} className="space-y-6">
      {client && <input type="hidden" name="originalSlug" value={client.slug} />}
      <input type="hidden" name="data" value={JSON.stringify(data)} />

      <fieldset className="bg-white border border-neutral-200 rounded-xl p-6">
        <legend className="px-2 -ml-2 font-bold">Identity</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 mt-2">
          <div><label className={lbl}>Slug</label><input name="slug" defaultValue={client?.slug} required pattern="[a-z0-9-]+" className={input} placeholder="dr-jack-sabat" /></div>
          <div><label className={lbl}>Client name</label><input name="name" defaultValue={client?.name} required className={input} placeholder="Dr. Jack Sabat" /></div>
          <div><label className={lbl}>Logo URL</label><input name="logo" defaultValue={client?.logo} className={input} /></div>
          <div>
            <label className={lbl}>Brand colour</label>
            <div className="flex items-center gap-2">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 rounded border border-neutral-300 bg-white p-1" aria-label="Brand colour" />
              <input name="color" value={color} onChange={(e) => setColor(e.target.value)} className={input} />
            </div>
          </div>
        </div>
      </fieldset>

      {client && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
          <p className="text-sm text-neutral-700">
            ✏️ Edit this client&apos;s portal content (dashboard, plan, analysis, invoices, documents) directly on the live portal.
          </p>
          <Link href={`/portal/${client.slug}?edit=1`} className="inline-block mt-3 bg-orange text-white font-semibold rounded-md px-5 py-2.5 text-sm hover:bg-orange-deep transition-colors">
            Edit portal content →
          </Link>
        </div>
      )}

      <div className="bg-cream border border-neutral-200 rounded-xl p-6">
        <h2 className="font-bold mb-1">Bulk-fill with a spreadsheet (CSV)</h2>
        <p className="text-sm text-neutral-600 mb-3">
          Optional. Download the CSV, fill the <code>en</code> / <code>ar</code> or <code>value</code> columns (add more
          <code> …[2]…</code> rows for extra items), then upload — it loads into this client. Then <b>Save changes</b>.
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <button type="button" onClick={downloadCsv} className="border border-neutral-300 rounded-md px-4 py-2 text-sm font-medium hover:bg-neutral-50">Download CSV</button>
          <label className="bg-neutral-800 text-white font-semibold rounded-md px-4 py-2 text-sm hover:bg-neutral-900 transition-colors cursor-pointer">
            Upload CSV
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={onUpload} />
          </label>
          {csvMsg && <span className="text-sm text-neutral-700">{csvMsg}</span>}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="bg-orange text-white font-semibold rounded-md px-5 py-2.5 text-sm hover:bg-orange-deep transition-colors">
          {client ? "Save changes" : "Create client"}
        </button>
        <Link href="/admin/clients" className="text-sm text-neutral-500 hover:text-neutral-900">Cancel</Link>
      </div>
    </form>
  );
}
