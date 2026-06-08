import OnboardingForm from "@/components/OnboardingForm";

export const metadata = {
  title: "Start your brand · Marker Studio",
  robots: { index: false, follow: false },
};

export default function OnboardingPage({
  searchParams,
}: {
  searchParams: { branding?: string; marketing?: string; pkg?: string };
}) {
  // `pkg` is the legacy param (branding index); `branding` / `marketing` set
  // which service section opens selected.
  const brandingRaw = searchParams.branding ?? searchParams.pkg;
  const branding = brandingRaw !== undefined ? Number(brandingRaw) : -1;
  const marketing = searchParams.marketing !== undefined ? Number(searchParams.marketing) : -1;

  return (
    <main className="min-h-screen bg-[#F5F2EC] px-4 py-8">
      <div className="mx-auto mb-6 flex max-w-3xl items-center">
        <a href="/" aria-label="Marker Studio">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/logo-primary-transparent.png" alt="Marker Studio" className="h-9 w-auto" />
        </a>
      </div>
      <OnboardingForm
        branding={Number.isFinite(branding) ? branding : -1}
        marketing={Number.isFinite(marketing) ? marketing : -1}
      />
    </main>
  );
}
