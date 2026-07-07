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
      <header className="lq-rise">
        <p className="text-[11px] font-display font-bold uppercase tracking-[0.14em] text-charcoal-60">Push notifications</p>
        <h1 className="font-display font-extrabold text-[28px] tracking-tight text-ink leading-tight mt-1">Notify</h1>
        <p className="text-sm text-charcoal-60 mt-1.5">
          Send a push notification to phones and computers — yours, the studio&apos;s, or a client&apos;s. Works even when the site is closed.
        </p>
      </header>
      <NotifyComposer clients={clients} counts={counts} configured={isPushConfigured()} />
    </div>
  );
}
