import { getSession, canSeePartner, isPartnerOnly, canSeePhotographer, isPhotographerOnly, canSeeDeliverables } from "@/lib/auth";
import { isDbEnabled } from "@/lib/db";
import { countUnreadInquiries } from "@/lib/inquiries";
import { countUnreadApplications } from "@/lib/applications";
import AdminShell from "@/components/admin/AdminShell";
import { ToastProvider } from "@/components/ui/glass";
import { getClients } from "@/lib/clients";
import { logout } from "./actions";

export const metadata = { title: "Marker Admin", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  const restricted = user ? isPartnerOnly(user) || isPhotographerOnly(user) : true;
  const [unread, apps, clientRows] =
    user && isDbEnabled()
      ? await Promise.all([
          countUnreadInquiries(),
          countUnreadApplications(),
          restricted ? Promise.resolve([]) : getClients().catch(() => []),
        ])
      : [0, 0, []];
  // Slim list for the ⌘K palette — names only, no client data leaves the layout.
  const paletteClients = clientRows
    .filter((c) => !c.data?.archived)
    .map((c) => ({ slug: c.slug, name: c.name || c.slug, color: c.color || "#FF9100" }));

  if (!user) {
    // /admin/login redirect page — no chrome.
    return <div dir="ltr" className="lq-app font-sans text-neutral-900">{children}</div>;
  }

  return (
    <div dir="ltr" className="lq-app font-sans text-neutral-900">
      {/* Toasts finally have a mount — useToast() was a silent no-op before. */}
      <ToastProvider>
      <AdminShell
        email={user.email}
        unreadInquiries={unread}
        unreadApplications={apps}
        showPartner={canSeePartner(user)}
        partnerOnly={isPartnerOnly(user)}
        showPhotographer={canSeePhotographer(user)}
        photographerOnly={isPhotographerOnly(user)}
        showDeliverables={canSeeDeliverables(user)}
        paletteClients={paletteClients}
        logout={logout}
      >
        {children}
      </AdminShell>
      </ToastProvider>
    </div>
  );
}
