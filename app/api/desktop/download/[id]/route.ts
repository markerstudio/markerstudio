import { NextResponse } from "next/server";

// Hands the desktop updater a release artifact from the private repo. GitHub
// answers an authenticated octet-stream request with a redirect to a
// short-lived signed URL — we forward that redirect instead of streaming the
// archive through the function (serverless bodies are size-capped). Assets
// are addressed by numeric id, resolved by /api/desktop/latest.json.

export const dynamic = "force-dynamic";

const REPO = "markerstudio/markerstudio";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const token = process.env.GITHUB_RELEASES_TOKEN;
  if (!token) return NextResponse.json({ error: "updates not configured" }, { status: 404 });
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "bad asset" }, { status: 400 });

  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/assets/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/octet-stream",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    redirect: "manual",
    cache: "no-store",
  });

  const location = res.headers.get("location");
  if (res.status >= 300 && res.status < 400 && location) {
    return NextResponse.redirect(location, 302);
  }
  // Small assets may come back inline instead of redirecting.
  if (res.ok && res.body) {
    return new Response(res.body, {
      headers: { "content-type": "application/octet-stream" },
    });
  }
  return NextResponse.json({ error: "asset fetch failed" }, { status: 502 });
}
