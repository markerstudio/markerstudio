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
  // Only client accounts are bounced out of /admin. admin / photographer / partner
  // all belong in the admin area (photographer & partner are then confined below).
  if (pathname.startsWith("/admin") && role === "client") {
    const url = req.nextUrl.clone();
    url.pathname = "/portal";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Partner-only accounts (Ramzi) are confined to their own area. Email-based,
  // inlined here to keep middleware edge-safe (mirrors the defaults in lib/auth).
  // They may see only /admin/partner and their own clients (/admin/clients,
  // ownership enforced on the pages); everything else under /admin bounces to
  // their partner page.
  if (pathname.startsWith("/admin")) {
    const email = String(payload.email || "").toLowerCase();
    const superEmail = (process.env.SUPERADMIN_EMAIL || "elias@marker.ps").toLowerCase();
    const partnerEmails = (process.env.PARTNER_EMAILS || "ramzi@marker.ps")
      .toLowerCase()
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const photographerEmails = (process.env.PHOTOGRAPHER_EMAILS || "ameer@marker.ps")
      .toLowerCase()
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    // Role is the primary signal (set on the user when created); the email lists
    // are kept as a fallback so the original env-configured accounts still work.
    const partnerOnly = (role === "partner" || (!!email && partnerEmails.includes(email))) && email !== superEmail;
    // A photographer who isn't also the super admin or a partner is confined to
    // the photographer portal only (mirrors isPhotographerOnly in lib/auth).
    const photographerOnly =
      (role === "photographer" || (!!email && photographerEmails.includes(email))) && email !== superEmail && !partnerOnly;
    if (photographerOnly) {
      if (!pathname.startsWith("/admin/photographer")) {
        const url = req.nextUrl.clone();
        url.pathname = "/admin/photographer";
        url.search = "";
        return NextResponse.redirect(url);
      }
    } else if (partnerOnly) {
      // /admin/partner is their home (lists their clients). Their own client
      // sub-pages (/admin/clients/<slug>/edit, /admin/clients/new) are allowed —
      // ownership is enforced on those pages. They may also record payments
      // (/admin/payments), scoped to their own clients on the page + action. The
      // bare clients LIST is not allowed (it carries Marker-wide stats); it
      // bounces to the partner page.
      const allowed =
        pathname.startsWith("/admin/partner") ||
        pathname.startsWith("/admin/clients/") ||
        pathname.startsWith("/admin/payments");
      if (!allowed) {
        const url = req.nextUrl.clone();
        url.pathname = "/admin/partner";
        url.search = "";
        return NextResponse.redirect(url);
      }
    }
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
