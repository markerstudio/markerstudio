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
      <style>{`html, body { background: transparent !important; }`}</style>
      <PetWindow />
    </>
  );
}
