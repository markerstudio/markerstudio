// Session auth: a signed JWT in an httpOnly cookie (jose), passwords hashed via
// bcryptjs. Sessions carry a role (admin vs client) and, for clients, the id of
// the client whose portal they may access.
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "marker_session";

// The studio owner's account. It can never be removed, and it's the only one
// allowed to add or remove admin users. Override with SUPERADMIN_EMAIL if the
// address ever changes.
export const SUPERADMIN_EMAIL = (process.env.SUPERADMIN_EMAIL || "elias@marker.ps").toLowerCase();

export function isSuperAdmin(user: { email?: string | null } | null | undefined): boolean {
  return !!user?.email && user.email.toLowerCase() === SUPERADMIN_EMAIL;
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
    .setExpirationTime("7d")
    .sign(secret());

  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
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
