import { getSql, isDbEnabled } from "@/lib/db";
import { getSession, isSuperAdmin, isPartner, isPhotographer, SUPERADMIN_EMAIL } from "@/lib/auth";
import { createUser, deleteUser } from "../actions";
import ConfirmButton from "@/components/admin/ConfirmButton";
import UndoBanner from "@/components/admin/UndoBanner";
import { EmptyState } from "@/components/ui/glass";

export const dynamic = "force-dynamic";

const inputCls = "lq-input w-full";
const labelCls = "block text-[11px] font-display font-bold uppercase tracking-[0.1em] text-charcoal-60 mb-1";

type U = { id: number; email: string; name: string; role: string | null; created_at: string };

const ROLE_CHIP: Record<string, string> = {
  Photographer: "lq-chip--blue",
  Partner: "lq-chip--orange",
};
const roleLabel = (u: U): string =>
  isSuperAdmin(u) ? "Superadmin" : isPartner(u) ? "Partner" : isPhotographer(u) ? "Photographer" : "Admin";

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
      users = (await getSql()`SELECT id, email, name, role, created_at FROM users WHERE role IN ('admin', 'photographer', 'partner') OR role IS NULL ORDER BY created_at ASC`) as unknown as U[];
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
    <div className="space-y-5">
      <header className="lq-rise">
        <p className="text-[11px] font-display font-bold uppercase tracking-[0.14em] text-charcoal-60">The team</p>
        <h1 className="font-display font-extrabold text-[28px] tracking-tight text-ink leading-tight mt-1">Users</h1>
      </header>

      {msg && (
        <p className={`lq-card text-sm px-4 py-3 ${msg.ok ? "text-emerald-700 !border-emerald-300/40" : "text-rose-700 !border-rose-300/40"}`}>
          {msg.text}
        </p>
      )}
      <UndoBanner undo={searchParams.undo} restored={searchParams.restored} undoError={searchParams.undoError} back="/admin/users" />

      <div className="lq-card lq-rise divide-y divide-charcoal/5" style={{ animationDelay: "60ms" }}>
        {users.map((u) => (
          <div key={u.id} className="flex items-center gap-4 px-5 py-3">
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-ink truncate">
                {u.name}
                {isSuperAdmin(u) ? (
                  <span className="lq-chip ms-2 align-middle uppercase !text-[9.5px] !px-2 !py-0.5 !bg-charcoal !text-white">superadmin</span>
                ) : roleLabel(u) !== "Admin" && (
                  <span className={`lq-chip ms-2 align-middle uppercase !text-[9.5px] !px-2 !py-0.5 ${ROLE_CHIP[roleLabel(u)] || ""}`}>{roleLabel(u)}</span>
                )}
                {me?.email === u.email && (
                  <span className="ms-2 text-[10px] font-display font-bold uppercase tracking-wider text-orange">you</span>
                )}
              </div>
              <div className="text-xs text-charcoal-60 truncate">{u.email}</div>
            </div>
            {amSuper && me?.email !== u.email && !isSuperAdmin(u) && (
              <form action={deleteUser}>
                <input type="hidden" name="id" value={u.id} />
                <ConfirmButton
                  message={`Remove ${u.name} (${u.email})? They won't be able to sign in — you'll get a chance to undo right after.`}
                  className="text-sm font-medium text-charcoal-40 hover:text-rose-700"
                >
                  Remove
                </ConfirmButton>
              </form>
            )}
          </div>
        ))}
        {users.length === 0 && (
          <EmptyState icon="👥" title="No users found" />
        )}
      </div>

      {!amSuper && (
        <p className="lq-card text-sm text-charcoal-60 px-4 py-3 max-w-lg">
          Only the superadmin ({SUPERADMIN_EMAIL}) can add or remove users.
        </p>
      )}

      {amSuper && (
      <div className="lq-card lq-rise p-5 max-w-lg" style={{ animationDelay: "120ms" }}>
        <h2 className="font-display font-bold text-[16px] tracking-tight text-ink mb-4">Add a user</h2>
        <form action={createUser} className="space-y-4">
          <div>
            <label className={labelCls}>Name</label>
            <input name="name" className={inputCls} placeholder="Teammate" />
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input name="email" type="email" required autoComplete="off" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Role</label>
            <select name="role" className={inputCls} defaultValue="admin">
              <option value="admin">Admin — full access</option>
              <option value="photographer">Photographer — only the Photography portal</option>
              <option value="partner">Partner (Ramzi) — only their own area</option>
            </select>
            <p className="text-xs text-charcoal-40 mt-1">A <b>Photographer</b> signs in straight to the Photography portal and sees nothing else.</p>
          </div>
          <div>
            <label className={labelCls}>Password</label>
            <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputCls} />
            <p className="text-xs text-charcoal-40 mt-1">At least 8 characters. Share it with them privately.</p>
          </div>
          <button className="lq-btn lq-btn--primary">
            Add user
          </button>
        </form>
      </div>
      )}
    </div>
  );
}
