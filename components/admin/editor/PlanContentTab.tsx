"use client";

import { memo, useCallback, useState, useTransition } from "react";
import { savePhotoSection, saveSection } from "@/app/admin/clients/section-actions";
import { ensurePhotoIds, genPhotoId } from "@/lib/photo";
import SocialCalendar from "@/components/SocialCalendar";
import ShotRail from "./ShotRail";
import { input, lbl, Text, Bi } from "./fields";
import type { ClientData, ClientPhoto, PhotoSession, SocialPost, LocalizedText } from "@/lib/clients";

// One shoot (session) row — memoised + id-keyed so typing re-renders only this row.
const SessionRow = memo(function SessionRow({ session, onChange, onRemove }: { session: PhotoSession; onChange: (id: string, patch: Partial<PhotoSession>) => void; onRemove: (id: string) => void }) {
  const id = session.id!;
  const brief = session.brief ?? { en: "", ar: "" };
  return (
    <div className="border border-neutral-200 rounded-lg p-3 relative pr-10 bg-white">
      <button type="button" onClick={() => onRemove(id)} className="absolute top-2 right-2 text-xs font-medium text-neutral-300 hover:text-red-600">✕</button>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={lbl}>Date</label>
          <input type="date" className={input} value={session.date} onChange={(e) => onChange(id, { date: e.target.value })} />
        </div>
        <div>
          <label className={lbl}>Time</label>
          <input className={input} value={session.time ?? ""} placeholder="14:00" onChange={(e) => onChange(id, { time: e.target.value })} />
        </div>
      </div>
      <div className="mt-2"><Text label="Title" value={session.title} onChange={(title) => onChange(id, { title })} placeholder="Product shoot — new menu" /></div>
      <div className="grid grid-cols-2 gap-2 mt-2 items-end">
        <Text label="Location" value={session.location ?? ""} onChange={(location) => onChange(id, { location })} placeholder="Studio / on-site" />
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
      <div className="mt-2"><Bi label="Brief" value={brief} onChange={(b: LocalizedText) => onChange(id, { brief: b })} area /></div>
    </div>
  );
});

