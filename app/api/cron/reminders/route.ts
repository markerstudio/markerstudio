// Scheduled reminder push — hit by Vercel Cron (see vercel.json). Rebuilds the
// studio feed and pushes anything new to admin devices, so a due task reaches
// you even with the site closed. Guarded by CRON_SECRET: Vercel sends it as a
// Bearer token; you can also pass ?key= for a manual run. With no secret set it
// is open in dev and refused in production.
import { NextResponse } from "next/server";
import { runReminders } from "@/lib/reminders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = req.headers.get("authorization") || "";
  if (auth === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get("key") === secret;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await runReminders();
    return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
