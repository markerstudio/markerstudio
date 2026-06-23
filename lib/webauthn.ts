// Passkeys (WebAuthn) — lets the studio and clients sign in with the device's
// own biometrics (Touch ID / Face ID on a Mac or iPhone, Windows Hello, etc.)
// instead of typing a password. A passkey is a key pair: the private key never
// leaves the device's secure enclave and is unlocked by the biometric; the
// public key lives here in `webauthn_credentials`. Password sign-in still works
// as the fallback, so this is purely additive.
import { getSql, isDbEnabled } from "@/lib/db";
import { cookies } from "next/headers";

export const CHALLENGE_COOKIE = "wa_challenge";
const CHALLENGE_TTL_SECONDS = 300; // 5 minutes to complete a ceremony

export const RP_NAME = "Marker Studio";

export type StoredCredential = {
  id: number;
  user_id: number;
  credential_id: string; // base64url
  public_key: string; // base64url of the COSE public key
  counter: number;
  transports: string; // comma-separated
  device_label: string;
};

// Idempotent migration: the passkey table. Safe to call repeatedly; run from the
// WebAuthn routes so existing installs upgrade on first use.
export async function ensurePasskeySchema(): Promise<void> {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS webauthn_credentials (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      credential_id TEXT UNIQUE NOT NULL,
      public_key TEXT NOT NULL,
      counter BIGINT NOT NULL DEFAULT 0,
      transports TEXT NOT NULL DEFAULT '',
      device_label TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_used_at TIMESTAMPTZ
    )
  `;
}

// The Relying Party ID (the registrable domain) and the expected origin, derived
// from the incoming request so the same code works on localhost and in
// production. Override with WEBAUTHN_RP_ID / WEBAUTHN_ORIGIN if ever needed
// (e.g. behind a proxy that rewrites the host).
export function rpFromRequest(req: Request): { rpID: string; origin: string } {
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  const proto = (req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "")).split(",")[0].trim();
  const rpID = process.env.WEBAUTHN_RP_ID || host.split(":")[0];
  const origin = process.env.WEBAUTHN_ORIGIN || `${proto}://${host}`;
  return { rpID, origin };
}

// Stash the ceremony challenge in a short-lived httpOnly cookie so the verify
// step can confirm the browser is answering the challenge we issued.
export function setChallenge(challenge: string): void {
  cookies().set(CHALLENGE_COOKIE, challenge, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CHALLENGE_TTL_SECONDS,
  });
}

export function readChallenge(): string | null {
  return cookies().get(CHALLENGE_COOKIE)?.value ?? null;
}

export function clearChallenge(): void {
  cookies().delete(CHALLENGE_COOKIE);
}

// base64url <-> bytes helpers for storing/loading the COSE public key.
export function bytesToB64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}
export function b64urlToBytes(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, "base64url"));
}

// All passkeys registered to a user (to list/manage them and to exclude
// already-registered devices when adding a new one).
export async function listUserCredentials(userId: number): Promise<StoredCredential[]> {
  if (!isDbEnabled()) return [];
  try {
    await ensurePasskeySchema();
    return (await getSql()`
      SELECT id, user_id, credential_id, public_key, counter::int AS counter, transports, device_label
      FROM webauthn_credentials WHERE user_id = ${userId} ORDER BY created_at DESC
    `) as unknown as StoredCredential[];
  } catch {
    return [];
  }
}

// Find a single credential by its base64url id (used on sign-in).
export async function findCredential(credentialId: string): Promise<StoredCredential | null> {
  const rows = (await getSql()`
    SELECT id, user_id, credential_id, public_key, counter::int AS counter, transports, device_label
    FROM webauthn_credentials WHERE credential_id = ${credentialId} LIMIT 1
  `) as unknown as StoredCredential[];
  return rows[0] ?? null;
}

export async function insertCredential(args: {
  userId: number;
  credentialId: string;
  publicKey: string;
  counter: number;
  transports: string;
  deviceLabel: string;
}): Promise<void> {
  await getSql()`
    INSERT INTO webauthn_credentials (user_id, credential_id, public_key, counter, transports, device_label)
    VALUES (${args.userId}, ${args.credentialId}, ${args.publicKey}, ${args.counter}, ${args.transports}, ${args.deviceLabel})
    ON CONFLICT (credential_id) DO NOTHING
  `;
}

export async function updateCredentialCounter(credentialId: string, counter: number): Promise<void> {
  await getSql()`
    UPDATE webauthn_credentials SET counter = ${counter}, last_used_at = now() WHERE credential_id = ${credentialId}
  `;
}

export async function deleteCredential(userId: number, id: number): Promise<void> {
  await getSql()`DELETE FROM webauthn_credentials WHERE id = ${id} AND user_id = ${userId}`;
}
