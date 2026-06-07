# Marker Studio — Session Handoff

Working branch: **`claude/awesome-turing-1YUgk`** (check it out first: `git checkout claude/awesome-turing-1YUgk`).

This is the marketing site for **Marker Studio® / MarkerGraphics™**, a bilingual
(EN/AR) creative & marketing studio in Beit Sahour, Palestine. Live preview is on
Vercel (`markerstudio.vercel.app` is the production branch; this feature branch
deploys as a Vercel preview URL).

## Stack
- Next.js 14 (App Router) + TypeScript + Tailwind (Tailwind barely used — styling
  is plain CSS with design tokens).
- `npm install && npm run build` to verify (compiles, type-checks, lints).
- `npm run dev` → http://localhost:3000

## File map (read these to get oriented)
- `components/MarkerSite.tsx` — the whole site, one client component. Holds the
  `Reveal` scroll-animation wrapper, header w/ mobile menu, and every section.
- `lib/content.ts` — **single source of truth** for all copy, bilingual (EN/AR).
  Also holds `CLIENT_BRANDS` (real client logos hot-linked from the Wix CDN).
- `app/globals.css` — design tokens (`:root`), `.ms-*` component classes, the
  `.brushed` brushstroke accent, responsive rules. **Match this system.**
- `public/assets/` — Marker's own logos (primary, on-dark, favicon) + brushstroke.
- `public/fonts/` — self-hosted Poppins (Latin) + Thmanyah Serif (Arabic).

## Design system (keep new sections on-brand)
- Colors: Marker Orange `#FF9100` (hover `#E07E00`) + Charcoal `#303030`; surfaces
  Cream `#F5F2EC` / Paper `#FAF8F4` / White. Tokens live in `:root` in globals.css.
- Type: Poppins (Latin), Thmanyah Serif Display/Text (Arabic). Use the CSS vars.
- Accent: `.brushed` / `.brushed--bold` — hand-drawn orange brushstroke under one
  word per section, max.
- Corners crisp (4px chips/buttons, 8px cards). Sparse shadows. Motion eases in
  `:root` (`--ease-out`, etc.).
- Section helpers: `.ms-section`, `--cream`, `--dark`, `--orange`, `.ms-container`.
- Animation: wrap section children in `<Reveal delay={n}>` for scroll-in fade/lift
  (IntersectionObserver, respects `prefers-reduced-motion`).
- **Bilingual is mandatory**: every new section needs EN + AR entries in
  `lib/content.ts`, and must work in RTL (Arabic sets `dir=rtl` + `body.ar`).

## Sections currently on the page (in order)
Header (nav anchors + mobile hamburger) → Hero → Clients logo marquee → Work grid
→ Services → Studio (story + Marker logo showcase) → Metrics (dark) → Testimonials
→ Process → FAQ accordion → CTA banner (orange) → Contact → Footer.

## Wix integration (how real content/assets were sourced)
- The studio's site is **MarkerGraphics**, Wix site id
  `6bd9664a-b7a3-4135-9625-66b1bd501d41`.
- Real client logos were pulled from the Wix Media Manager (List Files API) and are
  hot-linked from `https://static.wixstatic.com/media/...` in `CLIENT_BRANDS`
  (`lib/content.ts`). The sandbox blocks downloading them (host not in allowlist),
  so they're hot-linked, not self-hosted. To self-host later, the images must be
  added to `public/` (needs network access or manual upload).
- marker.ps blocks bots (403) — do NOT scrape it; use the Wix MCP instead.
- The actual page *marketing copy* is NOT exposed by Wix's REST APIs (it lives in
  the editor document), so headline/testimonial copy is original/placeholder.

## Pending / good next steps
- **Magic MCP (21st.dev)**: use it to generate new section designs, then adapt them
  to the tokens/classes above and wire copy through `lib/content.ts` (EN+AR).
- Testimonials are neutral placeholders — swap in real quotes when available
  (don't invent quotes attributed to real named clients).
- Work grid features 5 brands; many more real logos exist in `CLIENT_BRANDS` and in
  the studio's Wix Media Manager if you want to feature different ones.
- No PR has been opened yet (user hadn't asked). Production deploy = merge this
  branch into the default branch.

## Conventions
- Commit messages: clear, descriptive; develop on the working branch above; push
  with `git push -u origin claude/awesome-turing-1YUgk`. Do not open a PR unless
  asked. Verify with `npm run build` before pushing.
