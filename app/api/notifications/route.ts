// Polled by the notification bell in the admin header (and by the desktop app
// through the same page). Session-gated; returns the role-aware feed.
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getNotices } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSession();
  if (!user || user.role === "client") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const { notices, badge } = await getNotices(user);
    return NextResponse.json({ notices, badge, at: new Date().toISOString() });
  } catch {
    return NextResponse.json({ notices: [], badge: 0, at: new Date().toISOString() });
  }
}
