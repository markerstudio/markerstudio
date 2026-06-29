import { toCSV } from "@/lib/portalCsv";
import type { ClientData } from "@/lib/clients";

// AI prompt scoped to the ANALYTICS section only — built from the analysis rows
// of the CSV so the AI returns just those, and we merge only analysis back in.
export function analyticsPrompt(data: ClientData): string {
  const full = toCSV(data).replace(/^﻿/, "");
  const lines = full.split("\r\n");
  const csv = [lines[0], ...lines.filter((l) => l.startsWith("analysis."))].join("\n");
  return `You are a senior social media analyst at Marker Studio® writing the ANALYTICS section of a bilingual (English + Arabic) client report, from the raw Meta Ads Manager / Instagram Insights export pasted below.

Your job is NOT to dump numbers — it's to choose the numbers that matter and say what each one MEANS for the client, in warm plain language they actually understand.

Below is a CSV with columns: field,en,ar,value. Fill ONLY these analysis rows:

ORGANIC — analysis.organic.*
- analysis.organic.headline: one short line that captures the month's story (fill BOTH en and ar — natural Arabic, never literal translation).
- analysis.organic.metrics[n]: pick the 4–8 numbers that actually tell the story (Views, Reach, Profile visits, Follows, Link clicks, Interactions, Watch time…). For each:
  - .label = the metric name, short ("Views")
  - .value = the headline number exactly as in the export, formatted ("301,274")
  - .delta = the change vs the previous period when the export shows one ("+312%", "×4", "−12%") — leave blank if unknown, NEVER invent it
  - .note  = ONE sentence in plain words: what this number means and why the client should care ("More people are discovering you without paid push" — not "impressions increased")
- analysis.organic.reading: 2–3 sentences (en + ar): the overall story — what worked, what didn't, and what the numbers say should happen next.

PAID — analysis.paid.*
- analysis.paid.spend: total ad spend as shown ("$292.22").
- analysis.paid.note: one bilingual line on how the campaigns worked together as a sequence.
- analysis.paid.campaigns[n]: one per campaign — name, period, type (Awareness/Traffic/Engagement/Followers…), spend, reach, impressions, freq, cpm, and .desc = one line on what this campaign achieved in the bigger picture.

Rules:
- Numbers come from the export EXACTLY — never invent or estimate a number.
- Every en/ar pair gets BOTH languages, written like a human strategist, not a dashboard.
- Add rows by copying a line and increasing the [n] index; keep the "field" column EXACTLY as-is.
- Output ONLY the CSV (header + rows). No commentary, no code fences.

=== PASTE YOUR META / INSTAGRAM EXPORT BELOW THIS LINE ===
[paste the analytics export here]

=== ANALYTICS CSV TO FILL ===
${csv}`;
}

// AI prompt scoped to the SOCIAL MEDIA PLAN only — builds the content calendar
// as CSV rows we merge back into social.posts.
export function socialPrompt(data: ClientData): string {
  const full = toCSV(data).replace(/^﻿/, "");
  const lines = full.split("\r\n");
  const csv = [lines[0], ...lines.filter((l) => l.startsWith("social."))].join("\n");
  return `You are planning a one-month SOCIAL MEDIA CONTENT CALENDAR for a Marker Studio client, returning it as CSV.

Below is a CSV with columns: field,en,ar,value. Fill ONLY the social rows:
- social.headline = a short bilingual title for the plan (fill BOTH "en" and "ar", natural Arabic).
- social.posts[n] = one row-group per planned post, with:
  - .date  = ISO date YYYY-MM-DD
  - .type = post | story | reel (lowercase). If the plan includes "daily stories", add a story on most days.
  - .platform = Instagram / TikTok / Facebook / LinkedIn …
  - .title = the post idea / hook (English is fine)
  - .notes = goal or format (e.g. Carousel, Engagement, Trust)
  - .brief = the type-specific brief: for a post the caption + key message + visual direction; for a reel a short hook + scene-by-scene script + audio; for a story the frame-by-frame direction (polls, stickers, CTA).
  - .status = planned | scheduled | posted
- Add as many posts as the plan needs by copying a post group and increasing the [n] index (start at 0). Keep the "field" column EXACTLY.
- Aim for a realistic, varied month (mix of platforms, formats, and goals). Use real-looking dates spread across the month.
- Output ONLY the CSV (header + rows). No commentary, no code fences.

=== BRIEF (audience, goals, services, tone) ===
[describe the client and what this month should achieve here]

=== SOCIAL CSV TO FILL ===
${csv}`;
}
