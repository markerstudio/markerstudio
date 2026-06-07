import MarkerSite from "@/components/MarkerSite";
import { getProjects } from "@/lib/projects";

// Revalidate so admin edits surface without a redeploy (ISR). With no DB
// configured this simply renders the seed data.
export const revalidate = 30;

export default async function Home() {
  const projects = await getProjects();
  return <MarkerSite projects={projects} />;
}
