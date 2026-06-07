import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify, type JWTPayload } from "jose";
import { SESSION_COOKIE } from "@/lib/auth";

// Guards /admin (admins only) and /portal (any signed-in user). Runs on the
// edge, so it only verifies the JWT — no DB or bcrypt here. Login lives at the
// public /login route.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // /admin/setup is the first-run onboarding page — allow it through.
  if (pathname.startsWith("/admin/setup")) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const payload = token ? await verify(token) : null;

  const toLogin = () => {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  };

  if (!payload) return toLogin();

  // Admin area requires the admin role; clients get bounced to their portal.
  // Older sessions (issued before roles existed) have no role claim — treat
  // those as admin so existing logins don't get locked out.
  const role = (payload.role as string | undefined) ?? "admin";
  if (pathname.startsWith("/admin") && role !== "admin") {
    const url = req.nextUrl.clone();
    url.pathname = "/portal";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

async function verify(token: string): Promise<JWTPayload | null> {
  const s = process.env.AUTH_SECRET;
  if (!s) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(s));
    return payload;
  } catch {
    return null;
  }
}

export const config = { matcher: ["/admin/:path*", "/portal/:path*"] };
