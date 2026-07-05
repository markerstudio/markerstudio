// Public VAPID key for browser push subscription. 404 when push isn't
// configured so clients can show the right hint.
import { NextResponse } from "next/server";
import { getVapidPublicKey } from "@/lib/push";

export const dynamic = "force-dynamic";

export async function GET() {
  const key = getVapidPublicKey();
  if (!key) return NextResponse.json({ error: "push not configured" }, { status: 404 });
  return NextResponse.json({ key });
}
