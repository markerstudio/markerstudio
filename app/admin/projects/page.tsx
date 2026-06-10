import Link from "next/link";
import { getProjects, SEED_PROJECTS } from "@/lib/projects";
import { isDbEnabled, getSql } from "@/lib/db";
import { deleteProject, importSeedProjects } from "../actions";

export const dynamic = "force-dynamic";

export default async function ProjectsAdmin({ searchParams }: { searchParams: { imported?: string } }) {
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
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
        <Link href="/admin/projects/new" className="bg-orange text-white font-semibold rounded-md px-4 py-2 text-sm hover:bg-orange-deep transition-colors">
          + New project
        </Link>
      </div>

      {searchParams.imported !== undefined && (
        <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-md px-4 py-2.5 mb-6">
          Imported {searchParams.imported} project{searchParams.imported === "1" ? "" : "s"} from seed. The public site is updated.
        </p>
      )}

      {!dbOff && !needsSetup && missingSeed.length > 0 && (
        <div className="flex items-center justify-between gap-4 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-4 py-3 mb-6">
          <span>
            {missingSeed.length} built-in case stud{missingSeed.length === 1 ? "y" : "ies"} ({missingSeed.map((p) => p.name.en).join(", ")}) {missingSeed.length === 1 ? "isn't" : "aren't"} in your database yet.
          </span>
          <form action={importSeedProjects}>
            <button className="shrink-0 bg-amber-600 text-white font-semibold rounded-md px-4 py-2 hover:bg-amber-700 transition-colors">Import now →</button>
          </form>
        </div>
      )}

      {dbOff && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-4 py-3 mb-6">
          No database configured. The public site is showing seed data. Connect a database to manage projects here.
        </p>
      )}

      {needsSetup && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-4 py-3 mb-6">
          Database connected, but it hasn&apos;t been initialised yet.{" "}
          <Link href="/admin/setup" className="font-semibold underline">Run setup →</Link>
        </p>
      )}

      <div className="bg-white border border-neutral-200 rounded-xl divide-y divide-neutral-100">
        {projects.map((p) => (
          <div key={p.slug} className="flex items-center gap-4 px-4 py-3">
            <span className="w-10 h-10 rounded-md flex items-center justify-center shrink-0" style={{ background: p.color }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.logo} alt="" className="max-w-[70%] max-h-[60%] object-contain invert brightness-0 opacity-90" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{p.name.en}</div>
              <div className="text-xs text-neutral-500 truncate">{p.tag.en} · {p.year} · /{p.slug}</div>
            </div>
            <Link href={`/work/${p.slug}`} target="_blank" className="text-sm font-medium text-neutral-500 hover:text-orange">
              View ↗
            </Link>
            <Link href={`/admin/projects/${p.slug}/edit`} className="text-sm font-medium text-neutral-700 hover:text-orange">
              Edit
            </Link>
            <form action={deleteProject}>
              <input type="hidden" name="slug" value={p.slug} />
              <button className="text-sm font-medium text-neutral-400 hover:text-red-600">Delete</button>
            </form>
          </div>
        ))}
        {!dbOff && projects.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-neutral-500">No projects yet — create your first one.</div>
        )}
      </div>
    </div>
  );
}
