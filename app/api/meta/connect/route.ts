import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { metaAppConfigured, oauthDialogUrl, signMetaState } from "@/lib/meta";

// Kicks off "Continue with Facebook" for a client portal: signs the slug into
// the OAuth state and redirects to Meta's login/consent dialog.
export async function GET(req: NextRequest) {
  const base = req.nextUrl.origin;
  const slug = req.nextUrl.searchParams.get("slug") || "";

  if (!(await getSession())) return NextResponse.redirect(new URL("/login", base));
  if (!metaAppConfigured()) return NextResponse.redirect(new URL(`/admin/clients/${slug}/edit?error=meta-app`, base));

  // The redirect URI must exactly match the callback registered in the Meta
  // app. We carry it in the signed state so the callback reuses the same value.
  const redirectUri = process.env.META_REDIRECT_URI || `${base}/api/meta/callback`;
  const state = await signMetaState({ slug, r: redirectUri });
  return NextResponse.redirect(oauthDialogUrl(redirectUri, state));
}
