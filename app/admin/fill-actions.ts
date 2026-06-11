"use server";

// Bulk auto-fill — walks every client portal and fills the *empty* basics with
// presentable bilingual studio copy derived from what the client already has
// (name, plan, onboarding brief). Never overwrites anything that's filled.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { getSql, isDbEnabled } from "@/lib/db";
import type { ClientData } from "@/lib/clients";

export async function autofillPortals() {
  const s = await getSession();
  if (!s || s.role !== "admin") redirect("/login");
  if (!isDbEnabled()) redirect("/admin/clients");
  const sql = getSql();

  const clients = (await sql`SELECT id, slug, name, data FROM clients ORDER BY id ASC`) as unknown as {
    id: number;
    slug: string;
    name: string;
    data: ClientData;
  }[];

  let touched = 0;
  let fields = 0;

  for (const c of clients) {
    const d = (c.data || {}) as ClientData;
    const name = c.name || c.slug;
    const brief = d.onboarding;
    let changed = 0;

    const setL = (obj: { en: string; ar: string } | undefined, en: string, ar: string) => {
      const t = obj || { en: "", ar: "" };
      if (!t.en && !t.ar) {
        t.en = en;
        t.ar = ar;
        changed++;
      }
      return t;
    };

    // Hero line — from the brief's own words when we have them.
    d.hero = setL(
      d.hero,
      brief?.brandDescription
        ? `${name} — ${brief.brandDescription.slice(0, 120)}`
        : `A private portal for ${name} — the plan, the content, the results and the finances, all in one place.`,
      brief?.brandDescription
        ? `${name} — ${brief.brandDescription.slice(0, 120)}`
        : `بوابة خاصة بـ${name} — الخطة والمحتوى والنتائج والمالية، في مكان واحد.`
    );

    // Hero watermark word.
    if (!d.accent) {
      d.accent = name.split(/\s+/)[0].toUpperCase().slice(0, 12);
      changed++;
    }

    // Plan name from the brief's selected packages.
    d.plan = d.plan || { name: "", active: true, start: "", end: "" };
    if (!d.plan.name && brief) {
      const pkg = [brief.plan, brief.marketingPlan, ...(brief.services || []).filter((x) => x !== "Other")]
        .filter(Boolean)
        .join(" + ");
      if (pkg) {
        d.plan.name = pkg;
        changed++;
      }
    }
    d.plan.note = setL(
      d.plan.note,
      "We review this plan together at the end of each cycle and prepare the next one.",
      "نراجع هذه الخطة معًا في نهاية كل دورة ونحضّر التالية."
    );

    // Section headlines.
    d.dashboard = d.dashboard || { headline: { en: "", ar: "" }, cards: [], vitals: [] };
    d.dashboard.headline = setL(d.dashboard.headline, "The work, at a glance.", "العمل، بلمحة.");
    d.social = d.social || { headline: { en: "", ar: "" }, posts: [] };
    d.social.headline = setL(d.social.headline, "This month's content calendar.", "روزنامة المحتوى لهذا الشهر.");
    d.analysis = d.analysis || {
      organic: { headline: { en: "", ar: "" }, metrics: [] },
      paid: { spend: "", note: { en: "", ar: "" }, campaigns: [] },
    };
    d.analysis.organic.headline = setL(d.analysis.organic.headline, "Organic performance.", "الأداء العضوي.");
    d.analysis.paid.note = setL(
      d.analysis.paid.note,
      "Each campaign below is part of one sequence: awareness → curiosity → action.",
      "كل حملة أدناه جزء من تسلسل واحد: وعي ← فضول ← فعل."
    );

    if (changed > 0) {
      await sql`UPDATE clients SET data = ${JSON.stringify(d)}::jsonb, updated_at = now() WHERE id = ${c.id}`;
      revalidatePath(`/portal/${c.slug}`);
      touched++;
      fields += changed;
    }
  }

  revalidatePath("/admin/clients");
  redirect(`/admin/clients?filled=${touched}.${fields}`);
}
