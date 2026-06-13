import { SignInPage } from "@/components/ui/sign-in";
import { login } from "@/app/admin/actions";
import { CLIENT_BRANDS } from "@/lib/content";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in — Marker Studio®", robots: { index: false, follow: false } };

export default function LoginPage({ searchParams }: { searchParams: { error?: string; setup?: string; reset?: string } }) {
  return (
    <SignInPage
      action={login}
      error={searchParams.error ? "Invalid email or password." : undefined}
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
