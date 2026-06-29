"use client";

import { memo, useCallback, useState, useTransition } from "react";
import { savePhotoSection } from "@/app/admin/clients/section-actions";
import { ensurePhotoIds, genPhotoId } from "@/lib/photo";
import type { ClientPhoto, PhotoSession, PhotoTask, LocalizedText } from "@/lib/clients";

const input = "w-full border border-neutral-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange/40 focus:border-orange";
const lbl = "block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1";

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
    <div className="border border-neutral-200 rounded-lg p-3 relative pr-16">
      <button type="button" onClick={() => onRemove(id)} className="absolute top-2 right-2 text-xs font-medium text-neutral-400 hover:text-red-600">Remove</button>
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
            <span className="block text-[10px] font-bold text-neutral-400 mb-1">EN</span>
            <textarea dir="ltr" rows={2} className={input} value={brief.en} onChange={(e) => setBrief({ ...brief, en: e.target.value })} />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-neutral-400 mb-1">AR</span>
            <textarea dir="rtl" rows={2} className={input} value={brief.ar} onChange={(e) => setBrief({ ...brief, ar: e.target.value })} />
          </div>
        </div>
      </div>
    </div>
  );
});

// --- One shot-list row, same memoisation strategy. -----------------------------
const ShotRow = memo(function ShotRow({
  shot,
  onChange,
  onRemove,
}: {
  shot: PhotoTask;
  onChange: (id: string, patch: Partial<PhotoTask>) => void;
  onRemove: (id: string) => void;
}) {
  const id = shot.id!;
  return (
    <div className="border border-neutral-200 rounded-lg p-3 relative">
      <button type="button" onClick={() => onRemove(id)} className="absolute top-2 right-2 text-xs font-medium text-neutral-400 hover:text-red-600">Remove</button>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_140px] gap-3 pr-16 items-end">
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
  const addShot = () => { setPhoto((p) => ({ ...p, shots: [...(p.shots ?? []), { id: genPhotoId(), title: "", status: "todo", due: "", note: "" }] })); mark(); };

  function save() {
    startTransition(async () => {
      const res = await savePhotoSection(slug, photo);
      if (res.ok) { setDirty(false); setMsg("Saved ✓"); }
      else setMsg(res.error || "Save failed.");
    });
  }

  return (
    <div className="rounded-xl border border-neutral-200 p-4">
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
            <label className="flex items-start gap-3 text-sm rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
              <input type="checkbox" className="custom-checkbox mt-0.5" checked={!!photo.sharePlan} onChange={(e) => setToggle({ sharePlan: e.target.checked })} />
              <span className="leading-relaxed"><b>Send the plan to the photographer.</b> Shares this client&apos;s plan on the photographer portal for context. Off = the plan stays Marker-only.</span>
            </label>
            <label className="flex items-start gap-3 text-sm rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
              <input type="checkbox" className="custom-checkbox mt-0.5" checked={!!photo.showToClient} onChange={(e) => setToggle({ showToClient: e.target.checked })} />
              <span className="leading-relaxed"><b>Show shoots in the client&apos;s portal.</b> Reveals the schedule &amp; shot list to the client too. Off = visible to Marker and the photographer only.</span>
            </label>
          </div>

          <div>
            <label className={lbl}>Shoot schedule</label>
            <div className="space-y-3">
              {sessions.map((s) => (
                <SessionRow key={s.id} session={s} onChange={changeSession} onRemove={removeSession} />
              ))}
              <button type="button" onClick={addSession} className="text-sm font-semibold text-orange hover:text-orange-deep">+ Add shoot</button>
            </div>
          </div>

          <div>
            <label className={lbl}>Shot list — the photo-session to-do</label>
            <div className="space-y-3">
              {shots.map((t) => (
                <ShotRow key={t.id} shot={t} onChange={changeShot} onRemove={removeShot} />
              ))}
              <button type="button" onClick={addShot} className="text-sm font-semibold text-orange hover:text-orange-deep">+ Add shot</button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending || !dirty}
          className="bg-orange text-white font-semibold rounded-md px-5 py-2 text-sm hover:bg-orange-deep transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? "Saving…" : "Save shoots"}
        </button>
        {msg && <span className="text-sm text-neutral-600">{msg}</span>}
        {dirty && !pending && <span className="text-xs text-amber-700">Unsaved changes</span>}
      </div>
    </div>
  );
}
