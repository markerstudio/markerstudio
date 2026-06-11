import { getConsentFormByToken } from "@/lib/consents";
import ConsentSign from "@/components/ConsentSign";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Consent form — Marker Studio®",
  robots: { index: false, follow: false },
};

// Public signing page. Anyone with the link can sign — pass the iPad around
// at a shoot or send the link to a client. Signed records are only visible
// in the admin.
export default async function ConsentPage({ params }: { params: { token: string } }) {
  const form = await getConsentFormByToken(params.token);

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-paper text-ink font-display p-4 sm:p-6">
      {form ? (
        <ConsentSign token={form.token} defaultLang={form.lang === "ar" ? "ar" : "en"} />
      ) : (
        <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/logo-primary-transparent.png" alt="Marker Studio" className="mb-6 h-8 w-auto" />
          <h1 className="mb-2 text-xl font-bold">Form unavailable</h1>
          <p className="text-sm text-neutral-500">
            This consent link is invalid or has been removed. Ask Marker Studio for a new one.
          </p>
        </div>
      )}
    </div>
  );
}
