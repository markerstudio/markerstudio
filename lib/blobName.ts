// Vercel Blob rejects upload pathnames with spaces and certain characters
// (e.g. "@") — sanitise the stored name (keep the extension, ASCII-only, unsafe
// chars → "-"). Pure + import-safe on both server and client. Callers keep the
// ORIGINAL filename for the human-facing title; addRandomSuffix keeps uniqueness.
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
