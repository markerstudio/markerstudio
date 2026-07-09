import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

// Diagnostic for the uploader UI. The Blob client only ever reports a generic
// "Failed to retrieve the client token" when this route refuses a token, so the
// UI calls this to learn the real reason: signed out, or no storage configured
// on THIS deployment (the usual cause — Blob store not connected / not redeployed).
export async function GET(): Promise<NextResponse> {
  const s = await getSession();
  return NextResponse.json({ signedIn: !!s, storage: !!process.env.BLOB_READ_WRITE_TOKEN });
}

// Client-side uploads (logos, document PDFs) go straight to Vercel Blob. The
// browser asks this route for a one-time upload token; we only hand one out to a
// signed-in studio/admin user. Requires BLOB_READ_WRITE_TOKEN in the env.
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const s = await getSession();
        if (!s) throw new Error("Not signed in.");
        // The one env this route needs. Without it every upload 400s with an
        // opaque SDK error — name it plainly so it's obvious what to set.
        if (!process.env.BLOB_READ_WRITE_TOKEN)
          throw new Error("File storage isn’t configured — set BLOB_READ_WRITE_TOKEN in the environment.");
        return {
          // Admin-only, authenticated uploads (logos + client documents). Kept
          // broad on purpose: the Documents tab is meant to hold whatever the
          // studio wants to file — iPhone HEIC photos, Word/Excel, zips — not
          // just PDFs. octet-stream is the fallback for files the browser can't
          // type. (25 MB cap + random suffix still apply.)
          allowedContentTypes: [
            // images (incl. iPhone HEIC/HEIF and modern formats)
            "image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif",
            "image/heic", "image/heif", "image/avif", "image/tiff", "image/bmp",
            // documents
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "text/plain", "text/csv",
            // archives + catch-all for anything the browser reports as unknown
            "application/zip", "application/x-zip-compressed",
            "application/octet-stream",
          ],
          maximumSizeInBytes: 25 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
      // Intentionally NO onUploadCompleted. Defining it (even as a no-op) makes
      // the Blob SDK embed a callback URL in the client token, so every upload
      // then waits for Vercel Blob to call that URL back before it finalizes —
      // and when that callback can't be reached (deployment protection, aliased
      // domains, etc.) the browser upload hangs forever at "0/N". We don't need
      // it: the client gets the blob URL straight from upload() and persists it
      // itself. Leaving it out lets uploads complete the moment the file lands.
    });
    return NextResponse.json(json);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
