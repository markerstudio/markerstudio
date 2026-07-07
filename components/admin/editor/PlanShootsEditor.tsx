"use client";

import { memo, useCallback, useState, useTransition } from "react";
import { savePhotoSection } from "@/app/admin/clients/section-actions";
import { ensurePhotoIds, genPhotoId } from "@/lib/photo";
import type { ClientPhoto, PhotoSession, PhotoTask, LocalizedText } from "@/lib/clients";

const input = "lq-input";
const lbl = "block text-[11px] font-display font-bold uppercase tracking-[0.1em] text-charcoal-60 mb-1";

// --- One shoot row. Memoised + keyed by id so a keystroke re-renders ONLY this
// row (not the whole list), and editing/removing rows never scrambles focus. ----
const SessionRow = memo(function SessionRow({
  session,
  onChange,
  onRemove,
}: {
  session: PhotoSession;
  onChange: (id: string, patch: Partial<PhotoSession>) => void;
  onRemove: (id: string) => void;
}) {
  const id = session.id!;
  const brief = session.brief ?? { en: "", ar: "" };
  const setBrief = (b: LocalizedText) => onChange(id, { brief: b });
  return (
    <div className="relative pe-16">
      <button type="button" onClick={() => onRemove(id)} className="absolute top-0 end-0 text-xs font-medium text-charcoal-40 hover:text-rose-600">Remove</button>
      <div className="grid grid-cols-2 md:grid-cols-[140px_110px_1fr_130px] gap-3 items-end">
        <div>
          <label className={lbl}>Date</label>
          <input type="date" className={input} value={session.date} onChange={(e) => onChange(id, { date: e.target.value })} />
        </div>
        <div>
          <label className={lbl}>Time</label>
          <input className={input} value={session.time ?? ""} placeholder="14:00" onChange={(e) => onChange(id, { time: e.target.value })} />
        </div>
        <div>
          <label className={lbl}>Title</label>
          <input className={input} value={session.title} placeholder="Product shoot — new menu" onChange={(e) => onChange(id, { title: e.target.value })} />
        </div>
        <div>
          <label className={lbl}>Status</label>
          <select className={input} value={session.status} onChange={(e) => onChange(id, { status: e.target.value as PhotoSession["status"] })}>
            <option value="planned">Planned</option>
            <option value="confirmed">Confirmed</option>
            <option value="shot">Shot</option>
            <option value="delivered">Delivered</option>
          </select>
        </div>
      </div>
      <div className="mt-3">
        <label className={lbl}>Location</label>
        <input className={input} value={session.location ?? ""} placeholder="Studio / on-site address" onChange={(e) => onChange(id, { location: e.target.value })} />
      </div>
      <div className="mt-3">
        <label className={lbl}>Brief — what to capture</label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <span className="block text-[10px] font-display font-bold text-charcoal-40 mb-1">EN</span>
            <textarea dir="ltr" rows={2} className={input} value={brief.en} onChange={(e) => setBrief({ ...brief, en: e.target.value })} />
          </div>
          <div>
            <span className="block text-[10px] font-display font-bold text-charcoal-40 mb-1">AR</span>
            <textarea dir="rtl" rows={2} className={input} value={brief.ar} onChange={(e) => setBrief({ ...brief, ar: e.target.value })} />
          </div>
        </div>
      </div>
    </div>
  );
});

