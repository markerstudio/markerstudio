# Marker Studio® — Website

The marketing site for **Marker Studio®**, a bilingual (English / Arabic) creative
& marketing studio based in Beit Sahour, Palestine.

Built in **Next.js 14 (App Router) + TypeScript + Tailwind**, implementing the
official **Marker Studio Design System** handoff from Claude Design — the real
two-color brand (Marker Orange `#FF9100` + Charcoal `#303030`), the self-hosted
type system (Poppins for Latin, Thmanyah Serif for Arabic), and the signature
hand-drawn orange brushstroke motif.

## What's here

A single, fully bilingual landing page with a live **EN ⇄ AR** language toggle
that flips the whole document between LTR and RTL:

- **Header** — bilingual nav + language switch + primary CTA
- **Hero** — display headline with the brushed accent and proof-point metrics
- **Work** — recent client work in a 6-column editorial grid
- **Services** — the three core offerings (identity, social, campaigns)
- **Metrics** — real performance numbers pulled from the brand's analytics deck
- **Process** — the four-phase engagement model
- **Contact** — bilingual contact card + brief form
- **Footer** — bilingual sign-off

## Brand foundations

| Token | Value |
|---|---|
| Primary | Marker Orange `#FF9100` (hover `#E07E00`) |
| Ink | Charcoal `#303030` / near-black `#1A1A1A` |
| Surfaces | Cream `#F5F2EC` / Paper `#FAF8F4` / White |
| Latin type | Poppins (self-hosted, 100–900 + italics) |
| Arabic type | Thmanyah Serif — Display for titles, Text for body |
| Accent | Hand-drawn orange brushstroke (`.brushed`) — one word per page max |
| Corners | Crisp: 4px chips/buttons, 8px cards |

The design tokens live in `app/globals.css` (ported from the design system's
`colors_and_type.css`), with the composed component styles below them (ported
from the site kit's `site.css`). Fonts and brand assets are self-hosted under
`public/fonts/` and `public/assets/` — no CDN dependency.

## Project structure

```
app/
  layout.tsx        Root layout + metadata + favicon
  page.tsx          Renders <MarkerSite />
  globals.css       Brand tokens, type system, brushstroke, component styles
components/
  MarkerSite.tsx    The full site (client component, EN/AR state + RTL)
lib/
  content.ts        Bilingual content — single source of truth (EN/AR)
public/
  fonts/            Poppins + Thmanyah Serif (self-hosted)
  assets/           Logos, favicon, brushstroke PNG
```

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm run start    # serve the production build
```

## Notes & open items

Carried over from the design system handoff — confirm with the studio:

- **Tagline** — using "We mark the brands that matter." as a placeholder.
- **Work samples** — client cards use brand-colored placeholders, not real
  imagery. Drop real case-study images into the work grid when available.
- **Contact form** — currently front-end only (no submission backend wired).

The design system also ships **invoice** and **social-report** kits; only the
agency website is implemented here.
