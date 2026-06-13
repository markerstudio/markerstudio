import type { MetadataRoute } from "next";

// Allow crawling of the public marketing site; keep the admin and private
// client portals out of the index.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/portal", "/login", "/onboarding", "/invite", "/consent"],
    },
    sitemap: "https://marker.ps/sitemap.xml",
    host: "https://marker.ps",
  };
}
