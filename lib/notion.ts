// Notion sync — pull a content-calendar database into the portal's social posts.
// Uses an internal integration token (NOTION_TOKEN). Share the database with the
// integration in Notion first. We map flexibly:
//   - the Date property        → post date
//   - the Title property       → post title
//   - a "Platform" property    → platform (select / multi-select / text)
//   - a "Status"/"Stage" prop  → status (posted / scheduled / planned)
//   - a "Notes"/"Caption" prop → notes (rich text)
import type { SocialPost } from "@/lib/clients";

// Accept a raw Notion DB id or a database URL; return the 32-char id.
export function extractNotionId(s: string): string | null {
  const m = s.replace(/-/g, "").match(/[0-9a-fA-F]{32}/);
  return m ? m[0] : null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function fetchNotionPosts(dbId: string): Promise<SocialPost[]> {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new Error("NOTION_TOKEN not set");

  const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ page_size: 100 }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Notion ${res.status}`);
  const json = await res.json();

  const posts: SocialPost[] = [];
  for (const page of json.results || []) {
    const props = page.properties || {};
    let date = "";
    let title = "";
    let platform = "";
    let notes = "";
    let status: SocialPost["status"] = "planned";

    for (const [name, prop] of Object.entries<any>(props)) {
      const type = prop?.type;
      if (type === "date" && prop.date?.start && !date) {
        date = String(prop.date.start).slice(0, 10);
      } else if (type === "title") {
        title = (prop.title || []).map((t: any) => t.plain_text).join("");
      } else if (/platform|channel/i.test(name)) {
        if (type === "select") platform = prop.select?.name || "";
        else if (type === "multi_select") platform = (prop.multi_select || []).map((x: any) => x.name).join(", ");
        else if (type === "rich_text") platform = (prop.rich_text || []).map((t: any) => t.plain_text).join("");
      } else if (/status|stage|state/i.test(name)) {
        const s = type === "status" ? prop.status?.name : type === "select" ? prop.select?.name : "";
        const low = (s || "").toLowerCase();
        status = /post|publish|done|live/.test(low) ? "posted" : /sched/.test(low) ? "scheduled" : "planned";
      } else if (/note|caption|content/i.test(name) && type === "rich_text") {
        notes = (prop.rich_text || []).map((t: any) => t.plain_text).join("");
      }
    }

    if (date || title) posts.push({ date, platform, title, notes, status });
  }

  posts.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return posts;
}
