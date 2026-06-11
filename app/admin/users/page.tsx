import { getSql, isDbEnabled } from "@/lib/db";
import { getSession, isSuperAdmin, SUPERADMIN_EMAIL } from "@/lib/auth";
import { createUser, deleteUser } from "../actions";
import ConfirmButton from "@/components/admin/ConfirmButton";
import UndoBanner from "@/components/admin/UndoBanner";

export const dynamic = "force-dynamic";

const inputCls =
  "w-full border border-neutral-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange/40 focus:border-orange";

type U = { id: number; email: string; name: string; created_at: string };

const MESSAGES: Record<string, { text: string; ok?: boolean }> = {
  invalid: { text: "Enter a valid email and a password of at least 8 characters." },
  exists: { text: "A user with that email already exists." },
  last: { text: "You can't remove the last remaining admin." },
  superadmin: { text: "Only the superadmin can add or remove users." },
  protected: { text: "The superadmin account can't be removed." },
  added: { text: "User added.", ok: true },
  removed: { text: "User removed.", ok: true },
};

export default async function UsersPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string; undo?: string; restored?: string; undoError?: string };
}) {
  const me = await getSession();
  const amSuper = isSuperAdmin(me);
  let users: U[] = [];
  if (isDbEnabled()) {
    try {
      users = (await getSql()`SELECT id, email, name, created_at FROM users WHERE role = 'admin' OR role IS NULL ORDER BY created_at ASC`) as unknown as U[];
    } catch {
      users = [];
    }
  }

  const msg = searchParams.error
    ? MESSAGES[searchParams.error]
    : searchParams.ok
    ? MESSAGES[searchParams.ok]
    : null;

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-6">Users</h1>

      {msg && (
        <p
          className={`text-sm rounded-md px-4 py-2.5 mb-6 border ${
            msg.ok ? "text-green-700 bg-green-50 border-green-200" : "text-red-600 bg-red-50 border-red-200"
          }`}
        >
          {msg.text}
        </p>
      )}
      <UndoBanner undo={searchParams.undo} restored={searchParams.restored} undoError={searchParams.undoError} back="/admin/users" />

      <div className="bg-white border border-neutral-200 rounded-xl divide-y divide-neutral-100 mb-8">
        {users.map((u) => (
          <div key={u.id} className="flex items-center gap-4 px-4 py-3">
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">
                {u.name}
                {isSuperAdmin(u) && (
                  <span className="ml-2 align-middle text-[10px] font-bold uppercase tracking-wider bg-charcoal text-white rounded-full px-2 py-0.5">superadmin</span>
                )}
                {me?.email === u.email && (
                  <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-orange">you</span>
                )}
              </div>
              <div className="text-xs text-neutral-500 truncate">{u.email}</div>
            </div>
            {amSuper && me?.email !== u.email && !isSuperAdmin(u) && (
              <form action={deleteUser}>
                <input type="hidden" name="id" value={u.id} />
                <ConfirmButton
                  message={`Remove ${u.name} (${u.email})? They won't be able to sign in — you'll get a chance to undo right after.`}
                  className="text-sm font-medium text-neutral-400 hover:text-red-600"
                >
                  Remove
                </ConfirmButton>
              </form>
            )}
          </div>
        ))}
        {users.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-neutral-500">No users found.</div>
        )}
      </div>

      {!amSuper && (
        <p className="text-sm text-neutral-500 bg-white border border-neutral-200 rounded-xl px-4 py-3 max-w-lg">
          Only the superadmin ({SUPERADMIN_EMAIL}) can add or remove users.
        </p>
      )}

      {amSuper && (
      <div className="bg-white border border-neutral-200 rounded-xl p-6 max-w-lg">
        <h2 className="font-bold mb-4">Add a user</h2>
        <form action={createUser} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Name</label>
            <input name="name" className={inputCls} placeholder="Teammate" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Email</label>
            <input name="email" type="email" required autoComplete="off" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Password</label>
            <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputCls} />
            <p className="text-xs text-neutral-400 mt-1">At least 8 characters. Share it with them privately.</p>
          </div>
          <button className="bg-orange text-white font-semibold rounded-md px-5 py-2.5 text-sm hover:bg-orange-deep transition-colors">
            Add user
          </button>
        </form>
      </div>
      )}
    </div>
  );
}
