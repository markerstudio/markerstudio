import Link from "next/link";
import { isDbEnabled } from "@/lib/db";
import { ensureApplicationsTable, listApplications, type Application } from "@/lib/applications";
import { markApplicationRead, markAllApplicationsRead, deleteApplication } from "../actions";

export const dynamic = "force-dynamic";

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{label}</dt>
      <dd className="text-neutral-800 break-words">{value}</dd>
    </div>
  );
}

export default async function ApplicationsPage({ searchParams }: { searchParams: { ok?: string } }) {
  const dbOff = !isDbEnabled();
  let rows: Application[] = [];
  let failed = false;

  if (!dbOff) {
    try {
      await ensureApplicationsTable();
      rows = await listApplications();
    } catch {
      failed = true;
    }
  }

  const unread = rows.filter((r) => !r.read_at).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="text-2xl font-bold tracking-tight">
          Applications
          {unread > 0 && <span className="ml-2 align-middle text-xs font-semibold bg-orange text-white rounded-full px-2 py-0.5">{unread} new</span>}
        </h1>
        {unread > 0 && (
          <form action={markAllApplicationsRead}>
            <button className="text-sm font-medium text-neutral-600 hover:text-neutral-900">Mark all read</button>
          </form>
        )}
      </div>

      {searchParams.ok === "removed" && (
        <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-md px-4 py-2.5 mb-6">Application deleted.</p>
      )}

      {dbOff && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-4 py-3 mb-6">
          No database configured. Connect a database to collect careers submissions.
        </p>
      )}

      {failed && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-4 py-3 mb-6">
          Database connected, but it hasn&apos;t been initialised yet. <Link href="/admin/setup" className="font-semibold underline">Run setup →</Link>
        </p>
      )}

      {!dbOff && !failed && rows.length === 0 && (
        <div className="bg-white border border-neutral-200 rounded-xl px-4 py-10 text-center text-sm text-neutral-500">
          No applications yet. Submissions from <Link href="/careers" className="font-medium text-orange" target="_blank">/careers</Link> will appear here.
        </div>
      )}

      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.id} className={`bg-white border rounded-xl p-4 ${r.read_at ? "border-neutral-200" : "border-orange/60 ring-1 ring-orange/30"}`}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {!r.read_at && <span className="w-2 h-2 rounded-full bg-orange shrink-0" aria-label="unread" />}
                  <span className="font-semibold">{r.first_name} {r.last_name}</span>
                  {r.talent && <span className="text-xs font-medium bg-orange-50 text-orange-deep rounded-full px-2 py-0.5">{r.talent}</span>}
                  {r.gender && <span className="text-xs font-medium bg-neutral-100 text-neutral-600 rounded-full px-2 py-0.5">{r.gender}</span>}
                  {r.lang && <span className="text-xs uppercase tracking-wide text-neutral-400">{r.lang}</span>}
                </div>
                <div className="text-sm text-neutral-600 mt-1 flex items-center gap-3 flex-wrap">
                  <a href={`mailto:${r.email}`} className="hover:text-orange">{r.email}</a>
                  {r.phone && <a href={`tel:${r.phone}`} className="hover:text-orange">{r.phone}</a>}
                </div>
              </div>
              <div className="text-xs text-neutral-400 shrink-0 text-right">{when(r.created_at)}</div>
            </div>

            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3 text-sm border-t border-neutral-100 pt-3">
              <Detail label="Address" value={r.address} />
              <Detail label="Rate / session" value={r.rate_session} />
              <Detail label="Rate (project/hour)" value={r.rate} />
              <Detail label="Instagram" value={r.instagram} />
            </dl>

            <div className="flex items-center gap-4 mt-3 text-sm">
              {r.work_url && <a href={r.work_url} target="_blank" rel="noreferrer" className="font-medium text-orange hover:text-orange-deep">Show work ↗</a>}
              {!r.read_at && (
                <form action={markApplicationRead}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className="font-medium text-neutral-700 hover:text-orange">Mark read</button>
                </form>
              )}
              <a href={`mailto:${r.email}?subject=${encodeURIComponent("Marker Careers")}`} className="font-medium text-neutral-700 hover:text-orange">Reply</a>
              <form action={deleteApplication} className="ml-auto">
                <input type="hidden" name="id" value={r.id} />
                <button className="font-medium text-neutral-400 hover:text-red-600">Delete</button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
