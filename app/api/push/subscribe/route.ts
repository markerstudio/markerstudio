// Store this device's push subscription against the signed-in account (admins
// and clients alike — the Notify panel targets by role/client).
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { savePushSubscription } from "@/lib/push";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const body = (await req.json()) as {
      subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      ua?: string;
    };
    const sub = body.subscription;
    if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
      return NextResponse.json({ error: "bad subscription" }, { status: 400 });
    }
    const ok = await savePushSubscription({
      userId: user.id ?? null,
      role: user.role,
      clientId: user.clientId ?? null,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      ua: body.ua,
    });
    return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "no database" }, { status: 500 });
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}
