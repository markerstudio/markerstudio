"use client";

import { memo, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { savePhotoSection, saveSection } from "@/app/admin/clients/section-actions";
import { ensurePhotoIds, genPhotoId } from "@/lib/photo";
import SocialCalendar from "@/components/SocialCalendar";
import MonthScaffold from "./MonthScaffold";
import ShotRailBase from "./ShotRail";

// Typing a post title updates `posts` state and re-renders this whole tab;
// memoizing the rail (its props only change on shot edits) keeps keystrokes
// from re-painting the drag rail too.
const ShotRail = memo(ShotRailBase);
import { input, lbl, Text, Bi } from "./fields";
import { planContentPrompt } from "./aiPrompts";
import type { ClientData, ClientPhoto, PhotoSession, SocialPost, SocialContentType, ContentStage, LocalizedText } from "@/lib/clients";

const CTYPES: SocialContentType[] = ["post", "story", "reel", "carousel"];
const CSTAGES: ContentStage[] = ["idea", "shoot", "edit", "scheduled", "posted"];
const coerceType = (t: unknown): SocialContentType => (CTYPES.includes(t as SocialContentType) ? (t as SocialContentType) : "post");
const coerceLT = (v: unknown): LocalizedText => {
  if (typeof v === "string") return { en: v, ar: "" };
  if (v && typeof v === "object") { const o = v as { en?: unknown; ar?: unknown }; return { en: String(o.en ?? ""), ar: String(o.ar ?? "") }; }
  return { en: "", ar: "" };
};

// One shoot (session) row — memoised + id-keyed so typing re-renders only this row.
const SessionRow = memo(function SessionRow({ session, onChange, onRemove }: { session: PhotoSession; onChange: (id: string, patch: Partial<PhotoSession>) => void; onRemove: (id: string) => void }) {
  const id = session.id!;
  const brief = session.brief ?? { en: "", ar: "" };
  return (
    <div className="bg-white/60 border border-charcoal/5 rounded-2xl p-3 relative pr-10">
      <button type="button" onClick={() => onRemove(id)} className="absolute top-2 right-2 text-xs font-semibold text-charcoal-40 hover:text-rose-700">✕</button>
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
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "offline" | "error">("idle");
  const [aiCopied, setAiCopied] = useState(false);
  const [aiPaste, setAiPaste] = useState("");
  const [aiMsg, setAiMsg] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [showRhythm, setShowRhythm] = useState(false);

  // ---- Auto-save with an offline-safe draft queue -------------------------
  // Every edit bumps `ver`; a debounce saves the latest snapshot. The snapshot
  // is journaled to localStorage BEFORE the network call, so a crash, refresh,
  // or lost connection never loses work — the draft restores on next open and
  // flushes as soon as we're back online.
  const verRef = useRef(0);
  const savingRef = useRef(false);
  const latest = useRef({ plan, photo, posts, headline });
  latest.current = { plan, photo, posts, headline };
  const draftKey = `ms-draft:plancontent:${slug}`;
  const mark = () => { verRef.current++; setDirty(true); setMsg(""); };

  function copyPrompt() {
    navigator.clipboard?.writeText(planContentPrompt({ ...data, plan, photo, social: { headline, posts } }));
    setAiCopied(true);
    setTimeout(() => setAiCopied(false), 1800);
  }

  // Parse the AI's JSON reply and merge its sessions / shots / posts into the hub
  // (append — existing items are kept). Tolerant of code fences and string briefs.
  function applyAi() {
    let obj: { sessions?: unknown; shots?: unknown; posts?: unknown };
    try {
      const raw = aiPaste.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
      obj = JSON.parse(raw);
    } catch {
      setAiMsg("Couldn't read that — paste the JSON the AI returned (it should start with “{”).");
      return;
    }
    if (!obj || typeof obj !== "object") { setAiMsg("That isn't a JSON object — paste the { … } the AI returned."); return; }
    let added = 0;
    const newSessions: PhotoSession[] = Array.isArray(obj.sessions)
      ? obj.sessions.filter((s): s is Record<string, unknown> => !!s && typeof s === "object").map((s) => ({ id: genPhotoId(), date: String(s.date ?? ""), time: String(s.time ?? ""), location: String(s.location ?? ""), title: String(s.title ?? ""), brief: coerceLT(s.brief), status: (["planned", "confirmed", "shot", "delivered"].includes(String(s.status)) ? String(s.status) : "planned") as PhotoSession["status"] })).filter((s) => s.title || s.date)
      : [];
    const newShots = Array.isArray(obj.shots)
      ? obj.shots.filter((s): s is Record<string, unknown> => !!s && typeof s === "object").map((s) => ({ id: genPhotoId(), title: String(s.title ?? ""), status: "todo" as const, type: coerceType(s.type) })).filter((s) => s.title)
      : [];
    const newPosts: SocialPost[] = Array.isArray(obj.posts)
      ? obj.posts.filter((p): p is Record<string, unknown> => !!p && typeof p === "object").map((p) => {
          const stage = (CSTAGES.includes(String(p.stage) as ContentStage) ? String(p.stage) : "idea") as ContentStage;
          return { date: String(p.date ?? ""), platform: String(p.platform ?? ""), title: String(p.title ?? ""), notes: "", status: (stage === "posted" ? "posted" : stage === "scheduled" ? "scheduled" : "planned") as SocialPost["status"], stage, type: coerceType(p.type), brief: String(p.brief ?? ""), caption: String(p.caption ?? ""), hook: String(p.hook ?? ""), hashtags: String(p.hashtags ?? ""), cta: String(p.cta ?? "") };
        }).filter((p) => p.date || p.title)
      : [];

    if (newSessions.length || newShots.length) {
      setPhoto((cur) => ({ ...cur, sessions: [...(cur.sessions ?? []), ...newSessions], shots: [...(cur.shots ?? []), ...newShots] }));
      added += newSessions.length + newShots.length;
    }
    if (newPosts.length) { setPosts((cur) => [...cur, ...newPosts]); added += newPosts.length; }
    if (!added) { setAiMsg("Parsed OK, but found no sessions / shots / posts to add."); return; }
    mark();
    setAiPaste("");
    setAiMsg(`Filled ${added} item${added > 1 ? "s" : ""} ✓ — review on the calendar & rail, then Save.`);
  }

  const patchPlan = (p: Partial<typeof plan>) => { setPlan((cur) => ({ ...cur, ...p })); mark(); };
  const setToggle = (p: Partial<ClientPhoto>) => { setPhoto((cur) => ({ ...cur, ...p })); mark(); };

  const changeSession = useCallback((id: string, patch: Partial<PhotoSession>) => {
    setPhoto((cur) => ({ ...cur, sessions: (cur.sessions ?? []).map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
    verRef.current++; setDirty(true); setMsg("");
  }, []);
  const removeSession = useCallback((id: string) => {
    setPhoto((cur) => ({ ...cur, sessions: (cur.sessions ?? []).filter((s) => s.id !== id) }));
    verRef.current++; setDirty(true); setMsg("");
  }, []);
  const addSession = () => { setPhoto((cur) => ({ ...cur, sessions: [...(cur.sessions ?? []), { id: genPhotoId(), date: "", time: "", location: "", title: "", brief: { en: "", ar: "" }, status: "planned" }] })); mark(); };

  const setShots = useCallback((shots: ClientPhoto["shots"]) => { setPhoto((cur) => ({ ...cur, shots })); verRef.current++; setDirty(true); setMsg(""); }, []);

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

  // Push the newest snapshot to the server; re-runs itself if edits landed
  // while a save was in flight, and parks the draft locally on any failure.
  const flush = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaveState("saving");
    const ver = verRef.current;
    const snap = latest.current;
    try {
      const [r1, r2] = await Promise.all([
        savePhotoSection(slug, snap.photo),
        saveSection(slug, { plan: snap.plan, social: { headline: snap.headline, posts: snap.posts } }),
      ]);
      savingRef.current = false;
      if (r1.ok && r2.ok) {
        if (ver === verRef.current) {
          setDirty(false);
          setSaveState("saved");
          try { localStorage.removeItem(draftKey); } catch { /* private mode */ }
        } else {
          flush(); // newer edits arrived mid-save — save again
        }
      } else {
        setSaveState("error");
      }
    } catch {
      savingRef.current = false;
      setSaveState(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "error");
    }
  }, [slug, draftKey]);

  // Debounced auto-save: journal the draft, then save 1.2s after the last edit.
  useEffect(() => {
    if (!dirty) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ v: 1, at: Date.now(), plan, photo, posts, headline }));
    } catch { /* storage full / private mode — network save still runs */ }
    const t = setTimeout(flush, 1200);
    return () => clearTimeout(t);
  }, [dirty, plan, photo, posts, headline, draftKey, flush]);

  // Restore an unsaved draft (crash / refresh / offline close) — max a day old.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (!d || d.v !== 1 || Date.now() - (d.at || 0) > 24 * 3600 * 1000) { localStorage.removeItem(draftKey); return; }
      setPlan(d.plan); setPhoto(ensurePhotoIds(d.photo)); setPosts(d.posts ?? []); setHeadline(d.headline ?? { en: "", ar: "" });
      verRef.current++; setDirty(true);
      setMsg("Restored unsaved changes — saving…");
    } catch { /* corrupt draft — ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Offline drafts flush the moment the connection returns (plus a slow retry
  // for flaky links), ⌘S saves immediately, and closing with unsaved work warns.
  useEffect(() => {
    const onOnline = () => { if (verRef.current && dirty) flush(); };
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); flush(); } };
    const onLeave = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener("online", onOnline);
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onLeave);
    const retry = setInterval(() => { if (dirty && !savingRef.current && (saveState === "offline" || saveState === "error")) flush(); }, 30000);
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("keydown", onKey); window.removeEventListener("beforeunload", onLeave); clearInterval(retry); };
  }, [dirty, saveState, flush]);

  function save() {
    startTransition(async () => { await flush(); });
  }

  const sessions = photo.sessions ?? [];

  return (
    <div className="space-y-6">
      {/* Slim header — name/cycle/active inline; plan details & AI fill behind toggles. */}
      <div className="lq-card p-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className={lbl}>Plan</label>
            <input className={input} value={plan.name} placeholder="Monthly social media management" onChange={(e) => patchPlan({ name: e.target.value })} />
          </div>
          <div className="w-24"><label className={lbl}>Start</label><input className={input} value={plan.start} placeholder="Feb 26" onChange={(e) => patchPlan({ start: e.target.value })} /></div>
          <div className="w-24"><label className={lbl}>End</label><input className={input} value={plan.end} placeholder="ongoing" onChange={(e) => patchPlan({ end: e.target.value })} /></div>
          <label className="flex items-center gap-2 text-sm h-[38px] whitespace-nowrap"><input type="checkbox" className="custom-checkbox" checked={plan.active} onChange={(e) => patchPlan({ active: e.target.checked })} /> Active</label>
          <button type="button" onClick={() => { setShowRhythm((v) => !v); setShowAi(false); }} className="lq-btn lq-btn--dark">📅 Plan month</button>
          <button type="button" onClick={() => { setShowAi((v) => !v); setShowRhythm(false); }} className="lq-btn lq-btn--primary">✨ AI fill</button>
          <button type="button" onClick={() => setShowDetails((v) => !v)} className="lq-btn lq-btn--glass">{showDetails ? "Hide details" : "Plan details"}</button>
        </div>

        {showRhythm && (
          <div className="mt-4 border-t border-charcoal/5 pt-4">
            <p className="text-sm text-charcoal-60 mb-3">Set the month&apos;s rhythm once — which days get posts, reels or carousels, plus daily stories — and lay the whole month out in one click. Then fill the ideas in the calendar&apos;s <b>Planner</b> view, or let AI fill write them.</p>
            <MonthScaffold posts={posts} onAdd={(slots) => { setPosts((cur) => [...cur, ...slots]); mark(); }} />
          </div>
        )}

        {showAi && (
          <div className="mt-4 border-t border-charcoal/5 pt-4">
            <p className="text-sm text-charcoal-60 mb-3">Copy the prompt (it already includes this plan + current shoots & posts), add your ideas in ChatGPT / Claude, then paste the JSON reply and Apply — it fills the shoot schedule, shot list, and calendar.</p>
            <div className="flex items-center gap-3 flex-wrap mb-3">
              <button type="button" onClick={copyPrompt} className="lq-btn lq-btn--primary lq-btn--sm">{aiCopied ? "Copied ✓" : "Copy prompt"}</button>
              <button type="button" onClick={applyAi} className="lq-btn lq-btn--glass lq-btn--sm">Apply paste</button>
              {aiMsg && <span className="text-sm text-charcoal-80">{aiMsg}</span>}
            </div>
            <textarea value={aiPaste} onChange={(e) => setAiPaste(e.target.value)} rows={4} className={input} placeholder={'Paste the AI\'s JSON reply here… (starts with "{")'} dir="ltr" />
          </div>
        )}

        {showDetails && (
          <div className="mt-4 border-t border-charcoal/5 pt-4 space-y-4">
            <Text label="Notion / plan link (optional)" value={plan.notionUrl ?? ""} onChange={(notionUrl) => patchPlan({ notionUrl })} placeholder="https://notion.so/…" />
            <Bi label="Plan note" value={plan.note} onChange={(note) => patchPlan({ note })} area />
            <Bi label="Content plan headline" value={headline} onChange={(h) => { setHeadline(h); mark(); }} />
            <div>
              <span className={lbl}>Photography sharing</span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="flex items-start gap-2 text-sm lq-well px-3 py-2">
                  <input type="checkbox" className="custom-checkbox mt-0.5" checked={!!photo.active} onChange={(e) => setToggle({ active: e.target.checked })} />
                  <span className="leading-relaxed"><b>Photographer portal</b> — share schedule + shot list.</span>
                </label>
                <label className="flex items-start gap-2 text-sm lq-well px-3 py-2">
                  <input type="checkbox" className="custom-checkbox mt-0.5" checked={!!photo.sharePlan} onChange={(e) => setToggle({ sharePlan: e.target.checked })} />
                  <span className="leading-relaxed"><b>Share the plan</b> for context.</span>
                </label>
                <label className="flex items-start gap-2 text-sm lq-well px-3 py-2">
                  <input type="checkbox" className="custom-checkbox mt-0.5" checked={!!photo.showToClient} onChange={(e) => setToggle({ showToClient: e.target.checked })} />
                  <span className="leading-relaxed"><b>Show shoots</b> in the client&apos;s portal.</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Shoot schedule + shot list — their own full-width row, side by side.
          id="photography" is the jump target for the editor's Photography rail
          item (shoots save with the plan, so they live in this tab). */}
      <div id="photography" className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start scroll-mt-24">
        <fieldset className="lq-card p-5">
          <legend className="px-2 -ms-2 font-display font-bold text-[16px] tracking-tight text-ink">Shoot schedule</legend>
          <div className="space-y-3">
            {sessions.length === 0 && <p className="text-sm text-charcoal-40">No shoots scheduled.</p>}
            {sessions.map((s) => <SessionRow key={s.id} session={s} onChange={changeSession} onRemove={removeSession} />)}
            <button type="button" onClick={addSession} className="text-sm font-semibold text-orange hover:text-orange-deep">+ Add shoot</button>
          </div>
        </fieldset>

        <fieldset className="lq-card p-5">
          <legend className="px-2 -ms-2 font-display font-bold text-[16px] tracking-tight text-ink">Shot list</legend>
          <p className="text-xs text-charcoal-40 mb-3">Drag a shot onto a day in the calendar below to schedule it as a post.</p>
          <ShotRail shots={photo.shots ?? []} onChange={setShots} />
        </fieldset>
      </div>

      {/* Content calendar — full width on its own line. */}
      <fieldset className="lq-card p-5 min-w-0">
        <legend className="px-2 -ms-2 font-display font-bold text-[16px] tracking-tight text-ink">Content calendar</legend>
        <SocialCalendar posts={posts} editable lang="en" onChange={(p) => { setPosts(p); mark(); }} onDropShot={onDropShot} onNeedsShoot={onNeedsShoot} />
      </fieldset>

      {/* Auto-save status — everything saves itself; ⌘S / the button force it. */}
      <div className="flex items-center gap-3 sticky bottom-0 bg-paper/95 py-3">
        <span className={`ms-sync ${saveState === "saving" || pending ? "is-saving" : saveState === "offline" ? "is-offline" : saveState === "error" ? "is-error" : dirty ? "is-dirty" : "is-clean"}`}>
          {saveState === "saving" || pending
            ? "Saving…"
            : saveState === "offline"
            ? "Offline — changes kept safe, will sync when you're back"
            : saveState === "error"
            ? "Couldn't save — retrying automatically"
            : dirty
            ? "Editing…"
            : saveState === "saved"
            ? "All changes saved ✓"
            : "Auto-save is on"}
        </span>
        {(saveState === "error" || saveState === "offline") && (
          <button type="button" onClick={save} className="lq-btn lq-btn--glass lq-btn--sm">Save now</button>
        )}
        {msg && <span className="text-sm text-charcoal-60">{msg}</span>}
      </div>
    </div>
  );
}
