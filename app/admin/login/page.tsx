import { login } from "../actions";

export const dynamic = "force-dynamic";

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div className="max-w-sm mx-auto mt-16 bg-white border border-neutral-200 rounded-xl p-8">
      <h1 className="text-xl font-bold mb-1">Marker Admin</h1>
      <p className="text-sm text-neutral-500 mb-6">Sign in to manage projects.</p>
      {searchParams.error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">
          Invalid email or password.
        </p>
      )}
      <form action={login} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Email</label>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange/40 focus:border-orange"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Password</label>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange/40 focus:border-orange"
          />
        </div>
        <button className="w-full bg-orange text-white font-semibold rounded-md py-2.5 hover:bg-orange-deep transition-colors">
          Sign in
        </button>
      </form>
    </div>
  );
}
