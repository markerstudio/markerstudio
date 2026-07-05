import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { removePushSubscription } from "@/lib/push";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const { endpoint } = (await req.json()) as { endpoint?: string };
    if (endpoint) await removePushSubscription(endpoint);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}
