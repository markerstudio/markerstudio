"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { getSql } from "@/lib/db";
import { createSession, destroySession, getSession } from "@/lib/auth";
import type { Project } from "@/lib/projects";

type UserRow = { id: number; email: string; name: string; password_hash: string };

export async function login(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const sql = getSql();
  const rows = (await sql`
    SELECT id, email, name, password_hash FROM users WHERE email = ${email} LIMIT 1
  `) as unknown as UserRow[];
  const u = rows[0];
  if (!u || !(await bcrypt.compare(password, u.password_hash))) {
    redirect("/admin/login?error=1");
  }
  await createSession({ id: u.id, email: u.email, name: u.name });
  redirect("/admin");
}

export async function logout() {
  destroySession();
  redirect("/admin/login");
}

function list(v: FormDataEntryValue | null): string[] {
  return String(v || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseProject(fd: FormData): Project {
  const g = (k: string) => String(fd.get(k) || "").trim();
  return {
    slug: g("slug"),
    color: g("color") || "#303030",
    logo: g("logo"),
    year: g("year"),
    name: { en: g("name_en"), ar: g("name_ar") },
    tag: { en: g("tag_en"), ar: g("tag_ar") },
    services: { en: list(fd.get("services_en")), ar: list(fd.get("services_ar")) },
    deliverables: { en: list(fd.get("deliverables_en")), ar: list(fd.get("deliverables_ar")) },
    summary: { en: g("summary_en"), ar: g("summary_ar") },
    challenge: { en: g("challenge_en"), ar: g("challenge_ar") },
    approach: { en: g("approach_en"), ar: g("approach_ar") },
    results: { en: g("results_en"), ar: g("results_ar") },
    gallery: list(fd.get("gallery")),
  };
}

export async function saveProject(formData: FormData) {
  if (!(await getSession())) redirect("/admin/login");

  const p = parseProject(formData);
  const { slug, color, logo, year, ...data } = p;
  const original = String(formData.get("originalSlug") || "").trim();
  const json = JSON.stringify(data);
  const sql = getSql();

  if (original) {
    await sql`
      UPDATE projects
      SET slug = ${slug}, color = ${color}, logo = ${logo}, year = ${year}, data = ${json}::jsonb, updated_at = now()
      WHERE slug = ${original}
    `;
  } else {
    await sql`
      INSERT INTO projects (slug, color, logo, year, data, sort_order)
      VALUES (${slug}, ${color}, ${logo}, ${year}, ${json}::jsonb, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM projects))
    `;
  }

  revalidatePath("/");
  revalidatePath(`/work/${slug}`);
  if (original && original !== slug) revalidatePath(`/work/${original}`);
  redirect("/admin");
}

export async function deleteProject(formData: FormData) {
  if (!(await getSession())) redirect("/admin/login");
  const slug = String(formData.get("slug") || "").trim();
  const sql = getSql();
  await sql`DELETE FROM projects WHERE slug = ${slug}`;
  revalidatePath("/");
  revalidatePath(`/work/${slug}`);
  redirect("/admin");
}