// --- One shot-list row, same memoisation strategy. When `assignOptions` is given
// (unassigned/legacy shots), a small select lets you move the shot under a shoot
// by setting its sessionId. --------------------------------------------------
const ShotRow = memo(function ShotRow({
  shot,
  onChange,
  onRemove,
  assignOptions,
}: {
  shot: PhotoTask;
  onChange: (id: string, patch: Partial<PhotoTask>) => void;
  onRemove: (id: string) => void;
  assignOptions?: PhotoSession[];
}) {
  const id = shot.id!;
  return (
    <div className="lq-well p-3 relative">
      <button type="button" onClick={() => onRemove(id)} className="absolute top-2 end-2 text-xs font-medium text-charcoal-40 hover:text-rose-600">Remove</button>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_140px] gap-3 pe-16 items-end">
        <div>
          <label className={lbl}>Shot</label>
          <input className={input} value={shot.title} placeholder="Hero shot — flat lay" onChange={(e) => onChange(id, { title: e.target.value })} />
        </div>
        <div>
          <label className={lbl}>Status</label>
          <select className={input} value={shot.status} onChange={(e) => onChange(id, { status: e.target.value as PhotoTask["status"] })}>
            <option value="todo">To do</option>
            <option value="doing">In progress</option>
            <option value="done">Done</option>
          </select>
        </div>
        <div>
          <label className={lbl}>Due (optional)</label>
          <input className={input} value={shot.due ?? ""} placeholder="Fri" onChange={(e) => onChange(id, { due: e.target.value })} />
        </div>
        <div className="md:col-span-3">
          <label className={lbl}>Note (optional)</label>
          <input className={input} value={shot.note ?? ""} onChange={(e) => onChange(id, { note: e.target.value })} />
        </div>
        {assignOptions && assignOptions.length > 0 && (
          <div className="md:col-span-3">
            <label className={lbl}>Assign to shoot</label>
            <select
              className={input}
              value={shot.sessionId && assignOptions.some((s) => s.id === shot.sessionId) ? shot.sessionId : ""}
              onChange={(e) => onChange(id, { sessionId: e.target.value || undefined })}
            >
              <option value="">Unassigned</option>
              {assignOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {(s.title || "Shoot") + (s.date ? ` — ${s.date}` : "")}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
});

// Photography editor — toggles + shoot schedule + shot list. Saves ONLY the photo
// block via its own button (savePhotoSection → jsonb_set), independent of the rest
// of the client form, so it never clobbers (or is clobbered by) other edits, and a
// photographer's status flip on their portal survives a settings save.
export default function PlanShootsEditor({ slug, initialPhoto }: { slug: string; initialPhoto?: ClientPhoto }) {
  const [photo, setPhoto] = useState<ClientPhoto>(() => ensurePhotoIds(initialPhoto));
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState("");

  const sessions = photo.sessions ?? [];
  const shots = photo.shots ?? [];

  const mark = () => { setDirty(true); setMsg(""); };

  // Stable callbacks (functional updates) so memoised rows don't re-render.
  const changeSession = useCallback((id: string, patch: Partial<PhotoSession>) => {
    setPhoto((p) => ({ ...p, sessions: (p.sessions ?? []).map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
    mark();
  }, []);
  const removeSession = useCallback((id: string) => {
    setPhoto((p) => ({ ...p, sessions: (p.sessions ?? []).filter((s) => s.id !== id) }));
    mark();
  }, []);
  const changeShot = useCallback((id: string, patch: Partial<PhotoTask>) => {
    setPhoto((p) => ({ ...p, shots: (p.shots ?? []).map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
    mark();
  }, []);
  const removeShot = useCallback((id: string) => {
    setPhoto((p) => ({ ...p, shots: (p.shots ?? []).filter((t) => t.id !== id) }));
    mark();
  }, []);

  const setToggle = (patch: Partial<ClientPhoto>) => { setPhoto((p) => ({ ...p, ...patch })); mark(); };
  const addSession = () => { setPhoto((p) => ({ ...p, sessions: [...(p.sessions ?? []), { id: genPhotoId(), date: "", time: "", location: "", title: "", brief: { en: "", ar: "" }, status: "planned" }] })); mark(); };
  // Add a shot — under a specific shoot (sessionId) or loose/general when omitted.
  const addShot = (sessionId?: string) => { setPhoto((p) => ({ ...p, shots: [...(p.shots ?? []), { id: genPhotoId(), title: "", status: "todo", due: "", note: "", ...(sessionId ? { sessionId } : {}) }] })); mark(); };

  // Group shots under their shoot; anything with no sessionId (legacy rows) or a
  // stale one (its shoot was removed) falls into the Unassigned section below.
  const sessionIds = new Set(sessions.map((s) => s.id).filter(Boolean));
  const unassignedShots = shots.filter((t) => !t.sessionId || !sessionIds.has(t.sessionId));

  function save() {
    startTransition(async () => {
      const res = await savePhotoSection(slug, photo);
      if (res.ok) { setDirty(false); setMsg("Saved ✓"); }
      else setMsg(res.error || "Save failed.");
    });
  }

  return (
    <div className="lq-card p-5">
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="custom-checkbox mt-0.5" checked={!!photo.active} onChange={(e) => setToggle({ active: e.target.checked })} />
        <span className="leading-relaxed">
          <b>Photography</b> (Ameer). Turning this on connects the client to the <b>photographer portal</b>, where the
          schedule and shot list below appear so the photographer knows exactly what to shoot.
        </span>
      </label>

      {photo.active && (
        <div className="mt-4 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex items-start gap-3 text-sm lq-well px-4 py-3">
              <input type="checkbox" className="custom-checkbox mt-0.5" checked={!!photo.sharePlan} onChange={(e) => setToggle({ sharePlan: e.target.checked })} />
              <span className="leading-relaxed"><b>Send the plan to the photographer.</b> Shares this client&apos;s plan on the photographer portal for context. Off = the plan stays Marker-only.</span>
            </label>
            <label className="flex items-start gap-3 text-sm lq-well px-4 py-3">
              <input type="checkbox" className="custom-checkbox mt-0.5" checked={!!photo.showToClient} onChange={(e) => setToggle({ showToClient: e.target.checked })} />
              <span className="leading-relaxed"><b>Show shoots in the client&apos;s portal.</b> Reveals the schedule &amp; shot list to the client too. Off = visible to Marker and the photographer only.</span>
            </label>
          </div>

          <div>
            <label className={lbl}>Shoots — each with its own shot list</label>
            <div className="space-y-3">
              {sessions.map((s) => {
                const own = shots.filter((t) => t.sessionId && t.sessionId === s.id);
                return (
                  <div key={s.id} className="lq-well p-3">
                    <SessionRow session={s} onChange={changeSession} onRemove={removeSession} />
                    <div className="mt-3 pt-3 border-t border-charcoal/5">
                      <span className={lbl}>Shot list for this shoot</span>
                      <div className="space-y-2">
                        {own.map((t) => (
                          <ShotRow key={t.id} shot={t} onChange={changeShot} onRemove={removeShot} />
                        ))}
                        <button type="button" onClick={() => addShot(s.id)} className="text-sm font-semibold text-orange hover:text-orange-deep">+ Add shot</button>
                      </div>
                    </div>
                  </div>
                );
              })}
              <button type="button" onClick={addSession} className="text-sm font-semibold text-orange hover:text-orange-deep">+ Add shoot</button>
            </div>
          </div>

          <div>
            <label className={lbl}>Unassigned shots — general list</label>
            <div className="space-y-3">
              {unassignedShots.map((t) => (
                <ShotRow key={t.id} shot={t} onChange={changeShot} onRemove={removeShot} assignOptions={sessions} />
              ))}
              {unassignedShots.length === 0 && (
                <p className="text-xs text-charcoal-40">Nothing loose — every shot lives under a shoot. Shots added here stay general until assigned.</p>
              )}
              <button type="button" onClick={() => addShot()} className="text-sm font-semibold text-orange hover:text-orange-deep">+ Add general shot</button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending || !dirty}
          className="lq-btn lq-btn--primary lq-btn--sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? "Saving…" : "Save shoots"}
        </button>
        {msg && <span className="text-sm text-charcoal-60">{msg}</span>}
        {dirty && !pending && <span className="text-xs text-amber-700">Unsaved changes</span>}
      </div>
    </div>
  );
}
