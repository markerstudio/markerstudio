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
  // Map the legacy badge palette onto Marker Glass chip tones so both shoot
  // and shot statuses render as lq-chips without changing the callers' API.
  const badge = badges[optimistic] || "";
  const tone = badge.includes("emerald")
    ? "lq-chip--green"
    : badge.includes("amber") || badge.includes("orange")
    ? "lq-chip--orange"
    : badge.includes("sky") || badge.includes("blue")
    ? "lq-chip--blue"
    : badge.includes("red") || badge.includes("rose")
    ? "lq-chip--red"
    : "";

  return (
    <button
      type="button"
      disabled={pending}
      title="Tap to advance status"
      className={`lq-chip lq-press !text-[11px] transition-opacity ${tone} ${pending ? "opacity-60" : ""}`}
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
