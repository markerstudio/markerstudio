import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProjectView from "@/components/ProjectView";
import { getProject, getProjectSlugs, getNextProject } from "@/lib/projects";

// ISR: regenerate so admin edits surface without a redeploy. Unknown slugs are
// rendered on demand (dynamicParams defaults to true).
export const revalidate = 30;

export async function generateStaticParams() {
  const slugs = await getProjectSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const project = await getProject(params.slug);
  if (!project) return { title: "Work — Marker Studio®" };
  return {
    title: `${project.name.en} — Marker Studio®`,
    description: project.summary.en,
    alternates: { canonical: `/work/${project.slug}` },
    openGraph: {
      title: `${project.name.en} — Marker Studio®`,
      description: project.summary.en,
      type: "article",
      url: `/work/${project.slug}`,
    },
  };
}

export default async function ProjectPage({ params }: { params: { slug: string } }) {
  const project = await getProject(params.slug);
  if (!project) notFound();
  const next = await getNextProject(params.slug);

  // CreativeWork structured data for the case study, with a breadcrumb back to
  // the work index. Honest fields only — no fabricated performance claims.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CreativeWork",
        name: project.name.en,
        about: project.tag.en,
        description: project.summary.en,
        url: `https://marker.ps/work/${project.slug}`,
        dateCreated: project.year,
        inLanguage: ["en", "ar"],
        creator: { "@type": "Organization", name: "Marker Studio®", url: "https://marker.ps" },
        keywords: project.services.en.join(", "),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Work", item: "https://marker.ps/#work" },
          { "@type": "ListItem", position: 2, name: project.name.en, item: `https://marker.ps/work/${project.slug}` },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ProjectView project={project} next={next} />
    </>
  );
}
