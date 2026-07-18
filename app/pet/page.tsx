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
           to sample here (the "backdrop" is the real desktop), and shadows /
           filters on composited layers rasterize against RECTANGULAR layer
           bounds — every one of them can paint a box around the rounded
           shapes. So: ZERO shadows and filters of any kind in this window.
           Depth is painted instead — the blob's gradient shading and the
           .ms-pet__shadow ink-puddle (a radial gradient), plus borders. */
        *, *::before, *::after {
          box-shadow: none !important;
          text-shadow: none !important;
          filter: none !important;
          -webkit-backdrop-filter: none !important;
          backdrop-filter: none !important;
        }
        .lq-chrome {
          background: #FCFAF6 !important;
          border: 1px solid rgba(48, 48, 48, 0.14) !important;
        }
        .lq-input {
          background: #ffffff !important;
          border: 1px solid rgba(48, 48, 48, 0.14) !important;
        }
      `}</style>
      <PetWindow />
    </>
  );
}
