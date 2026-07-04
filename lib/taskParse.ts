// Natural-language quick-add parser for the Tasks board. Pure + client-safe
// (no server imports) so the composer can re-parse on every keystroke and show
// live chips for what it understood. Recognised, anywhere in the text:
//
//   dates      "today" "tomorrow" "tonight" "next week" "next mon" "friday"
//              "in 3 days" "in 2 weeks" "aug 12" "12 aug" "2026-07-12" "12/8"
//   times      "at 5" "at 5pm" "17:30" "5:30pm" "noon" "morning" "evening"
//   priority   "!urgent" "!high" "!low" (also "!!"→high, "!!!"→urgent)
//   project    "@acme" — matched against the client list / Notion projects
//              passed in (name or slug prefix, case-insensitive)
//
// Matched fragments are stripped from the title. Every match carries its
// character range so the input can highlight the tokens in place.

export type ParsedTokenKind = "due" | "time" | "priority" | "project";
export type ParsedToken = { kind: ParsedTokenKind; start: number; end: number; text: string; label: string };

export type ProjectOption = {
  key: string; // client slug or notion project id
  name: string;
  kind: "client" | "studio" | "notion";
  color?: string;
};

export type ParsedTask = {
  title: string;
  due?: string; // ISO yyyy-mm-dd
  time?: string; // "HH:MM"
  priority?: "low" | "normal" | "high" | "urgent";
  project?: ProjectOption;
  tokens: ParsedToken[];
};

const DAY = 86400000;
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fromToday(days: number, now: Date): string {
  return toISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + days));
}
// Next occurrence of a weekday, 1–7 days out ("friday" on a Friday = next Friday).
function nextWeekday(target: number, now: Date, forceNextWeek = false): string {
  let diff = (target - now.getDay() + 7) % 7;
  if (diff === 0) diff = 7;
  if (forceNextWeek && diff < 7) diff += 7 - ((now.getDay() + diff) % 7 === target ? 0 : 0); // keep simple: "next mon" = the mon of next week
  return fromToday(diff, now);
}

