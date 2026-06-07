import { SignInPage } from "@/components/ui/sign-in";
import { login } from "@/app/admin/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in — Marker Studio®", robots: { index: false, follow: false } };

export default function LoginPage({ searchParams }: { searchParams: { error?: string; setup?: string } }) {
  return (
    <SignInPage
      action={login}
      error={searchParams.error ? "Invalid email or password." : undefined}
      notice={searchParams.setup ? "Account created — sign in below." : undefined}
      heroImageSrc="https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=2160&q=80"
    />
  );
}
