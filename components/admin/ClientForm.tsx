import Link from "next/link";
import { saveClient } from "@/app/admin/actions";
import type { Client } from "@/lib/clients";

const inputCls =
  "w-full border border-neutral-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange/40 focus:border-orange";

const TEMPLATE = {
  hero: { en: "", ar: "" },
  accent: "",
  plan: { name: "", active: true, start: "", end: "", notionUrl: "", note: { en: "", ar: "" } },
  dashboard: {
    headline: { en: "", ar: "" },
    diagnosis: { en: "", ar: "" },
    cards: [{ tag: "", value: "", desc: "" }],
    vitals: [{ label: "", pct: 50, note: "" }],
  },
  social: { headline: { en: "", ar: "" }, items: [{ title: "", desc: "", tag: "" }] },
  analysis: {
    organic: { headline: { en: "", ar: "" }, reading: { en: "", ar: "" }, metrics: [{ label: "", before: "", after: "", note: "" }] },
    paid: { spend: "", note: { en: "", ar: "" }, campaigns: [{ name: "", period: "", type: "", spend: "", reach: "", impressions: "", freq: "", cpm: "", desc: "" }] },
  },
  invoices: [{ cycle: "", desc: "", amount: "", status: "due" }],
};

export default function ClientForm({ client }: { client?: Client }) {
  const dataJson = JSON.stringify(client ? client.data : TEMPLATE, null, 2);
  return (
    <form action={saveClient} className="bg-white border border-neutral-200 rounded-xl p-6">
      {client && <input type="hidden" name="originalSlug" value={client.slug} />}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Slug</label>
          <input name="slug" defaultValue={client?.slug} required pattern="[a-z0-9-]+" className={inputCls} placeholder="dr-jack-sabat" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Client name</label>
          <input name="name" defaultValue={client?.name} required className={inputCls} placeholder="Dr. Jack Sabat" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Logo URL</label>
          <input name="logo" defaultValue={client?.logo} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Brand colour</label>
          <input name="color" defaultValue={client?.color ?? "#303030"} className={inputCls} />
        </div>
      </div>

      <div className="mt-5">
        <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Portal content (JSON)</label>
        <p className="text-xs text-neutral-400 mb-2">
          Bilingual content for the Dashboard, Plan, Social, Analysis and Invoices tabs. Edit carefully — it must stay valid JSON.
          (Friendlier per-field editors can be added next.)
        </p>
        <textarea name="data" defaultValue={dataJson} rows={22} spellCheck={false} dir="ltr" className={`${inputCls} font-mono text-xs leading-relaxed`} />
      </div>

      <div className="flex items-center gap-3 pt-4">
        <button className="bg-orange text-white font-semibold rounded-md px-5 py-2.5 text-sm hover:bg-orange-deep transition-colors">
          {client ? "Save changes" : "Create client"}
        </button>
        <Link href="/admin/clients" className="text-sm text-neutral-500 hover:text-neutral-900">Cancel</Link>
      </div>
    </form>
  );
}
