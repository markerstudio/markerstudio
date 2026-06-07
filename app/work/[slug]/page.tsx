import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProjectView from "@/components/ProjectView";
import { getProject, getProjectSlugs } from "@/lib/projects";

export function generateStaticParams() {
  return getProjectSlugs().map((slug) => ({ slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const project = getProject(params.slug);
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

export default function ProjectPage({ params }: { params: { slug: string } }) {
  const project = getProject(params.slug);
  if (!project) notFound();
  return <ProjectView project={project} />;
}
