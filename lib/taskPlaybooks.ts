// Playbooks — the studio's repeatable task recipes. A playbook is what a
// project needs from you: onboarding a new client, a branding pipeline, the
// monthly marketing cycle, a launch. The wizard lets you tick what applies,
// then either smart-schedules from a start date (each item carries a
// day-offset tuned to how the studio works) or back-plans everything to fit a
// delivery date you choose. Pure + client-safe: the wizard previews dates live.
import type { TaskPriority } from "@/lib/clients";
import { toISODate } from "@/lib/taskParse";

export type PlaybookItem = {
  id: string;
  title: string; // may contain "{n}" — replaced with the adjustable count
  detail?: string;
  day: number; // offset in days from the start date (smart schedule)
  priority?: TaskPriority;
  recurring?: "weekly"; // expands to one task per week ("· week 2")
  defaultOn?: boolean; // pre-ticked in the wizard (default true)
  count?: { default: number; min: number; max: number; label: string }; // wizard stepper for "{n}"
};

export type Playbook = {
  key: string;
  name: string;
  icon: string;
  tagline: string;
  hasWeeks?: boolean; // shows the "for N weeks" control (recurring items)
  items: PlaybookItem[];
};

export const PLAYBOOKS: Playbook[] = [
  {
    key: "onboarding",
    name: "Client onboarding",
    icon: "🤝",
    tagline: "A new client said yes — set them up right, nothing forgotten.",
    items: [
      { id: "kickoff", title: "Kickoff call — goals, expectations, contacts", day: 0, priority: "high" },
      { id: "portal", title: "Create the client portal & plan in the admin", day: 0 },
      { id: "assets", title: "Collect brand assets, logins & access", detail: "Logo files, fonts, photos, page admin access", day: 1 },
      { id: "proposal", title: "Send the proposal", day: 1, priority: "high" },
      { id: "agreement", title: "Get the agreement signed", day: 3, priority: "high" },
      { id: "invoice", title: "Send the first invoice", day: 4 },
      { id: "meta", title: "Connect Meta (Facebook + Instagram)", detail: "Admin → Clients → Meta → Continue with Facebook", day: 5 },
      { id: "brief", title: "Internal brief — voice, audience, goals", day: 6 },
      { id: "books", title: "Add the client to the books (Notion budget tracker)", day: 7, defaultOn: false },
    ],
  },
  {
    key: "branding",
    name: "Branding",
    icon: "🎨",
    tagline: "Identity from discovery to handoff — logo, brand book, packages.",
    items: [
      { id: "discovery", title: "Discovery questionnaire & brand audit", day: 0, priority: "high" },
      { id: "market", title: "Competitors & market scan", day: 2 },
      { id: "mood", title: "Moodboard & creative direction", day: 4 },
      { id: "concepts", title: "Logo concepts — 3 routes", day: 8, priority: "high" },
      { id: "revisions", title: "Client review & revisions round", day: 11 },
      { id: "logofinal", title: "Final logo — all formats & files", day: 14, priority: "high" },
      { id: "system", title: "Colour, type & usage system", day: 17 },
      { id: "brandbook", title: "Brand book", day: 21, priority: "high" },
      { id: "packages", title: "Packages & pricing sheet", day: 24 },
      { id: "templates", title: "Social templates kit", day: 26, defaultOn: false },
      { id: "handoff", title: "Final handoff — deliver every asset", day: 28, priority: "high" },
    ],
  },
  {
    key: "marketing",
    name: "Marketing — monthly cycle",
    icon: "📅",
    tagline: "The month's content machine: calendar, stories, posts, report.",
    hasWeeks: true,
    items: [
      { id: "strategy", title: "Monthly strategy & content themes", day: 0, priority: "high" },
      { id: "calendar", title: "Monthly social media calendar", day: 2, priority: "high" },
      { id: "shotlist", title: "Content shoot — plan & shot list", day: 4 },
      { id: "designs", title: "Design batch — posts & covers", day: 7 },
      { id: "approval", title: "Client approval on the calendar", day: 9, priority: "high" },
      { id: "stories", title: "Daily stories", detail: "Keep the account alive every day", day: 2, recurring: "weekly" },
      { id: "posts", title: "{n} posts this week", detail: "Publish per the calendar", day: 4, recurring: "weekly", count: { default: 3, min: 1, max: 7, label: "posts / week" } },
      { id: "midmonth", title: "Mid-month check-in & adjustments", day: 15 },
      { id: "ads", title: "Boosts & ads review", day: 20, defaultOn: false },
      { id: "report", title: "Monthly performance report", day: 28, priority: "high" },
    ],
  },
  {
    key: "launch",
    name: "Launch / campaign",
    icon: "🚀",
    tagline: "From concept to live campaign to wrap-up report.",
    items: [
      { id: "strategy", title: "Campaign strategy & goal", day: 0, priority: "high" },
      { id: "concept", title: "Creative concept & key visual", day: 3 },
      { id: "production", title: "Asset production — designs & video", day: 7 },
      { id: "copy", title: "Copywriting — EN & AR", day: 9 },
      { id: "schedule", title: "Schedule posts & ads", day: 12 },
      { id: "live", title: "Launch day — go live", day: 14, priority: "urgent" },
      { id: "community", title: "Community management — replies & DMs", day: 16 },
      { id: "optimize", title: "Optimise ads & budget", day: 18 },
      { id: "wrap", title: "Wrap-up report & learnings", day: 21 },
    ],
  },
];

