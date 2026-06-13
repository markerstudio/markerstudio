import { NextResponse, type NextRequest } from "next/server";
import { exchangeCodeForToken, longLivedUserToken, signMetaState, verifyMetaState } from "@/lib/meta";

// Meta redirects here after consent. We verify the signed state, exchange the
// code for a long-lived user token, stash it in a short-lived signed httpOnly
// cookie, and send the admin to the page/ad-account picker. The user token
// never reaches client JS.
export async function GET(req: NextRequest) {
  const base = req.nextUrl.origin;
  const sp = req.nextUrl.searchParams;

  const decoded = await verifyMetaState<{ slug: string; r: string }>(sp.get("state") || "");
  if (!decoded?.slug) return NextResponse.redirect(new URL("/admin/clients", base));
  const slug = decoded.slug;
  const edit = (q: string) => NextResponse.redirect(new URL(`/admin/clients/${slug}/edit?${q}`, base));

  if (sp.get("error")) return edit("error=meta-denied");
  const code = sp.get("code");
  if (!code) return edit("error=meta-denied");

  try {
    const shortToken = await exchangeCodeForToken(code, decoded.r);
    const userToken = await longLivedUserToken(shortToken);
    if (!userToken) return edit("error=meta-fetch");

    const cookie = await signMetaState({ slug, ut: userToken }, "15m");
    const res = NextResponse.redirect(new URL(`/admin/clients/${slug}/connect-meta`, base));
    res.cookies.set("meta_oauth", cookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 900,
    });
    return res;
  } catch {
    return edit("error=meta-fetch");
  }
}
