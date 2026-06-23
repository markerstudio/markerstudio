import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { isDbEnabled } from "@/lib/db";
import { rpFromRequest, setChallenge, ensurePasskeySchema } from "@/lib/webauthn";

export const dynamic = "force-dynamic";

// Step 1 of signing in with a passkey: issue a challenge. We use discoverable
// credentials (empty allowCredentials), so the device offers whichever Marker
// Studio passkey it holds — no need to type an email first.
export async function POST(req: Request) {
  if (!isDbEnabled()) return NextResponse.json({ error: "Passkeys need the database to be configured." }, { status: 503 });
  await ensurePasskeySchema();
  const { rpID } = rpFromRequest(req);

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
    allowCredentials: [],
  });

  setChallenge(options.challenge);
  return NextResponse.json(options);
}
