import CareersForm from "@/components/CareersForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Careers — Marker Studio®", description: "Join Marker Studio — models, designers, content creators, and photographers." };

export default function CareersPage() {
  return (
    <main className="min-h-screen bg-[#F5F2EC] px-4 py-8">
      <div className="mx-auto mb-6 flex max-w-3xl items-center">
        <a href="/" aria-label="Marker Studio">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/logo-primary-transparent.png" alt="Marker Studio" className="h-9 w-auto" />
        </a>
      </div>
      <CareersForm />
    </main>
  );
}
