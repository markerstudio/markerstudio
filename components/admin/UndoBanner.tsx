import type { ReactNode } from "react";
import { getUndoSnapshot } from "@/lib/undo";
import { undoDeleteAction } from "@/app/admin/undo-actions";

/* Shown after a critical delete: names what was removed and offers a one-click
   Undo (restores the snapshotted rows — see lib/undo.ts). Also renders the
   green "restored" / red "couldn't undo" follow-ups. Server component — drop it
   near the page's other alert messages and pass the relevant searchParams.
   Renders as a floating glass toast pinned above the mobile tab bar. */

// Floating wrapper: fixed above the mobile tab bar (hidden ≥900px, where the
// rail takes over and the toast can hug the bottom edge).
function Toast({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-[calc(84px+env(safe-area-inset-bottom,0px))] z-40 flex justify-center min-[900px]:bottom-6">
      <div className="lq-chrome lq-pop-in pointer-events-auto flex max-w-full items-center gap-3 rounded-full px-5 py-3 text-sm">
        {children}
      </div>
    </div>
  );
}

export default async function UndoBanner({
  undo,
  restored,
  undoError,
  back,
}: {
  undo?: string; // searchParams.undo — snapshot id set by the delete action
  restored?: string; // searchParams.restored — label of what came back
  undoError?: string; // searchParams.undoError — restore was blocked
  back: string; // where the Undo should land (usually the current page)
}) {
  if (restored) {
    return (
      <Toast>
        <span className="lq-chip lq-chip--green shrink-0">✓</span>
        <span className="text-charcoal-80">
          Restored <b className="text-ink">{restored}</b> — everything is back.
        </span>
      </Toast>
    );
  }
  if (undoError) {
    return (
      <Toast>
        <span className="lq-chip lq-chip--red shrink-0">!</span>
        <span className="text-charcoal-80">Couldn&apos;t undo — something with the same name or id was created in the meantime.</span>
      </Toast>
    );
  }

  const snap = await getUndoSnapshot(Number(undo || 0));
  if (!snap) return null;

  return (
    <Toast>
      <span className="min-w-0 truncate text-charcoal-80">
        Deleted <b className="text-ink">{snap.label}</b>.
      </span>
      <form action={undoDeleteAction} className="shrink-0">
        <input type="hidden" name="id" value={snap.id} />
        <input type="hidden" name="back" value={back} />
        <button className="lq-btn lq-btn--dark lq-btn--sm">↩ Undo</button>
      </form>
    </Toast>
  );
}
