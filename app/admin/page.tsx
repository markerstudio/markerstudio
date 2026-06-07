import Link from "next/link";
import { getProjects } from "@/lib/projects";
import { isDbEnabled } from "@/lib/db";
import { deleteProject } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const dbOff = !isDbEnabled();
  const projects = dbOff ? [] : await getProjects();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
        <Link href="/admin/projects/new" className="bg-orange text-white font-semibold rounded-md px-4 py-2 text-sm hover:bg-orange-deep transition-colors">
          + New project
        </Link>
      </div>

      {dbOff && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-4 py-3 mb-6">
          No database configured (<code>DATABASE_URL</code> is unset). The public site is showing seed data.
          Set up the database and run <code>/api/setup</code> to manage projects here.
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
