// Turn the Blob client's opaque "Failed to retrieve the client token" into a
// message that names the real cause. The token route (GET /api/upload) reports
// whether this deployment is signed in and has storage configured; we map that
// to plain guidance. Falls back to the raw error when the probe can't run.
export async function diagnoseUploadError(fallback: string): Promise<string> {
  try {
    const r = await fetch("/api/upload", { method: "GET", cache: "no-store" });
    if (r.ok) {
      const j = (await r.json()) as { signedIn?: boolean; storage?: boolean };
      if (j.storage === false)
        return "File storage isn’t connected to this deployment — add a Vercel Blob store (BLOB_READ_WRITE_TOKEN) and redeploy this deployment.";
      if (j.signedIn === false)
        return "You’re signed out on this deployment — sign in again, then retry.";
    }
  } catch {
    /* network / probe failed — use the raw error */
  }
  return fallback;
}
