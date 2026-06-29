import { toCSV } from "@/lib/portalCsv";
import type { ClientData } from "@/lib/clients";

// Prompt for the merged Plan & Content surface. Bakes in the client's plan + the
// current shoots/shots/posts so the AI extends (not duplicates) them, leaving a
// clearly-marked spot for the user's own ideas. The AI returns strict JSON that
// applyPlanContentJson (PlanContentTab) merges into shoots, shot list, and calendar.
export function planContentPrompt(data: ClientData): string {
  const plan = data.plan;
  const shots = (data.photo?.shots ?? []).map((s) => `- ${s.title}${s.type ? ` (${s.type})` : ""}`).join("\n") || "- (none yet)";
  const sessions = (data.photo?.sessions ?? []).map((s) => `- ${s.date || "?"} ${s.title}`).join("\n") || "- (none yet)";
  const posts = (data.social?.posts ?? []).map((p) => `- ${p.date || "?"} · ${p.type || "post"} · ${p.title}`).join("\n") || "- (none yet)";
  return `You are a senior content strategist at Marker Studio® planning a month of CONTENT and the SHOOTS needed to produce it for a client. Return STRICT JSON only.

CLIENT PLAN (context):
- Plan: ${plan?.name || "—"}
- Cycle: ${[plan?.start, plan?.end].filter(Boolean).join(" → ") || "ongoing"}
- Note: ${plan?.note?.en || "—"}

ALREADY PLANNED (extend and complement these — do NOT repeat them):
Shoot schedule:
${sessions}
Shot list:
${shots}
Calendar posts:
${posts}

=== MY IDEAS / BRIEF FOR THIS MONTH (themes, products, campaigns, tone) ===
[write what this month should achieve here]

Return ONLY a JSON object with EXACTLY this shape (omit arrays you don't need):
{
  "sessions": [
    { "date": "YYYY-MM-DD", "title": "Product shoot — new menu", "location": "Studio", "brief": { "en": "what to capture", "ar": "ماذا نصوّر" }, "status": "planned" }
  ],
  "shots": [
    { "title": "Hero reel — flat lay", "type": "post|story|reel|carousel" }
  ],
  "posts": [
    { "date": "YYYY-MM-DD", "type": "post|story|reel|carousel", "platform": "Instagram",
      "title": "short hook/title", "hook": "scroll-stopping first line", "caption": "full caption",
      "hashtags": "#one #two", "cta": "Book now", "brief": "type-specific direction (reel script / story frames / carousel slides)",
      "stage": "idea|shoot|edit|scheduled|posted" }
  ]
}

Rules:
- Spread posts realistically across the cycle dates; vary type and platform.
- A "shot" is something to capture on a shoot; create shots for posts that need original footage.
- Use the date format and enum values EXACTLY as shown. Write captions/briefs like a human strategist.
- Output ONLY the JSON object — no commentary, no code fences.`;
}

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
