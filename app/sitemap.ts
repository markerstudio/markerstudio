import type { MetadataRoute } from "next";
import { getProjectSlugs } from "@/lib/projects";

// Public URLs only — home, careers, and every case study. Regenerated with the
// same cadence as the work pages so new projects surface to crawlers.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://marker.ps";
  const now = new Date();

  const slugs = await getProjectSlugs();
  const work = slugs.map((slug) => ({
    url: `${base}/work/${slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  return [
    { url: base, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/careers`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    ...work,
  ];
}
