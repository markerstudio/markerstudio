import Link from "next/link";
import { saveProject } from "@/app/admin/actions";
import type { Project } from "@/lib/projects";

const inputCls = "lq-input";

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <label className="block text-[11px] font-display font-bold uppercase tracking-[0.1em] text-charcoal-60 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-charcoal-40 mt-1">{hint}</p>}
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
      <span className="block text-[10px] font-display font-bold text-charcoal-40 mb-1">{label}</span>
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
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 lq-rise">
        <div>
          <p className="text-[11px] font-display font-bold uppercase tracking-[0.14em] text-charcoal-60">Projects</p>
          <h1 className="font-display font-extrabold text-[28px] tracking-tight text-ink leading-tight mt-1">
            {p ? `Edit · ${p.name.en}` : "New project"}
          </h1>
        </div>
        <Link href="/admin/projects" className="lq-btn lq-btn--glass lq-btn--sm no-underline">← Back to projects</Link>
      </header>

      <form action={saveProject} className="lq-card lq-rise p-5" style={{ animationDelay: "80ms" }}>
        {p && <input type="hidden" name="originalSlug" value={p.slug} />}

        <h2 className="font-display font-bold text-[16px] tracking-tight text-ink mb-4">Basics</h2>
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

        <hr className="my-4 border-charcoal/5" />

        <h2 className="font-display font-bold text-[16px] tracking-tight text-ink mb-4">The story</h2>
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
          <button className="lq-btn lq-btn--primary">
            {p ? "Save changes" : "Create project"}
          </button>
          <Link href="/admin/projects" className="text-sm font-medium text-charcoal-60 hover:text-ink no-underline">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
