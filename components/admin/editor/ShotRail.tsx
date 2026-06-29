"use client";

import { memo, useCallback } from "react";
import FileUpload from "@/components/FileUpload";
import { genPhotoId } from "@/lib/photo";
import type { PhotoTask, SocialContentType } from "@/lib/clients";

const input = "w-full border border-neutral-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange/40 focus:border-orange";
const lbl = "block text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-1";

const TYPES: { id: SocialContentType; label: string }[] = [
  { id: "post", label: "Post" },
  { id: "story", label: "Story" },
  { id: "reel", label: "Reel" },
  { id: "carousel", label: "Carousel" },
];
const STATUSES: { id: PhotoTask["status"]; label: string }[] = [
  { id: "todo", label: "To do" },
  { id: "doing", label: "In progress" },
  { id: "done", label: "Done" },
];

// One draggable shot card — drag it onto the calendar to schedule a linked post.
const ShotCard = memo(function ShotCard({ shot, onChange, onRemove }: { shot: PhotoTask; onChange: (id: string, patch: Partial<PhotoTask>) => void; onRemove: (id: string) => void }) {
  const id = shot.id!;
  return (
    <div
      className="border border-neutral-200 rounded-lg p-3 bg-white relative cursor-grab active:cursor-grabbing"
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", JSON.stringify({ kind: "shot", id })); e.dataTransfer.effectAllowed = "copy"; }}
      title="Drag onto a calendar day to schedule it"
    >
      <button type="button" onClick={() => onRemove(id)} className="absolute top-2 right-2 text-xs font-medium text-neutral-300 hover:text-red-600">✕</button>
      <div className="flex items-start gap-3">
        <span aria-hidden className="text-neutral-300 mt-1 select-none">⠿</span>
        <div className="flex-1 min-w-0 pr-4">
          <input className={`${input} font-medium`} value={shot.title} placeholder="Hero reel — flat lay" onChange={(e) => onChange(id, { title: e.target.value })} />
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div>
              <label className={lbl}>Type</label>
              <select className={input} value={shot.type ?? "post"} onChange={(e) => onChange(id, { type: e.target.value as SocialContentType })}>
                {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Status</label>
              <select className={input} value={shot.status} onChange={(e) => onChange(id, { status: e.target.value as PhotoTask["status"] })}>
                {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-3 flex-wrap">
            {shot.mediaUrl ? (
              <div className="flex items-center gap-2">
                {shot.mediaKind === "video"
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  ? <video src={shot.mediaUrl} muted className="h-10 w-10 rounded object-cover border border-neutral-200" />
                  // eslint-disable-next-line @next/next/no-img-element
                  : <img src={shot.mediaUrl} alt="" className="h-10 w-10 rounded object-cover border border-neutral-200" />}
                <button type="button" onClick={() => onChange(id, { mediaUrl: "", mediaKind: undefined })} className="text-xs font-medium text-neutral-400 hover:text-red-600">Clear</button>
              </div>
            ) : (
              <FileUpload accept="image/*,video/*" label="Add media" compact
                onUploaded={({ url, contentType }) => onChange(id, { mediaUrl: url, mediaKind: contentType.startsWith("video") ? "video" : "image" })} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

// The shot list as a draggable rail. Controlled — edits the parent's photo.shots.
export default function ShotRail({ shots, onChange }: { shots: PhotoTask[]; onChange: (shots: PhotoTask[]) => void }) {
  const change = useCallback((id: string, patch: Partial<PhotoTask>) => {
    onChange(shots.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, [shots, onChange]);
  const remove = useCallback((id: string) => {
    onChange(shots.filter((s) => s.id !== id));
  }, [shots, onChange]);
  const add = () => onChange([...shots, { id: genPhotoId(), title: "", status: "todo", type: "post" }]);

  return (
    <div className="space-y-3">
      {shots.length === 0 && <p className="text-sm text-neutral-400">No shots yet. Add one, then drag it onto a calendar day.</p>}
      {shots.map((s) => <ShotCard key={s.id} shot={s} onChange={change} onRemove={remove} />)}
      <button type="button" onClick={add} className="text-sm font-semibold text-orange hover:text-orange-deep">+ Add shot</button>
    </div>
  );
}