function friendlyDate(iso: string, now: Date): string {
  const today = toISODate(now);
  const tomorrow = fromToday(1, now);
  if (iso === today) return "Today";
  if (iso === tomorrow) return "Tomorrow";
  const d = new Date(`${iso}T00:00:00`);
  const days = Math.round((d.getTime() - new Date(`${today}T00:00:00`).getTime()) / DAY);
  if (days > 1 && days < 7) return d.toLocaleDateString("en-GB", { weekday: "long" });
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function to24h(hRaw: number, min: number, mer?: string): string | null {
  let h = hRaw;
  if (mer === "pm" && h < 12) h += 12;
  if (mer === "am" && h === 12) h = 0;
  // Bare small hours with no am/pm ("at 5") almost always mean the afternoon
  // in a studio workday; 8–11 stay morning.
  if (!mer && h >= 1 && h <= 7) h += 12;
  if (h > 23 || min > 59) return null;
  return `${pad(h)}:${pad(min)}`;
}

type Rule = { re: RegExp; apply: (m: RegExpMatchArray, now: Date, out: ParsedTask) => { label: string } | null; kind: ParsedTokenKind };

const RULES: Rule[] = [
  // ---- priority ----
  {
    kind: "priority",
    re: /(?:^|\s)(!{1,3}|!(?:urgent|high|med(?:ium)?|normal|low))(?=\s|$)/gi,
    apply(m, _now, out) {
      const t = m[1].toLowerCase();
      const p =
        t === "!!!" || t === "!urgent" ? "urgent"
        : t === "!!" || t === "!high" ? "high"
        : t === "!low" ? "low"
        : t === "!" ? "high"
        : "normal";
      out.priority = p;
      return { label: p === "urgent" ? "Urgent" : p === "high" ? "High priority" : p === "low" ? "Low priority" : "Normal" };
    },
  },
  // ---- relative dates ----
  {
    kind: "due",
    re: /(?:^|\s)(today|tonight|tomorrow|tmrw|next week|this week(?:end)?)(?=\s|$|[.,])/gi,
    apply(m, now, out) {
      const t = m[1].toLowerCase();
      if (t === "today") out.due = fromToday(0, now);
      else if (t === "tonight") {
        out.due = fromToday(0, now);
        if (!out.time) out.time = "19:00";
      } else if (t === "tomorrow" || t === "tmrw") out.due = fromToday(1, now);
      else if (t === "next week") out.due = nextWeekday(1, now); // next Monday
      else if (t === "this weekend") out.due = nextWeekday(6, now); // Saturday
      else out.due = fromToday((5 - now.getDay() + 7) % 7 || 7, now); // this week → Friday
      return { label: friendlyDate(out.due, now) + (t === "tonight" ? " evening" : "") };
    },
  },
  {
    kind: "due",
    re: /(?:^|\s)in (\d+) (day|week|month)s?(?=\s|$|[.,])/gi,
    apply(m, now, out) {
      const n = parseInt(m[1], 10);
      const unit = m[2].toLowerCase();
      const days = unit === "day" ? n : unit === "week" ? n * 7 : 0;
      if (unit === "month") {
        const d = new Date(now.getFullYear(), now.getMonth() + n, now.getDate());
        out.due = toISODate(d);
      } else out.due = fromToday(days, now);
      return { label: friendlyDate(out.due, now) };
    },
  },
  {
    kind: "due",
    re: /(?:^|\s)(next |this )?(sun|mon|tue(?:s)?|wed(?:nes)?|thu(?:rs)?|fri|sat(?:ur)?)(?:day)?(?=\s|$|[.,])/gi,
    apply(m, now, out) {
      const prefix = (m[1] || "").trim().toLowerCase();
      const stem = m[2].toLowerCase().slice(0, 3);
      const idx = WEEKDAYS.findIndex((w) => w.startsWith(stem));
      if (idx < 0) return null;
      let iso = nextWeekday(idx, now);
      if (prefix === "next") {
        // "next fri" when today is Wed = the Friday of next week.
        const first = new Date(`${iso}T00:00:00`);
        const daysOut = Math.round((first.getTime() - new Date(`${toISODate(now)}T00:00:00`).getTime()) / DAY);
        if (daysOut < 7) iso = toISODate(new Date(first.getFullYear(), first.getMonth(), first.getDate() + 7));
      }
      out.due = iso;
      return { label: friendlyDate(iso, now) };
    },
  },
  // ---- absolute dates ----
  {
    kind: "due",
    re: /(?:^|\s)(\d{4}-\d{2}-\d{2})(?=\s|$|[.,])/g,
    apply(m, now, out) {
      out.due = m[1];
      return { label: friendlyDate(m[1], now) };
    },
  },
  {
    kind: "due",
    re: /(?:^|\s)(?:on )?(\d{1,2})[\/.](\d{1,2})(?:[\/.](\d{2,4}))?(?=\s|$|[.,])/g,
    apply(m, now, out) {
      // day/month (studio convention), optional year.
      const d = parseInt(m[1], 10);
      const mo = parseInt(m[2], 10);
      let y = m[3] ? parseInt(m[3], 10) : now.getFullYear();
      if (y < 100) y += 2000;
      if (d < 1 || d > 31 || mo < 1 || mo > 12) return null;
      let iso = `${y}-${pad(mo)}-${pad(d)}`;
      if (!m[3] && iso < toISODate(now)) iso = `${y + 1}-${pad(mo)}-${pad(d)}`; // "12/1" already passed → next year
      out.due = iso;
      return { label: friendlyDate(iso, now) };
    },
  },
  {
    kind: "due",
    re: /(?:^|\s)(?:on )?(?:(\d{1,2})(?:st|nd|rd|th)? (jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* (\d{1,2})(?:st|nd|rd|th)?)(?=\s|$|[.,])/gi,
    apply(m, now, out) {
      const day = parseInt(m[1] || m[4], 10);
      const mon = MONTHS.indexOf((m[2] || m[3]).toLowerCase());
      if (day < 1 || day > 31 || mon < 0) return null;
      let y = now.getFullYear();
      let iso = `${y}-${pad(mon + 1)}-${pad(day)}`;
      if (iso < toISODate(now)) iso = `${y + 1}-${pad(mon + 1)}-${pad(day)}`;
      out.due = iso;
      return { label: friendlyDate(iso, now) };
    },
  },
  // ---- times ----
  {
    kind: "time",
    re: /(?:^|\s)(?:at |@ )?(\d{1,2}):(\d{2})\s?(am|pm)?(?=\s|$|[.,])/gi,
    apply(m, _now, out) {
      const t = to24h(parseInt(m[1], 10), parseInt(m[2], 10), m[3]?.toLowerCase());
      if (!t) return null;
      out.time = t;
      return { label: t };
    },
  },
  {
    kind: "time",
    re: /(?:^|\s)at (\d{1,2})\s?(am|pm)?(?=\s|$|[.,])/gi,
    apply(m, _now, out) {
      const t = to24h(parseInt(m[1], 10), 0, m[2]?.toLowerCase());
      if (!t) return null;
      out.time = t;
      return { label: t };
    },
  },
  {
    kind: "time",
    re: /(?:^|\s)(\d{1,2})\s?(am|pm)(?=\s|$|[.,])/gi,
    apply(m, _now, out) {
      const t = to24h(parseInt(m[1], 10), 0, m[2].toLowerCase());
      if (!t) return null;
      out.time = t;
      return { label: t };
    },
  },
  {
    kind: "time",
    re: /(?:^|\s)(?:at )?(noon|midday|morning|afternoon|evening)(?=\s|$|[.,])/gi,
    apply(m, _now, out) {
      const t = m[1].toLowerCase();
      out.time = t === "noon" || t === "midday" ? "12:00" : t === "morning" ? "09:00" : t === "afternoon" ? "14:00" : "19:00";
      return { label: out.time };
    },
  },
];

// "@acme" / "@marker" — matched against the provided projects (clients, the
// studio itself, Notion projects). Longest-name match wins so "@beit sahour
// bakery" beats "@beit".
function matchProject(text: string, at: number, projects: ProjectOption[]): { proj: ProjectOption; len: number } | null {
  const rest = text.slice(at + 1).toLowerCase();
  let best: { proj: ProjectOption; len: number } | null = null;
  for (const p of projects) {
    for (const cand of [p.name.toLowerCase(), p.key.toLowerCase()]) {
      if (!cand) continue;
      // Match progressively longer prefixes of the candidate word-by-word.
      const words = cand.split(/\s+/);
      for (let w = words.length; w >= 1; w--) {
        const frag = words.slice(0, w).join(" ");
        if (frag.length < 2) continue;
        if (rest.startsWith(frag) && (!best || frag.length > best.len)) {
          best = { proj: p, len: frag.length };
        }
      }
      // Also allow a partial first word of 3+ chars ("@ram" → Ramallah Cafe).
      const typed = rest.match(/^[^\s@,.!?]{3,}/)?.[0];
      if (typed && cand.startsWith(typed) && (!best || typed.length > best.len)) {
        best = { proj: p, len: typed.length };
      }
    }
  }
  return best;
}

export function parseTask(input: string, projects: ProjectOption[], now = new Date()): ParsedTask {
  const out: ParsedTask = { title: input, tokens: [] };
  const cut: { start: number; end: number }[] = [];

  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rule.re.exec(input))) {
      // First match of each field wins; later duplicates stay in the title.
      if (rule.kind === "due" && out.due) continue;
      if (rule.kind === "time" && out.time) continue;
      if (rule.kind === "priority" && out.priority) continue;
      const res = rule.apply(m, now, out);
      if (!res) continue;
      const lead = m[0].match(/^\s+/)?.[0].length ?? 0;
      const start = m.index + lead;
      const end = m.index + m[0].length;
      out.tokens.push({ kind: rule.kind, start, end, text: input.slice(start, end), label: res.label });
      cut.push({ start, end });
    }
  }

  // Projects: every "@" gets one shot; first match wins.
  for (let i = 0; i < input.length; i++) {
    if (input[i] !== "@" || out.project) continue;
    if (i > 0 && !/\s/.test(input[i - 1])) continue;
    const hit = matchProject(input, i, projects);
    if (hit) {
      out.project = hit.proj;
      const end = i + 1 + hit.len;
      out.tokens.push({ kind: "project", start: i, end, text: input.slice(i, end), label: hit.proj.name });
      cut.push({ start: i, end });
    }
  }

  // A time with no date means today (a reminder for later today).
  if (out.time && !out.due) {
    out.due = toISODate(now);
    out.tokens.push({ kind: "due", start: input.length, end: input.length, text: "", label: "Today" });
  }

  // Strip matched fragments from the title.
  cut.sort((a, b) => b.start - a.start);
  let title = input;
  for (const c of cut) title = title.slice(0, c.start) + " " + title.slice(c.end);
  out.title = title.replace(/\s{2,}/g, " ").replace(/\s+([.,!?])/g, "$1").trim();

  out.tokens.sort((a, b) => a.start - b.start);
  return out;
}

export function friendlyDue(iso: string | undefined, now = new Date()): string {
  if (!iso) return "";
  const today = toISODate(now);
  if (iso < today) {
    const days = Math.round((new Date(`${today}T00:00:00`).getTime() - new Date(`${iso}T00:00:00`).getTime()) / DAY);
    return days === 1 ? "Yesterday" : `${days}d overdue`;
  }
  return friendlyDate(iso, now);
}
