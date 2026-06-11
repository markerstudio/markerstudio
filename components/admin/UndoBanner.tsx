import { getUndoSnapshot } from "@/lib/undo";
import { undoDeleteAction } from "@/app/admin/undo-actions";

/* Shown after a critical delete: names what was removed and offers a one-click
   Undo (restores the snapshotted rows — see lib/undo.ts). Also renders the
   green "restored" / red "couldn't undo" follow-ups. Server component — drop it
   near the page's other alert messages and pass the relevant searchParams. */
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
      <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-4 py-2.5 mb-6">
        Restored <b>{restored}</b> — everything is back.
      </p>
    );
  }
  if (undoError) {
    return (
      <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-4 py-2.5 mb-6">
        Couldn&apos;t undo — something with the same name or id was created in the meantime.
      </p>
    );
  }

  const snap = await getUndoSnapshot(Number(undo || 0));
  if (!snap) return null;

  return (
    <div className="flex items-center justify-between gap-3 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-4 py-2.5 mb-6">
      <span>
        Deleted <b>{snap.label}</b>.
      </span>
      <form action={undoDeleteAction} className="shrink-0">
        <input type="hidden" name="id" value={snap.id} />
        <input type="hidden" name="back" value={back} />
        <button className="font-bold underline underline-offset-2 hover:text-orange-deep transition-colors">↩ Undo</button>
      </form>
    </div>
  );
}