// The merged "Plan & Content" surface: plan + shoot schedule + a draggable shot
// rail + the content calendar. Drag a shot onto a day to schedule a linked post.
// Photo (sessions+shots) saves via savePhotoSection; plan+social via saveSection.
export default function PlanContentTab({ slug, data }: { slug: string; data: ClientData }) {
  const [plan, setPlan] = useState(data.plan);
  const [photo, setPhoto] = useState<ClientPhoto>(() => ensurePhotoIds(data.photo));
  const [posts, setPosts] = useState<SocialPost[]>(data.social?.posts ?? []);
  const [headline, setHeadline] = useState<LocalizedText>(data.social?.headline ?? { en: "", ar: "" });
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState("");
  const mark = () => { setDirty(true); setMsg(""); };

  const patchPlan = (p: Partial<typeof plan>) => { setPlan((cur) => ({ ...cur, ...p })); mark(); };
  const setToggle = (p: Partial<ClientPhoto>) => { setPhoto((cur) => ({ ...cur, ...p })); mark(); };

  const changeSession = useCallback((id: string, patch: Partial<PhotoSession>) => {
    setPhoto((cur) => ({ ...cur, sessions: (cur.sessions ?? []).map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
    setDirty(true); setMsg("");
  }, []);
  const removeSession = useCallback((id: string) => {
    setPhoto((cur) => ({ ...cur, sessions: (cur.sessions ?? []).filter((s) => s.id !== id) }));
    setDirty(true); setMsg("");
  }, []);
  const addSession = () => { setPhoto((cur) => ({ ...cur, sessions: [...(cur.sessions ?? []), { id: genPhotoId(), date: "", time: "", location: "", title: "", brief: { en: "", ar: "" }, status: "planned" }] })); mark(); };

  const setShots = useCallback((shots: ClientPhoto["shots"]) => { setPhoto((cur) => ({ ...cur, shots })); setDirty(true); setMsg(""); }, []);

  // Drag a shot onto a calendar day → schedule a linked post pre-filled from it.
  function onDropShot(date: string, shotId: string) {
    const shot = (photo.shots ?? []).find((s) => s.id === shotId);
    if (!shot) return;
    setPosts((cur) => [
      ...cur,
      { date, platform: "", title: shot.title, notes: "", status: "scheduled", stage: "scheduled", type: shot.type ?? "post", brief: "", caption: "", mediaUrl: shot.mediaUrl, mediaKind: shot.mediaKind, fromShot: shotId },
    ]);
    mark();
  }

  // Toggle "needs shoot" on a planned post: add (or remove) a linked shot in the
  // shoot to-do list, so planning a post can feed the shoot list automatically.
  function onNeedsShoot(idx: number) {
    const post = posts[idx];
    if (!post) return;
    if (post.fromShot) {
      const shotId = post.fromShot;
      setPhoto((cur) => ({ ...cur, shots: (cur.shots ?? []).filter((s) => s.id !== shotId) }));
      setPosts((cur) => cur.map((p, i) => (i === idx ? { ...p, fromShot: undefined } : p)));
    } else {
      const shotId = genPhotoId();
      setPhoto((cur) => ({
        ...cur,
        active: cur.active ?? true,
        shots: [...(cur.shots ?? []), { id: shotId, title: post.title || "Shoot", status: "todo", type: post.type ?? "post", mediaUrl: post.mediaUrl, mediaKind: post.mediaKind }],
      }));
      setPosts((cur) => cur.map((p, i) => (i === idx ? { ...p, fromShot: shotId } : p)));
    }
    mark();
  }

  function save() {
    startTransition(async () => {
      const r1 = await savePhotoSection(slug, photo);
      const r2 = await saveSection(slug, { plan, social: { headline, posts } });
      if (r1.ok && r2.ok) { setDirty(false); setMsg("Saved ✓"); }
      else setMsg(r1.error || r2.error || "Save failed.");
    });
  }

  const sessions = photo.sessions ?? [];

  return (
    <div className="space-y-6">
      {/* The plan */}
      <fieldset className="bg-white border border-neutral-200 rounded-xl p-6">
        <legend className="px-2 -ml-2 font-bold">The plan</legend>
        <div className="flex items-center justify-end mb-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="custom-checkbox" checked={plan.active} onChange={(e) => patchPlan({ active: e.target.checked })} /> Active
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 mb-4">
          <Text label="Plan name" value={plan.name} onChange={(name) => patchPlan({ name })} placeholder="Monthly social media management" />
          <Text label="Notion / plan link (optional)" value={plan.notionUrl ?? ""} onChange={(notionUrl) => patchPlan({ notionUrl })} placeholder="https://notion.so/…" />
          <Text label="Start" value={plan.start} onChange={(start) => patchPlan({ start })} placeholder="Feb 26" />
          <Text label="End" value={plan.end} onChange={(end) => patchPlan({ end })} placeholder="May 26 (blank = ongoing)" />
        </div>
        <Bi label="Plan note" value={plan.note} onChange={(note) => patchPlan({ note })} area />
        <Bi label="Content plan headline" value={headline} onChange={(h) => { setHeadline(h); mark(); }} />
      </fieldset>

      {/* Photography sharing toggles */}
      <fieldset className="bg-white border border-neutral-200 rounded-xl p-6">
        <legend className="px-2 -ml-2 font-bold">Photography sharing</legend>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="flex items-start gap-3 text-sm rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
            <input type="checkbox" className="custom-checkbox mt-0.5" checked={!!photo.active} onChange={(e) => setToggle({ active: e.target.checked })} />
            <span className="leading-relaxed"><b>Photographer portal.</b> Connect this client so the photographer sees the schedule + shot list.</span>
          </label>
          <label className="flex items-start gap-3 text-sm rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
            <input type="checkbox" className="custom-checkbox mt-0.5" checked={!!photo.sharePlan} onChange={(e) => setToggle({ sharePlan: e.target.checked })} />
            <span className="leading-relaxed"><b>Share the plan</b> with the photographer for context.</span>
          </label>
          <label className="flex items-start gap-3 text-sm rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
            <input type="checkbox" className="custom-checkbox mt-0.5" checked={!!photo.showToClient} onChange={(e) => setToggle({ showToClient: e.target.checked })} />
            <span className="leading-relaxed"><b>Show shoots</b> in the client&apos;s own portal.</span>
          </label>
        </div>
      </fieldset>

      {/* The hub: shoot schedule + shot rail (left) · content calendar (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 items-start">
        <div className="space-y-6">
          <fieldset className="bg-white border border-neutral-200 rounded-xl p-5">
            <legend className="px-2 -ml-2 font-bold text-sm">Shoot schedule</legend>
            <div className="space-y-3">
              {sessions.length === 0 && <p className="text-sm text-neutral-400">No shoots scheduled.</p>}
              {sessions.map((s) => <SessionRow key={s.id} session={s} onChange={changeSession} onRemove={removeSession} />)}
              <button type="button" onClick={addSession} className="text-sm font-semibold text-orange hover:text-orange-deep">+ Add shoot</button>
            </div>
          </fieldset>

          <fieldset className="bg-white border border-neutral-200 rounded-xl p-5">
            <legend className="px-2 -ml-2 font-bold text-sm">Shot list</legend>
            <p className="text-xs text-neutral-400 mb-3">Drag a shot onto a calendar day to schedule it as a post.</p>
            <ShotRail shots={photo.shots ?? []} onChange={setShots} />
          </fieldset>
        </div>

        <fieldset className="bg-white border border-neutral-200 rounded-xl p-5 min-w-0">
          <legend className="px-2 -ml-2 font-bold text-sm">Content calendar</legend>
          <SocialCalendar posts={posts} editable lang="en" onChange={(p) => { setPosts(p); mark(); }} onDropShot={onDropShot} onNeedsShoot={onNeedsShoot} />
        </fieldset>
      </div>

      <div className="flex items-center gap-3 sticky bottom-0 bg-neutral-100/95 backdrop-blur py-3">
        <button type="button" onClick={save} disabled={pending || !dirty} className="bg-orange text-white font-semibold rounded-md px-6 py-2.5 text-sm hover:bg-orange-deep transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {pending ? "Saving…" : "Save Plan & Content"}
        </button>
        {msg && <span className="text-sm text-neutral-600">{msg}</span>}
        {dirty && !pending && <span className="text-xs text-amber-700">Unsaved changes</span>}
      </div>
    </div>
  );
}
