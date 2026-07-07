import Link from "next/link";
import { isDbEnabled, getSql } from "@/lib/db";
import { setupFirstUser } from "../actions";

export const dynamic = "force-dynamic";

const labelCls =
  "block text-[11px] font-display font-bold uppercase tracking-[0.1em] text-charcoal-60 mb-1";

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
    <div className="max-w-md mx-auto mt-10 space-y-5">
      <header className="lq-rise">
        <p className="text-[11px] font-display font-bold uppercase tracking-[0.14em] text-charcoal-60">First run</p>
        <h1 className="font-display font-extrabold text-[28px] tracking-tight text-ink leading-tight mt-1">Set up Marker Admin</h1>
        <p className="text-sm text-charcoal-60 mt-1">Create your admin account. This page disables itself afterwards.</p>
      </header>

      <div className="lq-card lq-rise p-6" style={{ animationDelay: "80ms" }}>
        <ol className="text-xs space-y-1 mb-6 list-decimal list-inside">
          <li className={dbOff ? "text-rose-700 font-semibold" : "text-emerald-700"}>
            Database connected {dbOff ? "— not detected" : "✓"}
          </li>
          <li className={noSecret ? "text-rose-700 font-semibold" : "text-emerald-700"}>
            AUTH_SECRET set {noSecret ? "— missing" : "✓"}
          </li>
        </ol>

        {searchParams.error && (
          <p className="text-sm text-rose-700 bg-rose-500/10 border border-rose-300/40 rounded-2xl px-3 py-2 mb-4">
            {ERRORS[searchParams.error] || "Something went wrong."}
          </p>
        )}

        {done ? (
          <div className="text-sm">
            <p className="text-emerald-700 bg-emerald-500/10 border border-emerald-300/40 rounded-2xl px-3 py-2 mb-4">
              Already set up. ✓
            </p>
            <Link href="/login" className="font-semibold text-orange-deep hover:text-orange no-underline">Go to login →</Link>
          </div>
        ) : dbOff || noSecret ? (
          <p className="text-sm text-amber-800 bg-amber-400/10 border border-amber-300/40 rounded-2xl px-3 py-3">
            Finish the two steps above (add the database and/or <code>AUTH_SECRET</code> in Vercel and redeploy),
            then refresh this page.
          </p>
        ) : (
          <form action={setupFirstUser} className="space-y-4">
            <div>
              <label className={labelCls}>Your name</label>
              <input name="name" className="lq-input w-full" placeholder="Elias" />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input name="email" type="email" required autoComplete="email" className="lq-input w-full" />
            </div>
            <div>
              <label className={labelCls}>Password</label>
              <input name="password" type="password" required minLength={8} autoComplete="new-password" className="lq-input w-full" />
              <p className="text-xs text-charcoal-40 mt-1">At least 8 characters.</p>
            </div>
            <button className="lq-btn lq-btn--primary w-full">
              Create my account &amp; import projects
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
