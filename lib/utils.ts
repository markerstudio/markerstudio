// Minimal class-name joiner. Keeps the shadcn-style `cn()` API that copied
// components expect, without pulling in clsx/tailwind-merge — this project
// has no class conflicts to dedupe (plain CSS + a sprinkle of Tailwind).
export function cn(...inputs: Array<string | false | null | undefined>): string {
  return inputs.filter(Boolean).join(" ");
}
