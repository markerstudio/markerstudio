import { redirect } from "next/navigation";
import { SignInPage } from "@/components/ui/sign-in";
import { login } from "@/app/admin/actions";
import { getSession } from "@/lib/auth";
import { CLIENT_BRANDS } from "@/lib/content";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in — Marker Studio®", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: { error?: string; setup?: string; reset?: string } }) {
  // Already signed in → straight to the right home. Crucial for the desktop
  // app, which always opens at /login: without this, a perfectly valid 30-day
  // session still greeted you with the login form on every launch — the
  // "app never remembers me" bug.
  const user = await getSession();
  if (user && !searchParams.error) {
    redirect(user.role === "client" ? "/portal" : "/admin");
  }
  // Named failure modes so an outage never masquerades as a wrong password
  // (see the login action: error=db / error=config come from caught
  // infrastructure failures; anything else is a bad credential).
  const errorMessage = !searchParams.error
    ? undefined
    : searchParams.error === "db"
      ? "We can't reach the studio database right now — this is an outage, not a wrong password. Status: /api/health"
      : searchParams.error === "config"
        ? "The server is missing its session configuration (AUTH_SECRET). Status: /api/health"
        : "Invalid email or password.";
  return (
    <SignInPage
      action={login}
      error={errorMessage}
      notice={
        searchParams.reset
          ? "Password updated — sign in with your new password."
          : searchParams.setup
          ? "Account created — sign in below."
          : undefined
      }
      heroLogos={CLIENT_BRANDS}
    />
  );
}
