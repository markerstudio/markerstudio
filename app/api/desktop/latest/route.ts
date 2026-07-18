import { NextResponse } from "next/server";

// The desktop app's update feed. The repo is PRIVATE, so the app can't read
// GitHub Releases itself — this route fetches the latest desktop release's
// latest.json (produced by tauri-action when updater signing is on) with a
// server-side token and rewrites the artifact URLs to our download proxy.
//
// Lives at /api/desktop/latest (no extension): a ".json" route segment 404s
// on Vercel's edge before reaching Next, even though it works locally. The
// original /api/desktop/latest.json path — baked into shipped 0.5.0 apps —
// is kept alive by a middleware rewrite onto this route.
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

  // Resolve each platform's artifact to GitHub's short-lived signed storage
  // URL, freshly minted per manifest fetch — the updater then downloads in a
  // single hop with no redirect leg to trip on. Falls back to our download
  // proxy if resolution fails. (The signed URLs expire in minutes; the app
  // re-checks right before installing, so it always downloads a fresh one.)
  const idByName = new Map((release.assets || []).map((a) => [a.name, a.id]));
  const origin = new URL(req.url).origin;
  const resolveDirect = async (id: number): Promise<string | null> => {
    try {
      const res = await fetch(`https://api.github.com/repos/${REPO}/releases/assets/${id}`, {
        headers: { ...gh, Accept: "application/octet-stream" },
        redirect: "manual",
        cache: "no-store",
      });
      const loc = res.headers.get("location");
      return res.status >= 300 && res.status < 400 && loc ? loc : null;
    } catch {
      return null;
    }
  };
  await Promise.all(
    Object.values(manifest.platforms ?? {}).map(async (p) => {
      if (!p.url) return;
      const name = decodeURIComponent(p.url.split("/").pop() || "");
      const id = idByName.get(name);
      if (!id) return;
      p.url = (await resolveDirect(id)) || `${origin}/api/desktop/download/${id}`;
    })
  );

  return NextResponse.json(manifest, { headers: { "cache-control": "no-store" } });
}
