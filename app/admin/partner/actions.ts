"use server";

// Ramzi's stories work list. Each connected client carries its own list of
// stories tasks (see ClientData.storiesTasks); these actions let Ramzi (and the
// super admin) add, advance, and clear them from the partner portal. Writes go
// through updateClientData so the rest of the client's data is left untouched.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession, canSeePartner } from "@/lib/auth";
import { getClient, updateClientData, hasStories, type StoriesTask } from "@/lib/clients";

// Only the partner area's audience may touch these, and only for a client that's
// actually connected for stories (or Ramzi's own) — never an arbitrary client.
async function authStoriesClient(slug: string) {
  const user = await getSession();
  if (!user) redirect("/login");
  if (!canSeePartner(user)) redirect("/admin");
  const c = await getClient(slug);
  if (!c || !(hasStories(c.data) || c.data?.owner === "ramzi")) redirect("/admin/partner");
  return c;
}

export async function addStoriesTaskAction(formData: FormData) {
  const slug = String(formData.get("slug") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const due = String(formData.get("due") || "").trim();
  await authStoriesClient(slug);
  if (title) {
    await updateClientData(slug, (d) => {
      const task: StoriesTask = {
        id: `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
        title,
        status: "todo",
        due: due || undefined,
        at: new Date().toISOString(),
      };
      d.storiesTasks = [...(d.storiesTasks || []), task];
    });
    revalidatePath("/admin/partner");
  }
  redirect("/admin/partner");
}

export async function setStoriesTaskStatusAction(formData: FormData) {
  const slug = String(formData.get("slug") || "").trim();
  const id = String(formData.get("id") || "").trim();
  const raw = String(formData.get("status") || "todo");
  const status = (["todo", "doing", "done"].includes(raw) ? raw : "todo") as StoriesTask["status"];
  await authStoriesClient(slug);
  await updateClientData(slug, (d) => {
    d.storiesTasks = (d.storiesTasks || []).map((t) => (t.id === id ? { ...t, status } : t));
  });
  revalidatePath("/admin/partner");
  redirect("/admin/partner");
}

export async function deleteStoriesTaskAction(formData: FormData) {
  const slug = String(formData.get("slug") || "").trim();
  const id = String(formData.get("id") || "").trim();
  await authStoriesClient(slug);
  await updateClientData(slug, (d) => {
    d.storiesTasks = (d.storiesTasks || []).filter((t) => t.id !== id);
  });
  revalidatePath("/admin/partner");
  redirect("/admin/partner");
}
