import Link from "next/link";
import { getSession } from "@/lib/auth";
import { logout } from "./actions";

export const metadata = { title: "Marker Admin", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  return (
    <div dir="ltr" className="min-h-screen bg-neutral-100 text-neutral-900 font-sans">
      {user && (
        <header className="bg-white border-b border-neutral-200">
          <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
            <Link href="/admin" className="font-bold tracking-tight text-orange">
              Marker<span className="text-neutral-900"> Admin</span>
            </Link>
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
