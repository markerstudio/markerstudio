// Session auth: a signed JWT in an httpOnly cookie (jose), passwords hashed via
// bcryptjs. Sessions carry a role (admin vs client) and, for clients, the id of
// the client whose portal they may access.
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "marker_session";

// How long a sign-in lasts before re-authentication is required. Kept generous
// (30 days) so the studio and clients — and the desktop app — stay signed in
// between visits instead of logging in each time. The cookie's max-age and the
// JWT's own expiry are set to the same window so neither expires before the other.
const SESSION_DAYS = 30;
const SESSION_SECONDS = 60 * 60 * 24 * SESSION_DAYS;

// The studio owner's account. It can never be removed, and it's the only one
// allowed to add or remove admin users. Override with SUPERADMIN_EMAIL if the
// address ever changes.
export const SUPERADMIN_EMAIL = (process.env.SUPERADMIN_EMAIL || "elias@marker.ps").toLowerCase();

export function isSuperAdmin(user: { email?: string | null } | null | undefined): boolean {
  return !!user?.email && user.email.toLowerCase() === SUPERADMIN_EMAIL;
}

// Partner accounts (e.g. Ramzi). They — and only they plus the super admin —
// can see the partner's money/clients. Set PARTNER_EMAILS to a comma-separated
// list. Kept email-based (like the super admin) so no schema/role migration is
// needed to stand the partner area up.
export const PARTNER_EMAILS = (process.env.PARTNER_EMAILS || "ramzi@marker.ps")
  .toLowerCase()
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export function isPartner(user: { email?: string | null } | null | undefined): boolean {
  return !!user?.email && PARTNER_EMAILS.includes(user.email.toLowerCase());
}

// Who may see the partner (Ramzi) area: the partner themselves and the super
// admin. Regular admins (e.g. Maram) cannot.
export function canSeePartner(user: { email?: string | null } | null | undefined): boolean {
  return isSuperAdmin(user) || isPartner(user);
}

// A partner who is NOT the super admin (e.g. Ramzi). These accounts are
// confined to their own area — their partner page and their own clients — and
// must never see Marker's dashboard, finance, or other clients. Enforced in
// middleware (route allowlist) plus page-level guards.
export function isPartnerOnly(user: { email?: string | null } | null | undefined): boolean {
  return isPartner(user) && !isSuperAdmin(user);
}

// Photographer accounts (e.g. Ameer Shaheen — the main photographer, but not the
// only one). Set PHOTOGRAPHER_EMAILS to a comma-separated list. Email-based like
// the partner accounts so no schema/role migration is needed to stand the
// photographer portal up. Unlike the partner area, the photographer portal is
// visible to EVERY admin (see canSeePhotographer) — only the photographers
// themselves are confined to it.
export const PHOTOGRAPHER_EMAILS = (process.env.PHOTOGRAPHER_EMAILS || "ameer@marker.ps")
  .toLowerCase()
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export function isPhotographer(user: { email?: string | null } | null | undefined): boolean {
  return !!user?.email && PHOTOGRAPHER_EMAILS.includes(user.email.toLowerCase());
}

// Who may see the photographer area: every admin (Elias, Maram, …) plus the
// photographers. Differs from the partner area on purpose — the studio wants all
// admins to see the shoot schedule. Partner-only accounts (Ramzi) are still
// walled into their own area and don't get it.
export function canSeePhotographer(user: { email?: string | null } | null | undefined): boolean {
  return !isPartnerOnly(user) || isPhotographer(user);
}

// A photographer who is NOT also the super admin / a partner (e.g. Ameer). These
// accounts are confined to the photographer portal only — they never see
// Marker's dashboard, finance, clients, or the partner area. Enforced in
// middleware (route allowlist) plus the page guard.
export function isPhotographerOnly(user: { email?: string | null } | null | undefined): boolean {
  return isPhotographer(user) && !isSuperAdmin(user) && !isPartner(user);
}

export type Role = "admin" | "client";
export type SessionUser = { id: number; email: string; name: string; role: Role; clientId: number | null };

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

export async function createSession(user: SessionUser): Promise<void> {
  const token = await new SignJWT({
    email: user.email,
    name: user.name,
    uid: user.id,
    role: user.role,
    cid: user.clientId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());

  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export function destroySession(): void {
  cookies().delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      id: payload.uid as number,
      email: payload.email as string,
      name: payload.name as string,
      role: (payload.role as Role) || "admin",
      clientId: (payload.cid as number | null) ?? null,
    };
  } catch {
    return null;
  }
}
