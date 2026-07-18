import { NextResponse } from "next/server";

// The desktop app's update feed. The repo is PRIVATE, so the app can't read
// GitHub Releases itself — this route fetches the latest desktop release's
// latest.json (produced by tauri-action when updater signing is on) with a
// server-side token and rewrites the artifact URLs to our download proxy.
//
// Intentionally unauthenticated: the Tauri updater calls it with no session
// cookie. It exposes only version numbers and app binaries — never data.
// Returns 404 while GITHUB_RELEASES_TOKEN is unset, which the app treats as
// "no updates available".

export const dynamic = "force-dynamic";

const REPO = "markerstudio/markerstudio";

type GhAsset = { id: number; name: string; url: string };
type GhRelease = { tag_name?: string; draft?: boolean; prerelease?: boolean; assets?: GhAsset[] };

export async function GET(req: Request) {
  const token = process.env.GITHUB_RELEASES_TOKEN;
  if (!token) return NextResponse.json({ error: "updates not configured" }, { status: 404 });
  const gh = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=20`, {
    headers: gh,
    next: { revalidate: 300 },
  });
  if (!res.ok) return NextResponse.json({ error: "release lookup failed" }, { status: 502 });
  const releases = (await res.json()) as GhRelease[];
  const release = releases.find(
    (r) => !r.draft && !r.prerelease && (r.tag_name || "").startsWith("desktop-v")
  );
  const manifestAsset = release?.assets?.find((a) => a.name === "latest.json");
  if (!release || !manifestAsset) {
    return NextResponse.json({ error: "no updater release yet" }, { status: 404 });
  }

  const mRes = await fetch(manifestAsset.url, {
    headers: { ...gh, Accept: "application/octet-stream" },
    next: { revalidate: 300 },
  });
  if (!mRes.ok) return NextResponse.json({ error: "manifest fetch failed" }, { status: 502 });
  const manifest = (await mRes.json()) as {
    platforms?: Record<string, { url?: string; signature?: string }>;
  };

  // Point each platform at our proxy — the GitHub asset URLs need auth.
  const idByName = new Map((release.assets || []).map((a) => [a.name, a.id]));
  const origin = new URL(req.url).origin;
  for (const p of Object.values(manifest.platforms ?? {})) {
    if (!p.url) continue;
    const name = decodeURIComponent(p.url.split("/").pop() || "");
    const id = idByName.get(name);
    if (id) p.url = `${origin}/api/desktop/download/${id}`;
  }

  return NextResponse.json(manifest);
}
