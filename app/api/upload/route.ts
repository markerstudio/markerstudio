import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

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
        return {
          allowedContentTypes: [
            "image/png",
            "image/jpeg",
            "image/webp",
            "image/svg+xml",
            "image/gif",
            "application/pdf",
          ],
          maximumSizeInBytes: 25 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
      // Nothing to persist here — the caller stores the returned URL itself.
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(json);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
