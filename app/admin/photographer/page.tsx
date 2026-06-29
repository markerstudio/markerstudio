import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, canSeePhotographer, isPhotographerOnly } from "@/lib/auth";
import { isDbEnabled } from "@/lib/db";
import { getClients, hasPhotography, type Client, type PhotoSession } from "@/lib/clients";
import {
  ensurePhotoIds,
  SESSION_ORDER,
  TASK_ORDER,
  SESSION_LABEL,
  TASK_LABEL,
  SESSION_BADGE,
  TASK_BADGE,
} from "@/lib/photo";
import PhotographerStatusButton from "@/components/admin/PhotographerStatusButton";
import { setShotStatusById, setSessionStatusById } from "./actions";

export const dynamic = "force-dynamic";

function fmtDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });
}

export default async function PhotographerPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  // Visible to every admin AND the photographers — but not to partner-only (Ramzi).
  if (!canSeePhotographer(user)) redirect("/admin");
  const photographer = isPhotographerOnly(user);

  if (!isDbEnabled()) {
    return (
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Photography</h1>
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-4 py-3 mt-4">No database configured.</p>
      </div>
    );
  }

  const clients = await getClients();
  // Connected clients, each with its photo block normalised so every shoot/shot
  // carries a stable id the status buttons can target (index stays as fallback).
  const photoClients = clients
    .filter((c) => hasPhotography(c.data))
    .map((c) => ({ client: c, photo: ensurePhotoIds(c.data.photo) }));

  const today = new Date().toISOString().slice(0, 10);
  const monthPrefix = today.slice(0, 7);

  // Flatten every shoot across connected clients, keep the client + its index so
  // the status button can target it, then split into upcoming vs. past.
  type Flat = { client: Client; session: PhotoSession; idx: number };
  const allSessions: Flat[] = [];
  for (const { client, photo } of photoClients) {
    (photo.sessions ?? []).forEach((session, idx) => allSessions.push({ client, session, idx }));
  }
  const upcoming = allSessions
    .filter((s) => s.session.date && s.session.date >= today && s.session.status !== "delivered")
    .sort((a, b) => (a.session.date < b.session.date ? -1 : 1));

  const shootsThisMonth = allSessions.filter((s) => s.session.date?.startsWith(monthPrefix)).length;
  const openShots = photoClients.reduce(
    (n, { photo }) => n + (photo.shots ?? []).filter((t) => t.status !== "done").length,
    0,
  );

  const stat = (label: string, value: string | number, sub?: string, dark = false) => (
    <div className={`${dark ? "bg-charcoal text-white" : "bg-white border border-neutral-200"} rounded-xl px-5 py-4`}>
      <div className={`text-[11px] font-semibold uppercase tracking-wider ${dark ? "text-white/60" : "text-neutral-500"}`}>{label}</div>
      <div className={`mt-2 text-3xl font-extrabold tracking-tight tabular-nums ${dark ? "text-orange" : "text-neutral-900"}`}>{value}</div>
      {sub && <div className={`text-[11px] mt-1 ${dark ? "text-white/50" : "text-neutral-400"}`}>{sub}</div>}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Photography</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          {photographer
            ? "Your shoot schedule and shot lists across Marker clients. Tap a status to move it along."
            : "Shoot schedule and shot lists shared with the photographer (Ameer). Visible to you and all admins."}
        </p>
      </div>

      {/* At a glance */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stat("Upcoming shoots", upcoming.length, "not yet delivered", true)}
        {stat("This month", shootsThisMonth, "shoots scheduled")}
        {stat("Open shots", openShots, "to-do items left")}
        {stat("Clients", photoClients.length, "connected to photography")}
      </div>

      {/* Upcoming shoots — the schedule, newest dates first */}
      <div className="bg-white border border-neutral-200 rounded-xl p-5">
        <h2 className="font-bold tracking-tight mb-3">Upcoming shoots</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-neutral-400 py-6 text-center">
            No upcoming shoots. Schedule them in a client&apos;s settings under <b>Plan &amp; Shoots</b>.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {upcoming.map(({ client, session, idx }) => (
              <li key={`${client.slug}-${session.id ?? idx}`} className="py-3 flex items-center gap-3 flex-wrap">
                <div className="w-20 shrink-0 text-center rounded-lg bg-neutral-50 border border-neutral-100 py-1.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-orange-deep">{fmtDate(session.date).split(" ")[0]}</div>
                  <div className="text-sm font-bold tabular-nums text-neutral-900">{fmtDate(session.date).replace(/^\S+\s/, "")}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-neutral-900 truncate">{session.title || "Shoot"}</div>
                  <div className="text-[11px] text-neutral-500 truncate">
                    {client.name || client.slug}
                    {session.time ? ` · ${session.time}` : ""}
                    {session.location ? ` · ${session.location}` : ""}
                  </div>
                </div>
                <PhotographerStatusButton
                  slug={client.slug}
                  id={session.id}
                  idx={idx}
                  status={session.status}
                  order={SESSION_ORDER}
                  labels={SESSION_LABEL}
                  badges={SESSION_BADGE}
                  action={setSessionStatusById}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Per-client — full shoot schedule, shot to-do, and (if shared) the plan */}
      {photoClients.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <p className="text-sm text-neutral-400 py-6 text-center">
            No clients connected to photography yet. Turn on <b>Photography</b> in a client&apos;s settings.
          </p>
        </div>
      ) : (
        photoClients.map(({ client: c, photo }) => {
          const sessions = photo.sessions ?? [];
          const shots = photo.shots ?? [];
          const sharePlan = !!photo.sharePlan;
          return (
            <div key={c.slug} className="bg-white border border-neutral-200 rounded-xl p-5">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                <div>
                  <h2 className="font-bold tracking-tight">{c.name || c.slug}</h2>
                  <div className="text-[11px] text-neutral-500">/{c.slug}</div>
                </div>
                {!photographer && (
                  <Link href={`/admin/clients/${c.slug}/edit?tab=plan`} className="text-xs font-semibold text-neutral-400 hover:text-orange">
                    Edit shoots →
                  </Link>
                )}
              </div>

              {sharePlan && c.data.plan?.name && (
                <div className="mb-4 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Marker plan</div>
                  <div className="text-sm font-semibold text-neutral-900">{c.data.plan.name}</div>
                  <div className="text-[11px] text-neutral-500">
                    {c.data.plan.end ? `${c.data.plan.start || ""} → ${c.data.plan.end}` : `${c.data.plan.start || ""}${c.data.plan.start ? " · " : ""}Ongoing`}
                  </div>
                  {c.data.plan.note?.en && <p className="text-[11px] text-neutral-500 mt-1">{c.data.plan.note.en}</p>}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Shoot schedule */}
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">Shoot schedule</div>
                  {sessions.length === 0 ? (
                    <p className="text-sm text-neutral-400">No shoots scheduled.</p>
                  ) : (
                    <ul className="space-y-2">
                      {sessions.map((session, idx) => (
                        <li key={session.id ?? idx} className="rounded-lg border border-neutral-200 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-semibold text-neutral-900">{fmtDate(session.date)}{session.time ? ` · ${session.time}` : ""}</div>
                            <PhotographerStatusButton
                              slug={c.slug}
                              id={session.id}
                              idx={idx}
                              status={session.status}
                              order={SESSION_ORDER}
                              labels={SESSION_LABEL}
                              badges={SESSION_BADGE}
                              action={setSessionStatusById}
                            />
                          </div>
                          <div className="text-sm text-neutral-700 mt-0.5">{session.title || "Shoot"}</div>
                          {session.location && <div className="text-[11px] text-neutral-500">{session.location}</div>}
                          {session.brief?.en && <p className="text-[11px] text-neutral-500 mt-1">{session.brief.en}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Shot to-do list */}
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">Shot list — to do</div>
                  {shots.length === 0 ? (
                    <p className="text-sm text-neutral-400">No shots on the list.</p>
                  ) : (
                    <ul className="space-y-2">
                      {shots.map((shot, idx) => (
                        <li key={shot.id ?? idx} className="flex items-center gap-3">
                          <div className="shrink-0">
                            <PhotographerStatusButton
                              slug={c.slug}
                              id={shot.id}
                              idx={idx}
                              status={shot.status}
                              order={TASK_ORDER}
                              labels={TASK_LABEL}
                              badges={TASK_BADGE}
                              action={setShotStatusById}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm ${shot.status === "done" ? "line-through text-neutral-400" : "text-neutral-900"} truncate`}>{shot.title}</div>
                            {(shot.due || shot.note) && (
                              <div className="text-[11px] text-neutral-500 truncate">{shot.due ? `Due ${shot.due}` : ""}{shot.due && shot.note ? " · " : ""}{shot.note || ""}</div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
