import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { getSql, isDbEnabled } from "@/lib/db";
import { createSession, type Role } from "@/lib/auth";
import {
  rpFromRequest,
  readChallenge,
  clearChallenge,
  b64urlToBytes,
  findCredential,
  updateCredentialCounter,
} from "@/lib/webauthn";

export const dynamic = "force-dynamic";

type UserRow = { id: number; email: string; name: string; role: Role; client_id: number | null };

// Step 2 of signing in with a passkey: verify the device's assertion against the
// stored public key, then mint the same session a password login would. On
// success we return where to go next; the browser navigates there.
export async function POST(req: Request) {
  if (!isDbEnabled()) return NextResponse.json({ error: "Passkeys need the database to be configured." }, { status: 503 });

  const expectedChallenge = readChallenge();
  if (!expectedChallenge) return NextResponse.json({ error: "Challenge expired — please try again." }, { status: 400 });

  const body = await req.json().catch(() => null);
  const response = body?.response;
  if (!response?.id) {
    clearChallenge();
    return NextResponse.json({ error: "Missing credential." }, { status: 400 });
  }

  const stored = await findCredential(response.id);
  if (!stored) {
    clearChallenge();
    return NextResponse.json({ error: "This passkey isn't recognised — sign in with your password." }, { status: 400 });
  }

  const { rpID, origin } = rpFromRequest(req);

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
      credential: {
        id: stored.credential_id,
        publicKey: b64urlToBytes(stored.public_key),
        counter: stored.counter,
        transports: stored.transports ? (stored.transports.split(",") as ("ble" | "cable" | "hybrid" | "internal" | "nfc" | "smart-card" | "usb")[]) : undefined,
      },
    });
  } catch {
    clearChallenge();
    return NextResponse.json({ error: "Could not verify the passkey." }, { status: 400 });
  }

  clearChallenge();
  if (!verification.verified) return NextResponse.json({ error: "Passkey was not verified." }, { status: 400 });

  await updateCredentialCounter(stored.credential_id, verification.authenticationInfo.newCounter);

  const rows = (await getSql()`
    SELECT id, email, name, role, client_id FROM users WHERE id = ${stored.user_id} LIMIT 1
  `) as unknown as UserRow[];
  const u = rows[0];
  if (!u) return NextResponse.json({ error: "Account not found." }, { status: 400 });

  await createSession({
    id: u.id,
    email: u.email,
    name: u.name,
    role: (u.role as Role) || "admin",
    clientId: u.client_id ?? null,
  });

  return NextResponse.json({ ok: true, redirect: u.role === "client" ? "/portal" : "/admin" });
}
