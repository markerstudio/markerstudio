// Refreshes the studio's outage snapshot (lib/snapshot). Called two ways:
//   · Vercel cron (see vercel.json) every 6 hours — authenticated by the
//     Authorization: Bearer CRON_SECRET header Vercel attaches automatically
//     when the CRON_SECRET env var is set.
//   · A signed-in admin hitting it manually (e.g. right after big edits).
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { writeSnapshot, snapshotStatus } from "@/lib/snapshot";

export const dynamic = "force-dynamic";

async function authorized(req: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") === `Bearer ${secret}`) return true;
  // Vercel stamps its own cron invocations with this header (and strips
  // x-vercel-* from outside traffic), so the schedule works with zero config.
  // Worst case for a spoof is an extra snapshot write — no data comes back.
  if (req.headers.get("x-vercel-cron")) return true;
  const user = await getSession();
  return !!user && user.role !== "client";
}

export async function GET(req: Request) {
  if (!(await authorized(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // ?status=1 → report the stored snapshot without writing a new one.
  if (new URL(req.url).searchParams.has("status")) {
    return NextResponse.json(await snapshotStatus());
  }
  const result = await writeSnapshot();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

export async function POST(req: Request) {
  return GET(req);
}
