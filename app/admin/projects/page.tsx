import Link from "next/link";
import { getProjects, SEED_PROJECTS } from "@/lib/projects";
import { isDbEnabled, getSql } from "@/lib/db";
import { deleteProject, importSeedProjects } from "../actions";
import ConfirmButton from "@/components/admin/ConfirmButton";
import UndoBanner from "@/components/admin/UndoBanner";
import { EmptyState } from "@/components/ui/glass";

export const dynamic = "force-dynamic";

export default async function ProjectsAdmin({
  searchParams,
}: {
  searchParams: { imported?: string; undo?: string; restored?: string; undoError?: string };
}) {
  const dbOff = !isDbEnabled();
  let needsSetup = false;
  let projects: Awaited<ReturnType<typeof getProjects>> = [];
  if (!dbOff) {
    try {
      await getSql()`SELECT 1 FROM users LIMIT 1`;
      projects = await getProjects();
    } catch {
      needsSetup = true; // tables not created yet
    }
  }

  const dbSlugs = new Set(projects.map((p) => p.slug));
  const missingSeed = SEED_PROJECTS.filter((p) => !dbSlugs.has(p.slug));

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 lq-rise">
        <div>
          <p className="text-[11px] font-display font-bold uppercase tracking-[0.14em] text-charcoal-60">Studio work</p>
          <h1 className="font-display font-extrabold text-[28px] tracking-tight text-ink leading-tight mt-1">Projects</h1>
        </div>
        <Link href="/admin/projects/new" className="lq-btn lq-btn--primary no-underline">
          + New project
        </Link>
      </header>

      {searchParams.imported !== undefined && (
        <p className="lq-card text-sm text-emerald-800 px-4 py-3 !border-emerald-400/40">
          Imported {searchParams.imported} project{searchParams.imported === "1" ? "" : "s"} from seed. The public site is updated.
        </p>
      )}
      <UndoBanner undo={searchParams.undo} restored={searchParams.restored} undoError={searchParams.undoError} back="/admin/projects" />

      {!dbOff && !needsSetup && missingSeed.length > 0 && (
        <div className="lq-card flex items-center justify-between gap-4 text-sm text-amber-900 px-4 py-3 !border-amber-300/40">
          <span>
            {missingSeed.length} built-in case stud{missingSeed.length === 1 ? "y" : "ies"} ({missingSeed.map((p) => p.name.en).join(", ")}) {missingSeed.length === 1 ? "isn't" : "aren't"} in your database yet.
          </span>
          <form action={importSeedProjects}>
            <button className="lq-btn lq-btn--dark lq-btn--sm shrink-0">Import now →</button>
          </form>
        </div>
      )}

      {dbOff && (
        <p className="lq-card text-sm text-amber-800 px-4 py-3 !border-amber-300/40">
          No database configured. The public site is showing seed data. Connect a database to manage projects here.
        </p>
      )}

      {needsSetup && (
        <p className="lq-card text-sm text-amber-800 px-4 py-3 !border-amber-300/40">
          Database connected, but it hasn&apos;t been initialised yet.{" "}
          <Link href="/admin/setup" className="font-semibold underline">Run setup →</Link>
        </p>
      )}

      <div className="lq-card lq-rise overflow-hidden divide-y divide-charcoal/5" style={{ animationDelay: "80ms" }}>
        {projects.map((p, i) => (
          <div key={p.slug} className="flex items-center gap-4 px-5 py-3 hover:bg-white/60 lq-rise" style={{ animationDelay: `${120 + i * 40}ms` }}>
            <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: p.color }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.logo} alt="" className="max-w-[70%] max-h-[60%] object-contain invert brightness-0 opacity-90" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-display font-semibold text-ink truncate">{p.name.en}</div>
              <div className="text-xs text-charcoal-60 truncate">{p.tag.en} · {p.year} · /{p.slug}</div>
            </div>
            <Link href={`/work/${p.slug}`} target="_blank" className="text-sm font-medium text-charcoal-60 hover:text-orange-deep no-underline">
              View ↗
            </Link>
            <Link href={`/admin/projects/${p.slug}/edit`} className="text-sm font-medium text-charcoal-80 hover:text-orange-deep no-underline">
              Edit
            </Link>
            <form action={deleteProject}>
              <input type="hidden" name="slug" value={p.slug} />
              <ConfirmButton
                message={`Delete ${p.name.en}? It disappears from the public site — you'll get a chance to undo right after.`}
                className="text-sm font-medium text-neutral-400 hover:text-red-600"
              >
                Delete
              </ConfirmButton>
            </form>
          </div>
        ))}
        {!dbOff && projects.length === 0 && (
          <EmptyState
            icon={<span className="text-lg">🗂️</span>}
            title="No projects yet"
            sub="Create your first case study — it publishes straight to the public site."
            action={<Link href="/admin/projects/new" className="lq-btn lq-btn--primary lq-btn--sm no-underline">+ New project</Link>}
          />
        )}
      </div>
    </div>
  );
}
