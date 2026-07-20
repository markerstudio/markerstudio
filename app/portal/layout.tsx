import DegradedBanner from "@/components/DegradedBanner";

// Portal-wide wrapper: its only job is announcing read-only snapshot mode
// (amber strip) whenever the live database is down, so clients see "showing
// the last saved copy" instead of a broken portal.
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DegradedBanner />
      {children}
    </>
  );
}
