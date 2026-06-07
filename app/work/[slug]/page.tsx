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
    openGraph: {
      title: `${project.name.en} — Marker Studio®`,
      description: project.summary.en,
      type: "article",
    },
  };
}

export default async function ProjectPage({ params }: { params: { slug: string } }) {
  const project = await getProject(params.slug);
  if (!project) notFound();
  const next = await getNextProject(params.slug);
  return <ProjectView project={project} next={next} />;
}
