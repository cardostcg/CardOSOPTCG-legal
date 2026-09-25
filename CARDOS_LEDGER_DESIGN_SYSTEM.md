# CARDOS_LEDGER_DESIGN_SYSTEM.md · Landing Design System ("The Ledger")
> Shipped P42.40b to cardostcg.com (merge 32d7de1, fix bad3295). Scope: apex landing only.
> App tokens in `theme.ts` are unchanged. Companion to CARDOS_VOICE.md and CARDOS_DESIGN_DISCIPLINE.md.

---

## Point of View
**"The spine is alive. Your ledger is proof."**
Gold-on-abyss trading ledger. A living gold price field behind a terminal dossier.
Every label reads like an instrument readout. Every number is real.
Reference: Austensor (mono dossier labels, numbered rail, corner brackets, spec lists, ribbon field), recolored gold.
Cut: generic SaaS patterns (pastel grids, logo walls, floating badges on screenshots, aggregate rating lines).

---

## Color (CSS custom properties on :root, no raw hex elsewhere)
| Token | Value | Role |
|---|---|---|
| `--void` | `#05070D` | Hero stage behind wavefield |
| `--abyss` | `#0A0E1A` | Page surface (locked brand token) |
| `--surface` | `#0F1422` | Cells, cards |
| `--surface-2` | `#151B2C` | Hover / raised |
| `--hairline` | `rgba(239,159,39,.12)` | Gold-tinted borders |
| `--hairline-n` | `rgba(255,255,255,.07)` | Neutral borders |
| `--gold-50` | `#FFF6E2` | |
| `--gold-100` | `#FFE7B8` | Readout numbers, core ribbon |
| `--gold-300` | `#F7C66A` | Dossier labels, CTA hover |
| `--gold-500` | `#EF9F27` | PSA Gold (locked). Primary CTA, active rail |
| `--gold-700` | `#B86F0E` | Brackets, wide ribbon pass |
| `--gold-900` | `#3D2304` | Deep glow |
| `--text` | `rgba(255,247,230,.94)` | Warm white body |
| `--muted` | `rgba(255,247,230,.58)` | Secondary text |
| `--faint` | `rgba(255,247,230,.36)` | Labels on void only. Contrast unverified |
| `--teal` | `#5DCAA5` | Gains only |
| `--os-blue` | `#378ADD` | Focus rings + inline links only |

Glow: `radial-gradient(60% 70% at 70% 45%, rgba(239,159,39,.18), transparent 70%)`.
Roles: gold = signal, brand, data, primary CTA. Teal = positive delta. Blue = focus.
No purple. Gradients only: glow, gold text gradient, wavefield.

---

## Typography
- Fonts self-hosted woff2 (Latin subset). No Google Fonts link. Preload DM Sans 600 + DM Mono 500 only. `font-display: swap`.
- **H1:** DM Sans 600, `clamp(2.75rem, 7.5vw, 5.5rem)`, lh 1.0, ls -0.035em. Line 2 in gold text gradient (gold-100 to gold-500). One H1 per page.
- **H2:** DM Mono 500, `clamp(1.5rem, 3.2vw, 2.25rem)`, lh 1.15, ls -0.01em.
- **Dossier label:** DM Mono 500, 11-12px, uppercase, ls .18em, gold-300. Format `SEC_03 // GRADED VAULT`.
- **Spec list:** DM Mono 400, 13px, lh 1.7, muted, `·` bullets, gold dot on list title.
- **Body:** DM Sans 17px / 1.6, max 62ch.
- **Numerals:** `font-variant-numeric: tabular-nums` everywhere.

---

## Spacing / Layout
- Base 4px. Scale: 4 8 12 16 24 32 48 64 96 128 160.
- Container: max 1240px, `padding-inline: clamp(20px, 5vw, 56px)`.
- Section padding-block: `clamp(64px, 10vw, 128px)`.
- Grid: 12 col desktop, 4 col mobile, gap 24.
- Radius: cells 4px (ledger, not bubbly). Chips, pills, buttons 999px.
- Borders 1px hairline. Adjacent cells share borders, no double lines.

---

