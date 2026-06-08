import OnboardingForm from "@/components/OnboardingForm";

export const metadata = {
  title: "Start your brand · Marker Studio",
  robots: { index: false, follow: false },
};

export default function OnboardingPage({ searchParams }: { searchParams: { pkg?: string } }) {
  const pkg = Number(searchParams.pkg);
  return (
    <main className="min-h-screen bg-[#F5F2EC] px-4 py-8">
      <div className="mx-auto mb-6 flex max-w-3xl items-center">
        <a href="/" aria-label="Marker Studio">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/logo-primary-transparent.png" alt="Marker Studio" className="h-9 w-auto" />
        </a>
      </div>
      <OnboardingForm pkg={Number.isFinite(pkg) ? pkg : 1} />
    </main>
  );
}
