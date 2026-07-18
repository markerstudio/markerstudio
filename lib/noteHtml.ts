// Server-safe note parsing + print HTML. Lives outside the "use client"
// components so the /print/note/[id] route (a server component) can build the
// same document the editor's Export menu writes in the browser. Every piece
// of user text passes through escapeHtml before being wrapped in tags.

export type NoteBlock =
  | { type: "h1"; text: string }
  | { type: "h2"; text: string }
  | { type: "p"; lines: string[] }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "check"; items: { checked: boolean; text: string; line: number }[] };

// Line-oriented parse. `line` on checklist items is the index into
// body.split("\n") so a click can flip exactly that line in the source.
export function parseNoteBlocks(body: string): NoteBlock[] {
  const lines = (body || "").split("\n");
  const blocks: NoteBlock[] = [];
  let broke = true; // a blank line (or the start) breaks list/paragraph grouping
  const last = () => blocks[blocks.length - 1];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) {
      broke = true;
      continue;
    }
    let m: RegExpExecArray | null;
    if ((m = /^# (.*)$/.exec(line))) {
      blocks.push({ type: "h1", text: m[1] });
    } else if ((m = /^## (.*)$/.exec(line))) {
      blocks.push({ type: "h2", text: m[1] });
    } else if ((m = /^- \[( |x|X)\] ?(.*)$/.exec(line))) {
      const item = { checked: m[1].toLowerCase() === "x", text: m[2], line: i };
      const l = last();
      if (!broke && l?.type === "check") l.items.push(item);
      else blocks.push({ type: "check", items: [item] });
    } else if ((m = /^- (.*)$/.exec(line))) {
      const l = last();
      if (!broke && l?.type === "ul") l.items.push(m[1]);
      else blocks.push({ type: "ul", items: [m[1]] });
    } else if ((m = /^\d+\. (.*)$/.exec(line))) {
      const l = last();
      if (!broke && l?.type === "ol") l.items.push(m[1]);
      else blocks.push({ type: "ol", items: [m[1]] });
    } else {
      const l = last();
      if (!broke && l?.type === "p") l.lines.push(line);
      else blocks.push({ type: "p", lines: [line] });
    }
    broke = false;
  }
  return blocks;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Inline markdown → HTML, escaping FIRST so user text can never smuggle
// markup into the print document; only our own <strong>/<em> tags survive.
function inlineHtml(text: string): string {
  return escapeHtml(text).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

// The notes' markdown subset rendered to simple HTML for the print document.
export function noteBodyToHtml(body: string): string {
  return parseNoteBlocks(body)
    .map((b) => {
      if (b.type === "h1") return `<h2>${inlineHtml(b.text)}</h2>`;
      if (b.type === "h2") return `<h3>${inlineHtml(b.text)}</h3>`;
      if (b.type === "ul" || b.type === "ol") {
        const tag = b.type === "ul" ? "ul" : "ol";
        return `<${tag}>${b.items.map((t) => `<li>${inlineHtml(t)}</li>`).join("")}</${tag}>`;
      }
      if (b.type === "check") {
        const items = b.items
          .map(
            (it) =>
              `<li${it.checked ? ' class="done"' : ""}><span class="box${it.checked ? " done" : ""}">${it.checked ? "✓" : ""}</span><span class="txt">${inlineHtml(it.text)}</span></li>`
          )
          .join("");
        return `<ul class="check">${items}</ul>`;
      }
      return `<p>${b.lines.map(inlineHtml).join("<br>")}</p>`;
    })
    .join("\n");
}

// First non-empty line, markdown markers stripped — title fallback.
function firstLine(text: string): string {
  const l = (text || "").split("\n").find((x) => x.trim()) || "";
  return l
    .replace(/^(#{1,2} |- \[[ xX]\] ?|- |\d+\. )/, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .trim();
}

const PRINT_CSS = `
  body{font-family:'Poppins',-apple-system,'Segoe UI',system-ui,sans-serif;color:#232323;background:#fff;max-width:680px;margin:40px auto;padding:0 24px;line-height:1.55;font-size:14px}
  h1{font-size:22px;letter-spacing:-.01em;line-height:1.25;margin:0 0 4px}
  .meta{color:#8a8a8a;font-size:11.5px;margin:0 0 26px}
  h2{font-size:16px;margin:22px 0 6px}
  h3{font-size:14px;margin:18px 0 4px}
  p{margin:0 0 10px}
  ul,ol{margin:0 0 10px;padding-inline-start:22px}
  ul{list-style:disc}
  ol{list-style:decimal}
  li{margin:2px 0}
  ul.check{list-style:none;padding-inline-start:2px}
  ul.check li{display:flex;gap:8px;align-items:flex-start}
  .box{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;flex:none;margin-top:3px;border:1.5px solid #b5b5b5;border-radius:4px;font-size:10px;line-height:1;color:#fff}
  .box.done{background:#F57F00;border-color:#F57F00}
  li.done .txt{color:#8a8a8a;text-decoration:line-through}
  @media print{body{margin:0 auto}}
`;

/** The print document's <body> content — style, heading, note HTML, and the
 *  auto-print trigger (the desktop shell reroutes window.print to the native
 *  print panel, so this same markup drives both browser and DMG paths). */
export function notePrintHtml(note: { title: string; body: string; created_at: string }): {
  title: string;
  html: string;
} {
  const title = note.title.trim() || firstLine(note.body) || "Note";
  const dateLine = new Date(note.created_at).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const html = `<style>${PRINT_CSS}</style>
<h1>${escapeHtml(title)}</h1>
<p class="meta">${escapeHtml(dateLine)} · Marker Studio</p>
${noteBodyToHtml(note.body)}
<script>window.addEventListener('load',function(){setTimeout(function(){window.print()},200)})</script>`;
  return { title, html };
}