## Components
- **Corner brackets:** 12px L-marks, gold-700, inset 16px from edges, layered above the canvas. On hero stage, dossier panels, footer.
- **Section rail:** fixed top-center pill, DM Mono, links 01-08 to anchors. Active = gold-500 fill, void text. IntersectionObserver. Hidden under 900px.
- **Chips:** 1px hairline, void bg, mono 11px uppercase, optional kbd hint.
- **CTA primary:** gold-500 fill, void text, mono uppercase, `→`. Hover gold-300.
- **CTA secondary:** 1px gold hairline, gold-100 text.
- **MOTION chip:** header toggle ON/OFF for wavefield, persisted in localStorage (try/catch). WCAG 2.2.2 pause control.
- **Wavefield geometry:** Full width. Alpha ramp 0.35× behind text column (0 to 45% W), full from 65% W. No CSS mask.
- **Focus:** 2px os-blue outline, offset 3px, on every interactive element.

---

## Wavefield (hero)
- One `<canvas>`, hand-written Canvas 2D, ~3KB inline. No three.js, no WebGL libs, no external script.
- 15 ribbons desktop, 8 mobile. ~160 points each. y = 3 summed sines + shared slow carrier.
- 3 passes per ribbon, `globalCompositeOperation: 'lighter'`: wide 8px gold-700 @ .06, mid 3px gold-500 @ .22, core 1px gold-100 @ .85. No shadowBlur.
- Ribbons start ~72% of width on desktop so they never cross the lede. No fade mask (mask hid ribbons live, removed).
- Hover nudges phase near cursor, max ±0.4 rad. No drag, no touch.
- Starts after first paint (requestIdleCallback). H1 stays the LCP element.
- DPR cap 2. ResizeObserver. Pauses offscreen and on hidden tab. Mobile 30fps cap.
- Auto-degrade: mean frame > 18ms over 90 frames drops to 6 ribbons, then still frame.
- Reduced motion: one still frame.
- No-JS fallback: `poster.webp`, 1280×720, 12KB, from a real canvas frame. `aria-hidden` on canvas.
- Stage overlays, true statements only:
  - Top-left: `PRICE HISTORY // EST.`
  - Bottom-left spec list: Every price tagged Est. · History builds daily
  - Bottom-right (desktop): `INTERACTION // [HOVER] phase shift`
  - Never "live data", row counts, or any number that goes stale.

---

## Page Order
| # | Section | Notes |
|---|---|---|
| 00 | Header | Logo · rail · MOTION chip · WEB APP link · gold "GET THE APP →". Sticky, void 85% + blur |
| 01 | Hero | Eyebrow "TRACKS PROFIT, NOT JUST WORTH." · H1 "Every card logged. Every dollar tracked." · lede · 2 CTAs · official store badges. No rating line |
| 02 | Readout | Daily · FIFO · Any grader · 3 platforms |
| 03 | Graders | Text wordmarks from `lib/constants.ts` GRADERS + "Any slab, manual entry". Trademark line |
| 04 | The Ledger | Text only until a reconciled demo screenshot exists. Spreadsheet 4 cells |
| 05 | Capabilities | 8 cells, indexed labels |
| 06 | Vs spreadsheet | Mono header, gold Yes, gold Pro chip, faint Manual/No. Explore as mono ticker line |
| 07 | From the stores | Verbatim quotes, store chip, no aggregate rating |
| 08 | Queries (FAQ) | details/summary, must match FAQPage JSON-LD exactly |
| Footer | | Brackets, links unchanged, both disclaimers verbatim |

---

## Guardrails
- No fabricated or stale numbers. Est. on every price in imagery. Screenshot numbers must reconcile.
- Currency list: USD, EUR, GBP (disk-confirmed). Same list in features, FAQ, JSON-LD.
- No affiliation implied (Bandai, Shueisha, Toei, Riot, UVS, graders). No OP art in brand areas. No grader logos.
- No aggregateRating in JSON-LD. No customer logo walls.
- No third-party or analytics scripts. No frameworks. No scroll-jacking, marquee, parallax, audio.
- WCAG AA, single H1, heading order intact, reduced motion respected.
- Protected, never edit: `privacy-policy.html`, `terms-of-service.html`, `delete-account.html`, `CNAME`. No URL changes.
- **Any canvas or visual change needs a real-browser check (desktop + phone) before push.** Headless missed the ribbons twice.

---

## Open Items
- Real-browser check of live ribbons, brackets, mobile ribbon visibility (72% start).
- `--faint` / `--muted` contrast ratios not measured.
- Lighthouse before/after not recorded.
- Rich Results Test on live FAQ JSON-LD. Search Console reindex.
- Fresh reconciled demo screenshot for section 04.
- #37 leftover files: confirm unused or remove.

_Last confirmed: P42.40b (09/24/2026)_
