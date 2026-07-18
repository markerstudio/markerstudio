// Pure text-editing helpers for the notes' markdown subset — shared by the
// editor modal and the capture-bar composer so both write the same way.
// Each returns the next value plus where the selection should land, so the
// caller owns state/refs and these stay trivially testable.

export type EditResult = { value: string; selStart: number; selEnd: number };

export const LINE_MARKER_RE = /^(#{1,2} |- \[[ xX]\] ?|- |\d+\. )/;

/** Wrap / unwrap the selection with an inline marker (** or *), keeping the
 *  selection on the same text afterwards. */
export function toggleInline(value: string, s: number, e: number, marker: "**" | "*"): EditResult {
  const sel = value.slice(s, e);
  const before = value.slice(0, s);
  const after = value.slice(e);
  if (sel && before.endsWith(marker) && after.startsWith(marker)) {
    // already wrapped just outside the selection — unwrap
    return {
      value: before.slice(0, before.length - marker.length) + sel + after.slice(marker.length),
      selStart: s - marker.length,
      selEnd: e - marker.length,
    };
  }
  if (sel.length >= marker.length * 2 && sel.startsWith(marker) && sel.endsWith(marker)) {
    // markers inside the selection — unwrap
    return {
      value: before + sel.slice(marker.length, sel.length - marker.length) + after,
      selStart: s,
      selEnd: e - marker.length * 2,
    };
  }
  return { value: before + marker + sel + marker + after, selStart: s + marker.length, selEnd: e + marker.length };
}

/** Prefix (or un-prefix) every line touched by the selection: heading,
 *  bullet, numbered list, or checklist. */
export function toggleLinePrefix(value: string, s: number, e: number, kind: "h2" | "ul" | "ol" | "check"): EditResult {
  const lineStart = value.lastIndexOf("\n", s - 1) + 1;
  let lineEnd = value.indexOf("\n", e);
  if (lineEnd === -1) lineEnd = value.length;
  const segment = value.slice(lineStart, lineEnd);
  const lines = segment.split("\n");
  const strip = (l: string) => l.replace(LINE_MARKER_RE, "");
  const has = (l: string) =>
    kind === "h2"
      ? /^## /.test(l)
      : kind === "check"
      ? /^- \[[ xX]\]/.test(l)
      : kind === "ul"
      ? /^- (?!\[)/.test(l)
      : /^\d+\. /.test(l);
  const prefixFor = (i: number) =>
    kind === "h2" ? "## " : kind === "ul" ? "- " : kind === "check" ? "- [ ] " : `${i + 1}. `;
  // Blank lines don't count as "already prefixed" — on an empty line the
  // button must insert the marker, not conclude there's nothing to strip.
  const allHave = lines.some((l) => l.trim()) && lines.every((l) => !l.trim() || has(l));
  const nextSegment = lines
    .map((l, i) => (!l.trim() && lines.length > 1 ? l : allHave ? strip(l) : prefixFor(i) + strip(l)))
    .join("\n");
  const next = value.slice(0, lineStart) + nextSegment + value.slice(lineEnd);
  const delta = nextSegment.length - segment.length;
  const pos = Math.max(lineStart, Math.min(next.length, e + delta));
  return { value: next, selStart: pos, selEnd: pos };
}

/** Enter inside a list continues it: "- ", "1. " (incrementing), "- [ ] ".
 *  Enter on an item that's still empty ends the list (strips the marker).
 *  Returns null when the caret isn't in a list line — let Enter be Enter. */
export function continueListOnEnter(value: string, s: number, e: number): EditResult | null {
  if (s !== e) return null; // a real selection replaces text — default behaviour
  const lineStart = value.lastIndexOf("\n", s - 1) + 1;
  let lineEnd = value.indexOf("\n", lineStart);
  if (lineEnd === -1) lineEnd = value.length;
  const line = value.slice(lineStart, lineEnd);
  const m = /^(- \[[ xX]\] |- |(\d+)\. )/.exec(line);
  if (!m) return null;
  const marker = m[1];
  if (s < lineStart + marker.length) return null; // caret inside the marker itself
  const content = line.slice(marker.length);
  if (!content.trim()) {
    // empty item — end the list instead of stacking blank markers
    const next = value.slice(0, lineStart) + value.slice(lineStart + marker.length);
    return { value: next, selStart: lineStart, selEnd: lineStart };
  }
  const nextMarker = m[2] != null ? `${parseInt(m[2], 10) + 1}. ` : marker.startsWith("- [") ? "- [ ] " : marker;
  const insert = `\n${nextMarker}`;
  return { value: value.slice(0, s) + insert + value.slice(s), selStart: s + insert.length, selEnd: s + insert.length };
}

/** Checklist progress across a note body — null when it has no checkboxes. */
export function checklistProgress(body: string): { done: number; total: number } | null {
  const done = (body.match(/^- \[[xX]\]/gm) || []).length;
  const total = done + (body.match(/^- \[ \]/gm) || []).length;
  return total > 0 ? { done, total } : null;
}
