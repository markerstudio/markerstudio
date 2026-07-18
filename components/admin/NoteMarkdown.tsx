"use client";

/* NoteMarkdown — a tiny, safe renderer for the notes' markdown subset:
   `# ` / `## ` headings, **bold**, *italic*, `- ` bullets, `1. ` numbered
   lists, `- [ ]` / `- [x]` checklists, blank-line paragraphs. It builds
   React nodes directly (never dangerouslySetInnerHTML of user text), and
   also exports a fully-escaped md→HTML path for the print/PDF export. */

import type { ReactNode } from "react";
import { Check } from "lucide-react";
// Parsing + the escaped md→HTML print path live in lib/noteHtml — server-safe,
// shared with the /print/note/[id] route.
import { parseNoteBlocks, type NoteBlock } from "@/lib/noteHtml";

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
