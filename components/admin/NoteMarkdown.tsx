"use client";

/* NoteMarkdown — a tiny, safe renderer for the notes' markdown subset:
   `# ` / `## ` headings, **bold**, *italic*, `- ` bullets, `1. ` numbered
   lists, `- [ ]` / `- [x]` checklists, blank-line paragraphs. It builds
   React nodes directly (never dangerouslySetInnerHTML of user text), and
   also exports a fully-escaped md→HTML path for the print/PDF export. */

import type { ReactNode } from "react";
import { Check } from "lucide-react";

/* ------------------------------------------------------------- parsing */

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

/* -------------------------------------------------------------- inline */

const INLINE_RE = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;

function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let idx = 0;
  let k = 0;
  INLINE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = INLINE_RE.exec(text))) {
    if (m.index > idx) out.push(text.slice(idx, m.index));
    if (m[1] != null) {
      out.push(
        <strong key={k++} className="font-semibold text-ink">
          {m[1]}
        </strong>
      );
    } else {
      out.push(<em key={k++}>{m[2]}</em>);
    }
    idx = m.index + m[0].length;
  }
  if (idx < text.length) out.push(text.slice(idx));
  return out;
}

/* ---------------------------------------------------------- checkboxes */

function GlassCheck({
  checked,
  small,
  onToggle,
}: {
  checked: boolean;
  small: boolean;
  onToggle?: () => void;
}) {
  const box = `${small ? "w-3.5 h-3.5 rounded-[5px] mt-[3px]" : "w-[18px] h-[18px] rounded-md mt-[2px]"} shrink-0 flex items-center justify-center border transition-colors ${
    checked
      ? "bg-gradient-to-br from-[#FFA226] to-[#F57F00] border-transparent text-white shadow-[inset_0_1px_0_rgba(255,255,255,.45)]"
      : "bg-white/70 border-charcoal/20 text-transparent shadow-[inset_0_1px_2px_rgba(48,48,48,.08)]"
  }`;
  const mark = checked ? <Check className={small ? "w-2.5 h-2.5" : "w-3 h-3"} strokeWidth={3.2} /> : null;
  if (!onToggle) {
    return (
      <span aria-hidden className={box}>
        {mark}
      </span>
    );
  }
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={checked ? "Mark as not done" : "Mark as done"}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`lq-press ${box}`}
    >
      {mark}
    </button>
  );
}

/* ------------------------------------------------------------ renderer */

// In clamp mode the wall card shows roughly the first 7 content lines.
function clampBlocks(blocks: NoteBlock[], max: number): { blocks: NoteBlock[]; truncated: boolean } {
  const kept: NoteBlock[] = [];
  let used = 0;
  for (const b of blocks) {
    if (used >= max) return { blocks: kept, truncated: true };
    const size = b.type === "p" ? b.lines.length : b.type === "h1" || b.type === "h2" ? 1 : b.items.length;
    if (used + size <= max) {
      kept.push(b);
      used += size;
      continue;
    }
    const room = max - used;
    if (b.type === "p") kept.push({ ...b, lines: b.lines.slice(0, room) });
    else if (b.type === "check") kept.push({ ...b, items: b.items.slice(0, room) });
    else if (b.type === "ul" || b.type === "ol") kept.push({ ...b, items: b.items.slice(0, room) });
    else kept.push(b);
    return { blocks: kept, truncated: true };
  }
  return { blocks: kept, truncated: false };
}

export default function NoteMarkdown({
  body,
  onToggleCheck,
  clamp = false,
}: {
  body: string;
  onToggleCheck?: (lineIndex: number) => void;
  clamp?: boolean;
}) {
  const parsed = parseNoteBlocks(body);
  const { blocks, truncated } = clamp ? clampBlocks(parsed, 7) : { blocks: parsed, truncated: false };

  return (
    <div
      className={`${clamp ? "text-[13px] space-y-1.5" : "text-[15px] space-y-2.5"} leading-relaxed text-charcoal-80 break-words`}
    >
      {blocks.map((b, i) => {
        if (b.type === "h1") {
          return (
            <h4
              key={i}
              className={`font-display font-bold tracking-tight text-ink leading-snug ${clamp ? "text-[14px]" : "text-[17px] pt-1 first:pt-0"}`}
            >
              {renderInline(b.text)}
            </h4>
          );
        }
        if (b.type === "h2") {
          return (
            <h5
              key={i}
              className={`font-display font-bold tracking-tight text-ink leading-snug ${clamp ? "text-[13.5px]" : "text-[15px] pt-1 first:pt-0"}`}
            >
              {renderInline(b.text)}
            </h5>
          );
        }
        if (b.type === "ul" || b.type === "ol") {
          const Tag = b.type === "ul" ? "ul" : "ol";
          return (
            <Tag
              key={i}
              className={`${b.type === "ul" ? "list-disc" : "list-decimal"} ps-[1.35em] marker:text-charcoal-40 ${clamp ? "space-y-0.5" : "space-y-1"}`}
            >
              {b.items.map((t, j) => (
                <li key={j}>{renderInline(t)}</li>
              ))}
            </Tag>
          );
        }
        if (b.type === "check") {
          return (
            <ul key={i} className={clamp ? "space-y-0.5" : "space-y-1"}>
              {b.items.map((it, j) => (
                <li key={j} className="flex items-start gap-2">
                  <GlassCheck
                    checked={it.checked}
                    small={clamp}
                    onToggle={onToggleCheck ? () => onToggleCheck(it.line) : undefined}
                  />
                  <span className={`min-w-0 ${it.checked ? "text-charcoal-40 line-through" : ""}`}>
                    {renderInline(it.text)}
                  </span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            {b.lines.map((l, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {renderInline(l)}
              </span>
            ))}
          </p>
        );
      })}
      {truncated && <p className="text-charcoal-40 !mt-0.5">…</p>}
    </div>
  );
}

/* -------------------------------------------------- print / PDF export */

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

// The same subset rendered to simple HTML for the print window. Every piece
// of user text passes through escapeHtml before being wrapped in tags.
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
