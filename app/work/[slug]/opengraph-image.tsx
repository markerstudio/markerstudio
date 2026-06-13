import { ImageResponse } from "next/og";
import { getProject } from "@/lib/projects";

export const alt = "Marker Studio® — Case study";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Per-project share card — painted in the project's own brand colour so each
// case study previews distinctly. Falls back to charcoal for unknown slugs.
export default async function Image({ params }: { params: { slug: string } }) {
  const project = await getProject(params.slug);
  const bg = project?.color || "#1A1A1A";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: bg,
          padding: "72px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 28, fontWeight: 700, letterSpacing: "0.04em" }}>
          <div style={{ display: "flex" }}>{project ? project.tag.en : "Work"}</div>
          <div style={{ display: "flex", opacity: 0.85 }}>Case study{project ? ` · ${project.year}` : ""}</div>
        </div>
        <div style={{ fontSize: 104, fontWeight: 800, lineHeight: 1.0, display: "flex" }}>
          {project ? project.name.en : "Marker Studio®"}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 28, fontWeight: 700, letterSpacing: "0.04em" }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, background: "#FF9100", display: "flex" }} />
          MARKER STUDIO®
        </div>
      </div>
    ),
    size
  );
}
