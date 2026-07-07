import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, canSeePhotographer, isPhotographerOnly } from "@/lib/auth";
import { isDbEnabled } from "@/lib/db";
import { getClients, hasPhotography, type Client, type PhotoSession, type PhotoTask } from "@/lib/clients";
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
import { StatTile, EmptyState } from "@/components/ui/glass";
import { setShotStatusById, setSessionStatusById } from "./actions";

export const dynamic = "force-dynamic";

const SHOT_TYPE_LABEL: Record<string, string> = { post: "Post", story: "Story", reel: "Reel", carousel: "Carousel" };

function fmtDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });
}

// One shot line — status chip, optional reference media, title + meta. `idx` is the
// shot's index in the ORIGINAL photo.shots array (the status action's fallback target).
function ShotLine({ slug, shot, idx }: { slug: string; shot: PhotoTask; idx: number }) {
  return (
    <>
      <div className="shrink-0 pt-0.5">
        <PhotographerStatusButton
          slug={slug}
          id={shot.id}
          idx={idx}
          status={shot.status}
          order={TASK_ORDER}
          labels={TASK_LABEL}
          badges={TASK_BADGE}
          action={setShotStatusById}
        />
      </div>
      {shot.mediaUrl && (
        <a href={shot.mediaUrl} target="_blank" rel="noreferrer" className="shrink-0" title="Open reference media">
          {shot.mediaKind === "video" ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={shot.mediaUrl} muted className="h-14 w-14 rounded-xl object-cover border border-charcoal/10 bg-charcoal/5" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shot.mediaUrl} alt="" className="h-14 w-14 rounded-xl object-cover border border-charcoal/10 bg-charcoal/5" />
          )}
        </a>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm ${shot.status === "done" ? "line-through text-charcoal-40" : "text-ink font-medium"}`}>{shot.title || "Shot"}</span>
          {shot.type && <span className="lq-chip uppercase !text-[10px] !px-2 !py-0.5">{SHOT_TYPE_LABEL[shot.type] || shot.type}</span>}
          {shot.mediaUrl && <span className="text-[10px] font-semibold text-emerald-700">{shot.mediaKind === "video" ? "🎬 video" : "🖼 photo"}</span>}
        </div>
        {(shot.due || shot.note) && (
          <div className="text-[11px] text-charcoal-60 mt-0.5">{shot.due ? `Due ${shot.due}` : ""}{shot.due && shot.note ? " · " : ""}{shot.note || ""}</div>
        )}
      </div>
    </>
  );
}

export default async function PhotographerPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  // Visible to every admin AND the photographers — but not to partner-only (Ramzi).
  if (!canSeePhotographer(user)) redirect("/admin");
  const photographer = isPhotographerOnly(user);

  if (!isDbEnabled()) {
    return (
      <div className="space-y-5">
        <header>
          <p className="text-[11px] font-display font-bold uppercase tracking-[0.14em] text-charcoal-60">Shoots &amp; shot lists</p>
          <h1 className="font-display font-extrabold text-[28px] tracking-tight text-ink leading-tight mt-1">Photography</h1>
        </header>
        <p className="lq-card text-sm text-amber-800 px-4 py-3 !border-amber-300/40">No database configured.</p>
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

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[11px] font-display font-bold uppercase tracking-[0.14em] text-charcoal-60">Shoots &amp; shot lists</p>
        <h1 className="font-display font-extrabold text-[28px] tracking-tight text-ink leading-tight mt-1">Photography</h1>
        <p className="text-sm text-charcoal-60 mt-1">
          {photographer
            ? "Your shoot schedule and shot lists across Marker clients. Tap a status to move it along."
            : "Shoot schedule and shot lists shared with the photographer (Ameer). Visible to you and all admins."}
        </p>
      </header>

      {/* At a glance */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatTile label="Upcoming shoots" value={upcoming.length} sub="not yet delivered" tone="accent" delay={40} />
        <StatTile label="This month" value={shootsThisMonth} sub="shoots scheduled" delay={90} />
        <StatTile label="Open shots" value={openShots} sub="to-do items left" delay={140} />
        <StatTile label="Clients" value={photoClients.length} sub="connected to photography" delay={190} />
      </div>

      {/* Upcoming shoots — the schedule, newest dates first */}
      <div className="lq-card lq-rise p-5" style={{ animationDelay: "160ms" }}>
        <h2 className="font-display font-bold text-[16px] tracking-tight text-ink mb-3">Upcoming shoots</h2>
        {upcoming.length === 0 ? (
          <EmptyState
            icon="📸"
            title="No upcoming shoots"
            sub={
              <>
                Schedule them in a client&apos;s settings under <b>Plan &amp; Shoots</b>.
              </>
            }
          />
        ) : (
          <ul className="divide-y divide-charcoal/5">
            {upcoming.map(({ client, session, idx }) => (
              <li key={`${client.slug}-${session.id ?? idx}`} className="py-3 flex items-center gap-3 flex-wrap">
                <div className="w-20 shrink-0 text-center lq-well py-1.5">
                  <div className="text-[11px] font-display font-bold uppercase tracking-[0.1em] text-orange-deep">{fmtDate(session.date).split(" ")[0]}</div>
                  <div className="text-sm font-bold tabular-nums text-ink">{fmtDate(session.date).replace(/^\S+\s/, "")}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-ink truncate">{session.title || "Shoot"}</div>
                  <div className="text-[11px] text-charcoal-60 truncate">
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
        <div className="lq-card lq-rise p-5" style={{ animationDelay: "220ms" }}>
          <EmptyState
            icon="🤝"
            title="No clients connected to photography yet"
            sub={
              <>
                Turn on <b>Photography</b> in a client&apos;s settings.
              </>
            }
          />
        </div>
      ) : (
        photoClients.map(({ client: c, photo }, ci) => {
          const sessions = photo.sessions ?? [];
          const shots = photo.shots ?? [];
          const sharePlan = !!photo.sharePlan;
          // Keep each shot's index in the original array — the status action's fallback
          // target — then group by sessionId; loose/stale shots go to the general list.
          const shotEntries = shots.map((shot, idx) => ({ shot, idx }));
          const sessionIds = new Set(sessions.map((s) => s.id).filter(Boolean));
          const generalShots = shotEntries.filter(({ shot }) => !shot.sessionId || !sessionIds.has(shot.sessionId));
          return (
            <div key={c.slug} className="lq-card lq-rise p-5" style={{ animationDelay: `${220 + ci * 60}ms` }}>
              <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                <div>
                  <h2 className="font-display font-bold text-[16px] tracking-tight text-ink">{c.name || c.slug}</h2>
                  <div className="text-[11px] text-charcoal-60">/{c.slug}</div>
                </div>
                {!photographer && (
                  <Link href={`/admin/clients/${c.slug}/edit?tab=content`} className="text-xs font-semibold text-charcoal-40 hover:text-orange-deep no-underline">
                    Edit shoots →
                  </Link>
                )}
              </div>

              {sharePlan && c.data.plan?.name && (
                <div className="mb-4 lq-well px-4 py-3">
                  <div className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-charcoal-40">Marker plan</div>
                  <div className="text-sm font-semibold text-ink">{c.data.plan.name}</div>
                  <div className="text-[11px] text-charcoal-60">
                    {c.data.plan.end ? `${c.data.plan.start || ""} → ${c.data.plan.end}` : `${c.data.plan.start || ""}${c.data.plan.start ? " · " : ""}Ongoing`}
                  </div>
                  {c.data.plan.note?.en && <p className="text-[11px] text-charcoal-60 mt-1">{c.data.plan.note.en}</p>}
                </div>
              )}

              <div className="space-y-4">
                {/* Shoots — each with its own shot list nested under it */}
                <div>
                  <div className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-charcoal-60 mb-2">Shoots &amp; shot lists</div>
                  {sessions.length === 0 ? (
                    <p className="text-sm text-charcoal-40">No shoots scheduled.</p>
                  ) : (
                    <ul className="space-y-2">
                      {sessions.map((session, idx) => {
                        const own = session.id ? shotEntries.filter(({ shot }) => shot.sessionId === session.id) : [];
                        return (
                          <li key={session.id ?? idx} className="lq-well p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-sm font-semibold text-ink">{fmtDate(session.date)}{session.time ? ` · ${session.time}` : ""}</div>
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
                            <div className="text-sm text-charcoal-80 mt-0.5">{session.title || "Shoot"}</div>
                            {session.location && <div className="text-[11px] text-charcoal-60">{session.location}</div>}
                            {session.brief?.en && <p className="text-[11px] text-charcoal-60 mt-1">{session.brief.en}</p>}
                            {own.length > 0 && (
                              <ul className="mt-2.5 pt-1 border-t border-charcoal/5 divide-y divide-charcoal/5">
                                {own.map(({ shot, idx: shotIdx }) => (
                                  <li key={shot.id ?? shotIdx} className="flex items-start gap-3 py-2.5">
                                    <ShotLine slug={c.slug} shot={shot} idx={shotIdx} />
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {/* Loose shots — no shoot (legacy rows) or their shoot was removed */}
                {generalShots.length > 0 && (
                  <div>
                    <div className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-charcoal-60 mb-2">General shot list</div>
                    <ul className="space-y-2">
                      {generalShots.map(({ shot, idx }) => (
                        <li key={shot.id ?? idx} className="flex items-start gap-3 lq-well p-2.5">
                          <ShotLine slug={c.slug} shot={shot} idx={idx} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
