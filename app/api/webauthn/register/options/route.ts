import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { getSession } from "@/lib/auth";
import { isDbEnabled } from "@/lib/db";
import {
  RP_NAME,
  rpFromRequest,
  setChallenge,
  ensurePasskeySchema,
  listUserCredentials,
} from "@/lib/webauthn";

export const dynamic = "force-dynamic";

// Mirrors @simplewebauthn's transport union without importing it just for a cast.
type AuthenticatorTransportFuture = "ble" | "cable" | "hybrid" | "internal" | "nfc" | "smart-card" | "usb";

// Step 1 of enrolling a passkey: issue a challenge + parameters for the browser
// to hand to the device's authenticator. Requires an active sign-in.
export async function POST(req: Request) {
  if (!isDbEnabled()) return NextResponse.json({ error: "Passkeys need the database to be configured." }, { status: 503 });
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  await ensurePasskeySchema();
  const { rpID } = rpFromRequest(req);
  const existing = await listUserCredentials(user.id);

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userID: new TextEncoder().encode(String(user.id)),
    userName: user.email,
    userDisplayName: user.name || user.email,
    attestationType: "none",
    // Don't let the same device enrol twice.
    excludeCredentials: existing.map((c) => ({
      id: c.credential_id,
      transports: c.transports ? (c.transports.split(",") as AuthenticatorTransportFuture[]) : undefined,
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  setChallenge(options.challenge);
  return NextResponse.json(options);
}
