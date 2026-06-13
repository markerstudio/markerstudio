import { ImageResponse } from "next/og";

export const alt = "Marker Studio® — Creative & Marketing Studio";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Branded share card for the site root — charcoal field, marker-orange accent.
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#1A1A1A",
          padding: "72px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "18px", fontSize: 30, fontWeight: 700, letterSpacing: "0.04em" }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: "#FF9100", display: "flex" }} />
          MARKER STUDIO®
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 92, fontWeight: 800, lineHeight: 1.02, display: "flex" }}>
            We mark the brands
          </div>
          <div style={{ fontSize: 92, fontWeight: 800, lineHeight: 1.02, display: "flex" }}>
            that&nbsp;<span style={{ color: "#FF9100" }}>matter.</span>
          </div>
        </div>
        <div style={{ fontSize: 30, color: "rgba(255,255,255,0.7)", display: "flex" }}>
          Branding · Social · Campaigns — Beit Sahour, Palestine
        </div>
      </div>
    ),
    size
  );
}