// Prompts for the Checkpoint (brain-dump) mode — questions to ask yourself
// about a project; every line you write becomes a task via the smart parser.
export const CHECKPOINT_PROMPTS = [
  "What did I promise them last time we talked?",
  "What's blocking this project right now?",
  "What's due for them this month?",
  "What would genuinely impress them this week?",
  "Anything to invoice, collect, or renew?",
];

export type BuiltTask = {
  title: string;
  due?: string;
  priority?: TaskPriority;
  detail?: string;
  kind?: "milestone" | "recurring";
};

const addDays = (iso: string, n: number): string => {
  const d = new Date(`${iso}T00:00:00`);
  return toISODate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
};
const daysBetween = (a: string, b: string): number =>
  Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86400000);

// Turn a playbook selection into dated tasks.
// - Smart schedule: each item lands at start + its day offset.
// - Delivery date: one-off items are back-planned proportionally so the last
//   one lands ON the delivery date; weekly items stay weekly (they follow the
//   calendar, not the deadline) but never run past it.
export function buildPlaybookTasks(
  pb: Playbook,
  opts: { start: string; deliveryDate?: string; weeks?: number; selected: Set<string>; counts?: Record<string, number> }
): BuiltTask[] {
  const weeks = Math.max(1, Math.min(12, opts.weeks ?? 4));
  // Resolve "{n}" titles from the wizard's steppers (clamped to the item's range).
  const titled = pb.items.map((i) => {
    if (!i.count) return i;
    const n = Math.max(i.count.min, Math.min(i.count.max, opts.counts?.[i.id] ?? i.count.default));
    return { ...i, title: i.title.replace("{n}", String(n)) };
  });
  const chosen = titled.filter((i) => opts.selected.has(i.id));
  const oneOffs = chosen.filter((i) => !i.recurring);
  const maxDay = Math.max(1, ...oneOffs.map((i) => i.day));
  const span = opts.deliveryDate ? daysBetween(opts.start, opts.deliveryDate) : null;
  const scale = span !== null && span > 0 ? span / maxDay : 1;

  const out: BuiltTask[] = [];
  for (const item of chosen) {
    if (item.recurring === "weekly") {
      for (let w = 0; w < weeks; w++) {
        const due = addDays(opts.start, item.day + w * 7);
        if (opts.deliveryDate && due > opts.deliveryDate) break;
        out.push({
          title: weeks > 1 ? `${item.title} · week ${w + 1}` : item.title,
          due,
          priority: item.priority,
          detail: item.detail,
          kind: "recurring",
        });
      }
    } else {
      out.push({
        title: item.title,
        due: addDays(opts.start, Math.round(item.day * scale)),
        priority: item.priority,
        detail: item.detail,
        kind: "milestone",
      });
    }
  }
  out.sort((a, b) => ((a.due || "9999") < (b.due || "9999") ? -1 : 1));
  return out;
}
