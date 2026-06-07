import Link from "next/link";
import { saveProject } from "@/app/admin/actions";
import type { Project } from "@/lib/projects";

const inputCls =
  "w-full border border-neutral-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange/40 focus:border-orange";

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-neutral-400 mt-1">{hint}</p>}
    </div>
  );
}

// EN/AR pair of inputs (or textareas).
function Bilingual({
  name,
  en,
  ar,
  textarea,
}: {
  name: string;
  en?: string;
  ar?: string;
  textarea?: boolean;
}) {
  const one = (field: string, value: string | undefined, d: "ltr" | "rtl", label: string) => (
    <div>
      <span className="block text-[10px] font-bold text-neutral-400 mb-1">{label}</span>
      {textarea ? (
        <textarea name={field} defaultValue={value} dir={d} rows={3} className={inputCls} />
      ) : (
        <input name={field} defaultValue={value} dir={d} className={inputCls} />
      )}
    </div>
  );
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {one(`${name}_en`, en, "ltr", "EN")}
      {one(`${name}_ar`, ar, "rtl", "AR")}
    </div>
  );
}

export default function ProjectForm({ project }: { project?: Project }) {
  const p = project;
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{p ? `Edit · ${p.name.en}` : "New project"}</h1>
        <Link href="/admin" className="text-sm text-neutral-500 hover:text-neutral-900">← Back</Link>
      </div>

      <form action={saveProject} className="bg-white border border-neutral-200 rounded-xl p-6">
        {p && <input type="hidden" name="originalSlug" value={p.slug} />}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
          <Row label="Slug" hint="URL-safe, e.g. canaan-hotel">
            <input name="slug" defaultValue={p?.slug} required pattern="[a-z0-9-]+" className={inputCls} />
          </Row>
          <Row label="Year">
            <input name="year" defaultValue={p?.year} className={inputCls} />
          </Row>
          <Row label="Brand colour" hint="Hex, used for the hero panel">
            <input name="color" type="text" defaultValue={p?.color ?? "#303030"} className={inputCls} />
          </Row>
          <Row label="Logo URL">
            <input name="logo" defaultValue={p?.logo} className={inputCls} />
          </Row>
        </div>

        <hr className="my-4 border-neutral-100" />

        <Row label="Name"><Bilingual name="name" en={p?.name.en} ar={p?.name.ar} /></Row>
        <Row label="Tag" hint="e.g. Identity · Hospitality"><Bilingual name="tag" en={p?.tag.en} ar={p?.tag.ar} /></Row>
        <Row label="Services" hint="Comma-separated"><Bilingual name="services" en={p?.services.en.join(", ")} ar={p?.services.ar.join(", ")} /></Row>
        <Row label="Deliverables" hint="Comma-separated"><Bilingual name="deliverables" en={p?.deliverables.en.join(", ")} ar={p?.deliverables.ar.join(", ")} /></Row>
        <Row label="Summary"><Bilingual name="summary" en={p?.summary.en} ar={p?.summary.ar} textarea /></Row>
        <Row label="The challenge"><Bilingual name="challenge" en={p?.challenge.en} ar={p?.challenge.ar} textarea /></Row>
        <Row label="Our approach"><Bilingual name="approach" en={p?.approach.en} ar={p?.approach.ar} textarea /></Row>
        <Row label="The result"><Bilingual name="results" en={p?.results.en} ar={p?.results.ar} textarea /></Row>
        <Row label="Gallery image URLs" hint="Comma-separated (optional)">
          <input name="gallery" defaultValue={p?.gallery?.join(", ")} className={inputCls} />
        </Row>

        <div className="flex items-center gap-3 pt-2">
          <button className="bg-orange text-white font-semibold rounded-md px-5 py-2.5 text-sm hover:bg-orange-deep transition-colors">
            {p ? "Save changes" : "Create project"}
          </button>
          <Link href="/admin" className="text-sm text-neutral-500 hover:text-neutral-900">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
