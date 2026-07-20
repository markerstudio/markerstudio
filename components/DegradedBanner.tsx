// Server component: a warm amber strip across the top of the admin and the
// client portal whenever the live database is unreachable, so read-only
// snapshot mode is always announced, never silent. Renders nothing (and costs
// one 1-second ping) when everything is healthy.
import { getSql, isDbEnabled } from "@/lib/db";
import { snapshotStatus } from "@/lib/snapshot";

async function dbAlive(): Promise<boolean> {
  if (!isDbEnabled()) return false;
  try {
    await Promise.race([
      getSql()`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 1500)),
    ]);
    return true;
  } catch {
    return false;
  }
}

export default async function DegradedBanner() {
  if (await dbAlive()) return null;
  const snap = await snapshotStatus();
  const when = snap.at
    ? new Date(snap.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : null;
  return (
    <div
      role="status"
      className="sticky top-0 z-[100] bg-amber-100 border-b border-amber-300 text-amber-900 text-[13px] leading-snug px-4 py-2 text-center"
    >
      ⚠️ The live database is unreachable.{" "}
      {when
        ? `Showing the last saved copy (from ${when}) — browsing works, changes are paused until it's back.`
        : "Some data may be unavailable until it's back."}
    </div>
  );
}
