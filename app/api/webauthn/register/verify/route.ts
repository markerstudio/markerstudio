import { NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { getSession } from "@/lib/auth";
import { isDbEnabled } from "@/lib/db";
import {
  rpFromRequest,
  readChallenge,
  clearChallenge,
  bytesToB64url,
  insertCredential,
} from "@/lib/webauthn";

export const dynamic = "force-dynamic";

// Step 2 of enrolling a passkey: verify the authenticator's attestation against
// the challenge we issued and, if good, store the credential's public key.
export async function POST(req: Request) {
  if (!isDbEnabled()) return NextResponse.json({ error: "Passkeys need the database to be configured." }, { status: 503 });
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const expectedChallenge = readChallenge();
  if (!expectedChallenge) return NextResponse.json({ error: "Challenge expired — please try again." }, { status: 400 });

  const body = await req.json().catch(() => null);
  const response = body?.response;
  const label = String(body?.label || "").slice(0, 60);
  if (!response) return NextResponse.json({ error: "Missing credential." }, { status: 400 });

  const { rpID, origin } = rpFromRequest(req);

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });
  } catch {
    clearChallenge();
    return NextResponse.json({ error: "Could not verify the passkey." }, { status: 400 });
  }

  clearChallenge();
  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: "Passkey was not verified." }, { status: 400 });
  }

  const cred = verification.registrationInfo.credential;
  await insertCredential({
    userId: user.id,
    credentialId: cred.id,
    publicKey: bytesToB64url(cred.publicKey),
    counter: cred.counter,
    transports: (cred.transports || []).join(","),
    deviceLabel: label || "This device",
  });

  return NextResponse.json({ ok: true });
}
