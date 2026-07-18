import { redirect } from "next/navigation";
import { getSession, isPartnerOnly, isPhotographerOnly } from "@/lib/auth";
import PetWindow from "@/components/admin/PetWindow";

// The desktop pet window's page: chromeless and TRANSPARENT — the DMG loads
// it in a frameless always-on-top window, so the page background must let the
// desktop show through (macOSPrivateApi transparency). Session-guarded like
// the admin; signing in happens in the main window (cookies are shared).
export const dynamic = "force-dynamic";
export const metadata = { title: "Marky", robots: { index: false, follow: false } };

export default async function PetPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (isPartnerOnly(user) || isPhotographerOnly(user)) redirect("/admin");

  return (
    <>
      <style>{`
        html, body { background: transparent !important; }
        /* Transparent-window compositing: backdrop-filter has no page backdrop
           to sample here (the "backdrop" is the real desktop) and layer
           filters rasterize as rectangles — both paint boxes. Solid panel +
           box-shadows on the rounded elements themselves instead. */
        .lq-chrome {
          -webkit-backdrop-filter: none !important;
          backdrop-filter: none !important;
          background: #FCFAF6 !important;
          box-shadow: 0 18px 44px -18px rgba(48, 48, 48, 0.5) !important;
        }
        .ms-pet { filter: none !important; }
        .ms-pet__body {
          box-shadow: inset 0 2px 0 rgba(255, 255, 255, 0.55),
            inset 0 -3px 6px rgba(48, 48, 48, 0.12),
            0 10px 22px -6px rgba(245, 127, 0, 0.55) !important;
        }
      `}</style>
      <PetWindow />
    </>
  );
}
