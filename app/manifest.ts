import type { MetadataRoute } from "next";

// Web App Manifest — lets the portal install to the home screen (iPhone "Add to
// Home Screen", Android/desktop Chrome) as a standalone, full-screen app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Marker Studio",
    short_name: "Marker",
    description: "Marker Studio — studio admin & client portal.",
    start_url: "/login",
    scope: "/",
    display: "standalone",
    background_color: "#303030",
    theme_color: "#FF9100",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
