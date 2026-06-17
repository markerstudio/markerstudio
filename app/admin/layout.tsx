import Link from "next/link";
import { getSession, canSeePartner } from "@/lib/auth";
import { isDbEnabled } from "@/lib/db";
import { countUnreadInquiries } from "@/lib/inquiries";
import { countUnreadApplications } from "@/lib/applications";
import AdminNav from "@/components/admin/AdminNav";
import { logout } from "./actions";

export const metadata = { title: "Marker Admin", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  const [unread, apps] =
    user && isDbEnabled() ? await Promise.all([countUnreadInquiries(), countUnreadApplications()]) : [0, 0];
  return (
    <div dir="ltr" className="min-h-screen bg-neutral-100 text-neutral-900 font-sans">
      {user && (
        <header className="bg-white border-b border-neutral-200 sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-5">
            <div className="h-12 flex items-center justify-between gap-4">
              <Link href="/admin" className="font-bold tracking-tight text-orange shrink-0">
                Marker<span className="text-neutral-900"> Admin</span>
              </Link>
              <div className="flex items-center gap-4 text-sm min-w-0">
                <Link href="/" className="text-neutral-500 hover:text-neutral-900 whitespace-nowrap" target="_blank">
                  View site ↗
                </Link>
                <span className="text-neutral-400 truncate hidden sm:inline">{user.email}</span>
                <form action={logout}>
                  <button className="text-neutral-700 hover:text-orange font-medium whitespace-nowrap">Sign out</button>
                </form>
              </div>
            </div>
            <div className="pb-2">
              <AdminNav unreadInquiries={unread} unreadApplications={apps} showPartner={canSeePartner(user)} />
            </div>
          </div>
        </header>
      )}
      <main className="max-w-6xl mx-auto px-5 py-8">{children}</main>
    </div>
  );
}
