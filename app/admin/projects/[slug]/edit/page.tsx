import { notFound } from "next/navigation";
import ProjectForm from "@/components/admin/ProjectForm";
import { getProject } from "@/lib/projects";

export const dynamic = "force-dynamic";

export default async function EditProjectPage({ params }: { params: { slug: string } }) {
  const project = await getProject(params.slug);
  if (!project) notFound();
  return <ProjectForm project={project} />;
}
