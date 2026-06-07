import Link from "next/link";
import { isDbEnabled, getSql } from "@/lib/db";
import { setupFirstUser } from "../actions";

export const dynamic = "force-dynamic";

const inputCls =
  "w-full border border-neutral-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange/40 focus:border-orange";

async function alreadySetUp(): Promise<boolean> {
  if (!isDbEnabled()) return false;
  try {
    const rows = (await getSql()`SELECT count(*)::int AS n FROM users`) as unknown as { n: number }[];
    return rows[0].n > 0;
  } catch {
    return false; // tables don't exist yet → not set up
  }
}

const ERRORS: Record<string, string> = {
  nodb: "No database is connected yet. Add a Postgres database in Vercel and redeploy.",
  nosecret: "AUTH_SECRET is missing. Add it in Vercel → Settings → Environment Variables, then redeploy.",
  invalid: "Enter a valid email and a password of at least 8 characters.",
};

export default async function SetupPage({ searchParams }: { searchParams: { error?: string } }) {
  const dbOff = !isDbEnabled();
  const noSecret = !process.env.AUTH_SECRET;
  const done = await alreadySetUp();

  return (
    <div className="max-w-md mx-auto mt-12 bg-white border border-neutral-200 rounded-xl p-8">
      <h1 className="text-xl font-bold mb-1">Set up Marker Admin</h1>
      <p className="text-sm text-neutral-500 mb-6">Create your admin account. This page disables itself afterwards.</p>

      <ol className="text-xs text-neutral-500 space-y-1 mb-6 list-decimal list-inside">
        <li className={dbOff ? "text-red-600 font-semibold" : "text-green-700"}>
          Database connected {dbOff ? "— not detected" : "✓"}
        </li>
        <li className={noSecret ? "text-red-600 font-semibold" : "text-green-700"}>
          AUTH_SECRET set {noSecret ? "— missing" : "✓"}
        </li>
      </ol>

      {searchParams.error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">
          {ERRORS[searchParams.error] || "Something went wrong."}
        </p>
      )}

      {done ? (
        <div className="text-sm">
          <p className="text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2 mb-4">
            Already set up. ✓
          </p>
          <Link href="/admin/login" className="font-semibold text-orange hover:text-orange-deep">Go to login →</Link>
        </div>
      ) : dbOff || noSecret ? (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-3">
          Finish the two steps above (add the database and/or <code>AUTH_SECRET</code> in Vercel and redeploy),
          then refresh this page.
        </p>
      ) : (
        <form action={setupFirstUser} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Your name</label>
            <input name="name" className={inputCls} placeholder="Elias" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Email</label>
            <input name="email" type="email" required autoComplete="email" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Password</label>
            <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputCls} />
            <p className="text-xs text-neutral-400 mt-1">At least 8 characters.</p>
          </div>
          <button className="w-full bg-orange text-white font-semibold rounded-md py-2.5 hover:bg-orange-deep transition-colors">
            Create my account & import projects
          </button>
        </form>
      )}
    </div>
  );
}
