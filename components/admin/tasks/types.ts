// Shared shapes for the Tasks board — assembled on the server (page.tsx), then
// owned by the client board which mutates optimistically via the actions API.
import type { DeliverableStatus, TaskPriority } from "@/lib/clients";

export const STUDIO_SLUG = "__studio__";
export const NOTION_SLUG = "__notion__";

export type BoardTask = {
  key: string; // `${slug}:${id}` — unique across lists
  slug: string; // client slug, __studio__, or __notion__
  id: string;
  listName: string; // "Vivid Bakery", "Studio", or the Notion project name
  color: string; // list dot colour
  sourceKind: "client" | "studio" | "notion";
  notionUrl?: string;
  notionPageId?: string; // set on local tasks mirrored to Notion
  title: string;
  detail?: string;
  note?: string;
  due?: string; // yyyy-mm-dd
  time?: string; // HH:MM
  status: DeliverableStatus;
  priority: TaskPriority;
  order?: number;
  createdAt?: string;
  completedAt?: string;
  kind?: "recurring" | "milestone";
  requestedByClient?: boolean;
  pending?: boolean;
};

export const PRIORITY_WEIGHT: Record<TaskPriority, number> = { urgent: 3, high: 2, normal: 1, low: 0 };

export const PRIORITY_META: Record<TaskPriority, { label: string; dot: string; chip: string }> = {
  urgent: { label: "Urgent", dot: "bg-red-500", chip: "text-red-700 bg-red-50 border-red-200" },
  high: { label: "High", dot: "bg-amber-500", chip: "text-amber-700 bg-amber-50 border-amber-200" },
  normal: { label: "Normal", dot: "bg-neutral-300", chip: "text-neutral-600 bg-neutral-50 border-neutral-200" },
  low: { label: "Low", dot: "bg-neutral-200", chip: "text-neutral-400 bg-neutral-50 border-neutral-200" },
};
