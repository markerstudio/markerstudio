// Shared browser-side upload helper. Sends a file to our own /api/upload route
// (server-side Blob write) and returns the stored URL. Avoids the @vercel/blob
// client-upload flow, which failed opaquely (retrying a 400 until it looked like
// a hang). Any Blob rejection here comes back as a real, showable message.
export type UploadedFile = { url: string; name: string; contentType: string };

export async function uploadFile(file: File, signal?: AbortSignal): Promise<UploadedFile> {
  const fd = new FormData();
  fd.append("file", file);
  let res: Response;
  try {
    res = await fetch("/api/upload", { method: "POST", body: fd, signal });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw new Error("Upload timed out.");
    throw new Error("Network error — couldn’t reach the server.");
  }
  let json: { url?: string; name?: string; contentType?: string; error?: string } = {};
  try {
    json = await res.json();
  } catch {
    /* non-JSON (e.g. platform 413 page) — fall through to status handling */
  }
  if (!res.ok || !json.url) {
    throw new Error(json.error || (res.status === 413 ? "File too large to upload (max 4 MB)." : `Upload failed (${res.status}).`));
  }
  return { url: json.url, name: json.name || file.name, contentType: json.contentType || file.type || "" };
}
