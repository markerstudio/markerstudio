import { getSession, canSeePartner, isPartnerOnly, canSeePhotographer, isPhotographerOnly, canSeeDeliverables } from "@/lib/auth";
import { isDbEnabled } from "@/lib/db";
import { countUnreadInquiries } from "@/lib/inquiries";
import { countUnreadApplications } from "@/lib/applications";
import AdminShell from "@/components/admin/AdminShell";
import { logout } from "./actions";

export const metadata = { title: "Marker Admin", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  const [unread, apps] =
    user && isDbEnabled() ? await Promise.all([countUnreadInquiries(), countUnreadApplications()]) : [0, 0];

  if (!user) {
    // /admin/login redirect page — no chrome.
    return <div dir="ltr" className="lq-app font-sans text-neutral-900">{children}</div>;
  }

  return (
    <div dir="ltr" className="lq-app font-sans text-neutral-900">
      <AdminShell
        email={user.email}
        unreadInquiries={unread}
        unreadApplications={apps}
        showPartner={canSeePartner(user)}
        partnerOnly={isPartnerOnly(user)}
        showPhotographer={canSeePhotographer(user)}
        photographerOnly={isPhotographerOnly(user)}
        showDeliverables={canSeeDeliverables(user)}
        logout={logout}
      >
        {children}
      </AdminShell>
    </div>
  );
}
