import Link from "next/link";
import { getSession } from "@/lib/auth";
import { isDbEnabled } from "@/lib/db";
import { countUnreadInquiries } from "@/lib/inquiries";
import { logout } from "./actions";

export const metadata = { title: "Marker Admin", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  const unread = user && isDbEnabled() ? await countUnreadInquiries() : 0;
  return (
    <div dir="ltr" className="min-h-screen bg-neutral-100 text-neutral-900 font-sans">
      {user && (
        <header className="bg-white border-b border-neutral-200">
          <div className="max-w-5xl mx-auto px-5 py-2 min-h-14 flex items-center justify-between gap-x-4 gap-y-1 flex-wrap">
          <div className="flex items-center gap-5">
            <Link href="/admin" className="font-bold tracking-tight text-orange">
              Marker<span className="text-neutral-900"> Admin</span>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/admin" className="text-neutral-600 hover:text-neutral-900">Projects</Link>
              <Link href="/admin/clients" className="text-neutral-600 hover:text-neutral-900">Clients</Link>
              <Link href="/admin/inquiries" className="text-neutral-600 hover:text-neutral-900 inline-flex items-center gap-1.5">
                Inquiries
                {unread > 0 && (
                  <span className="text-[10px] font-semibold bg-orange text-white rounded-full px-1.5 py-0.5 leading-none">{unread}</span>
                )}
              </Link>
              <Link href="/admin/users" className="text-neutral-600 hover:text-neutral-900">Users</Link>
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm">
              <Link href="/" className="text-neutral-500 hover:text-neutral-900" target="_blank">
                View site ↗
              </Link>
              <span className="text-neutral-400">{user.email}</span>
              <form action={logout}>
                <button className="text-neutral-700 hover:text-orange font-medium">Sign out</button>
              </form>
            </div>
          </div>
        </header>
      )}
      <main className="max-w-5xl mx-auto px-5 py-8">{children}</main>
    </div>
  );
}
