// Vercel Blob rejects upload pathnames containing spaces and certain characters
// (e.g. "@") with a 400. Sanitise the name we send to Blob — keep the extension,
// replace anything unsafe with "-", collapse repeats — while callers keep the
// ORIGINAL filename for the human-facing document title. addRandomSuffix keeps
// names unique, so flattening them here is safe.
export function safeBlobName(name: string): string {
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 100) || "file";
  return ext ? `${base}.${ext}` : base;
}

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
