import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { safeBlobName } from "@/lib/blobName";

export const runtime = "nodejs";

// Vercel platform caps a Serverless Function request body at ~4.5 MB. Keep a
// hair under so the check fires before the platform rejects with an opaque 413.
const MAX_BYTES = 4.4 * 1024 * 1024;

// Diagnostic for the uploader UI — reports whether this deployment is signed in
// and has storage configured, so a failure can name the real cause.
export async function GET(): Promise<NextResponse> {
  const s = await getSession();
  return NextResponse.json({ signedIn: !!s, storage: !!process.env.BLOB_READ_WRITE_TOKEN });
}

// Server-side upload. The browser POSTs the file here (multipart form) and we
// write it to Blob with the read-write token. This deliberately avoids the
// @vercel/blob CLIENT upload flow (client token + vercel.com/api/blob endpoint +
// finalize callback), which failed opaquely — retrying a 400 until it looked
// like a hang. Here any Blob rejection comes back as a real message the UI shows.
export async function POST(request: Request): Promise<NextResponse> {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "You’re signed out — sign in again and retry." }, { status: 401 });
  if (!process.env.BLOB_READ_WRITE_TOKEN)
    return NextResponse.json({ error: "File storage isn’t configured — set BLOB_READ_WRITE_TOKEN and redeploy." }, { status: 400 });

  let file: FormDataEntryValue | null;
  try {
    const form = await request.formData();
    file = form.get("file");
  } catch {
    return NextResponse.json({ error: "Couldn’t read the upload." }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "No file received." }, { status: 400 });
  if (file.size > MAX_BYTES)
    return NextResponse.json(
      { error: `“${file.name}” is ${(file.size / 1024 / 1024).toFixed(1)} MB — too large to upload (max 4 MB). Compress it or paste a link instead.` },
      { status: 413 },
    );

  try {
    const blob = await put(safeBlobName(file.name), file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type || undefined,
    });
    return NextResponse.json({ url: blob.url, name: file.name, contentType: file.type || "" });
  } catch (error) {
    // Surface the real Blob error (token, store, quota…) so it's fixable.
    return NextResponse.json({ error: (error as Error).message || "Upload failed." }, { status: 400 });
  }
}
