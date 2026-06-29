"use client";

import { useOptimistic, useTransition } from "react";

// A status pill that advances on tap and updates INSTANTLY (optimistic), then
// reconciles with the server once the action revalidates. Reverts on error.
// Generic over the status union so it serves both shoots and shots.
export default function PhotographerStatusButton<T extends string>({
  slug,
  id,
  idx,
  status,
  order,
  labels,
  badges,
  action,
}: {
  slug: string;
  id?: string;
  idx: number;
  status: T;
  order: T[];
  labels: Record<T, string>;
  badges: Record<T, string>;
  action: (formData: FormData) => Promise<void>;
}) {
  const [optimistic, setOptimistic] = useOptimistic(status);
  const [pending, startTransition] = useTransition();
  const next = order[(order.indexOf(optimistic) + 1) % order.length];

  return (
    <button
      type="button"
      disabled={pending}
      title="Tap to advance status"
      className={`text-[11px] font-semibold rounded-full border px-2.5 py-0.5 transition-opacity ${badges[optimistic]} ${pending ? "opacity-60" : ""}`}
      onClick={() =>
        startTransition(async () => {
          setOptimistic(next);
          const fd = new FormData();
          fd.set("slug", slug);
          if (id) fd.set("id", id);
          fd.set("idx", String(idx));
          fd.set("status", next);
          await action(fd);
        })
      }
    >
      {labels[optimistic]}
    </button>
  );
}
