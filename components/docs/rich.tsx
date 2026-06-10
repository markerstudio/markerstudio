// Tiny rich-text renderer for document copy.
// `**text**` → <strong>, `*text*` → <em> (accent colour), newline → <br>.
import React from "react";

export function rich(text: string): React.ReactNode {
  const out: React.ReactNode[] = [];
  let key = 0;
  for (const line of (text || "").split("\n")) {
    if (key > 0) out.push(<br key={`br-${key++}`} />);
    // tokenize: **bold** first, then *accent*
    const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
    for (const p of parts) {
      if (!p) continue;
      if (p.startsWith("**") && p.endsWith("**")) out.push(<strong key={key++}>{p.slice(2, -2)}</strong>);
      else if (p.startsWith("*") && p.endsWith("*")) out.push(<em key={key++}>{p.slice(1, -1)}</em>);
      else out.push(<React.Fragment key={key++}>{p}</React.Fragment>);
    }
  }
  return out;
}
