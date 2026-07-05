import { redirect } from "next/navigation";
import { getSession, isPartnerOnly, isPhotographerOnly } from "@/lib/auth";
import { isDbEnabled, getSql } from "@/lib/db";
import { isPushConfigured, countPushSubscriptions } from "@/lib/push";
import NotifyComposer from "@/components/admin/NotifyComposer";

export const dynamic = "force-dynamic";

export default async function NotifyPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role === "client" || isPartnerOnly(user) || isPhotographerOnly(user)) redirect("/admin");

  let clients: { id: number; name: string; devices: number }[] = [];
  const counts = { admins: 0, clients: 0 };
  if (isDbEnabled()) {
    const c = await countPushSubscriptions();
    counts.admins = c.admins;
    counts.clients = c.clients;
    try {
      const sql = getSql();
      const rows = (await sql`SELECT id, name, slug, data FROM clients ORDER BY name ASC`) as unknown as {
        id: number; name: string; slug: string; data?: { archived?: boolean };
      }[];
      clients = rows
        .filter((r) => !r.data?.archived)
        .map((r) => ({ id: r.id, name: r.name || r.slug, devices: c.byClient.get(r.id) || 0 }));
    } catch {
      clients = [];
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notify</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Send a push notification to phones and computers — yours, the studio&apos;s, or a client&apos;s. Works even when the site is closed.
        </p>
      </div>
      <NotifyComposer clients={clients} counts={counts} configured={isPushConfigured()} />
    </div>
  );
}
