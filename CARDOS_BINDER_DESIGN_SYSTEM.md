# CARDOS_BINDER_DESIGN_SYSTEM.md · Landing Supplement ("The Binder")
> Status: SHIPPED P45.16 to cardostcg.com (11/11/2026, merge a0ba944). Real-phone check passed.
> Scope: one interactive section on the apex landing (cardostcg.com). Extends the Ledger system. Does not touch theme.ts or the app.
> Companion to CARDOS_LEDGER_DESIGN_SYSTEM.md and CARDOS_VOICE.md. Ledger rules win on any conflict not named here.

---

## Source
- **Sample:** 622.mp4. A small folio with a frosted cover. Hover opens the cover on a hinge and fans out the contents. Swatches below swap the cover color.
- **Revision:** folio becomes a premium binder. Stamps become chase cards from live games (OP, RB, PW).
- **Palette supplement:** Sanzo Wada, *A Dictionary of Color Combinations* (1933). Hex values from the mattdesl/dictionary-of-colour-combinations dataset. Wada combination numbers cited so any value can be checked.

## Point of View
Public line: **"Your chase cards, filed like assets."**
The binder is a ledger you can hold. Every card inside shows a real number or a dash.

---

## Color
Ledger tokens stay. Binder adds Wada-sourced tokens only for cover, paper, and sleeve materials. UI signal colors (gold CTA, teal gains, blue focus) are unchanged.

### Why these fit
Wada #267 is almost the whole CardOS palette in one 1933 combination: Cream Yellow (gold-300), Yellow Orange (gold-500), Benzol Green (teal), Blue (OS Blue). Wada #2 pairs Yellow Orange with Dark Tyrian Blue, the closest historic match to PSA Gold on Abyss.

| Token | Value | Wada source | Role |
|---|---|---|---|
| `--wada-yellow-orange` | `#F99D1B` | Yellow Orange, #2 #267 | Gold foil on covers. Not a CTA color (CTA stays `--gold-500`) |
| `--wada-cream-yellow` | `#FDBF68` | Cream Yellow, #267 | Cover sub text, spine stitching, PW cover title |
| `--wada-sulpher` | `#F5ECC2` | Sulpher Yellow, #151 | Binder paper, card tag strip |
| `--wada-ivory-buff` | `#EBD3A2` | Ivory Buff, #209 | Sleeve edge, pocket outline |
| `--wada-tyrian` | `#12354E` | Dark Tyrian Blue, #2 | OP cover |
| `--wada-madder-violet` | `#4E1D4C` | Dusky Madder Violet, #53 | RB cover |
| `--wada-poel-blue` | `#064F6E` | Vandar Poel's Blue, #151 | PW cover |
| `--wada-sepia` | `#644B1E` | Sepia, #288 | Onyx cover grain, paper noise |
| `--wada-black` | `#111314` | Black, #288 | Onyx cover (default), tag ink |
| `--wada-benzol` | `#00978D` | Benzol Green, #267 | Pocket tab accent only. Gains stay `--teal` |

### Covers
| Swatch | Cover | Title ink | Wada pairing | Shows |
|---|---|---|---|---|
| ONYX (default) | `--wada-black` + sepia grain | Yellow Orange | #288 | Mixed: one chase card from each live game |
| OP | `--wada-tyrian` | Yellow Orange | #2 | One Piece chase cards |
| RB | `--wada-madder-violet` | Yellow Orange | #53 | Riftbound chase cards |
| PW | `--wada-poel-blue` | Cream Yellow | #151 | Palworld chase cards |

Rules:
- Foil (swatch ring, hairline rules, title where it passes AA) is Yellow Orange so every cover reads as CardOS gold.
- A new game gets a cover only after it ships (Voice rule 8), picked from a Wada combination that contains Yellow Orange.
- Cover text must pass AA on its cover. Measured: Yellow Orange is 8.8:1 on Onyx, 6.0:1 on Tyrian, 6.2:1 on Madder Violet, 4.2:1 on Poel Blue (so PW uses Cream Yellow, 5.5:1). Cream Yellow sub text is 5.5:1 or better on all four.
- Rejected: Violet Blue `#40456A` for RB. Yellow Orange is 4.3:1 on it and foil at 70% is 2.9:1.

---

## Typography
Ledger type, no additions. Sample's Japanese cover text is dropped.
- **Cover title:** DM Sans 600, 15px. `CHASE // OP`.
- **Cover sub:** DM Mono 500, 10px, uppercase, ls .18em, Cream Yellow. `VAULT · 03 CARDS`.
- **Card tag:** DM Mono 400, 11px, tabular-nums. `OP05-119 · Est. $412.00` or `OP05-119 · —`. Stacks to two lines under 600px.

## Spacing / Layout
- Binder: 280 × 360px desktop, 220 × 283px under 600px. Radius 10px cover, 6px pages. Spine 14px on the left edge.
- Cards: 196px wide desktop, 120px under 600px.
- Open state: cover hinges left, the binder slides left so the spread stays centered, cards fan right into a 3-card spread.
- Below about 900px the cards overlap and rise in a staircase so every tag stays readable. Step and rise are fluid, no breakpoint.
- Swatch row: 20px dots, 12px gap, centered 32px below the binder.
- Section sits on `--abyss` with the Ledger glow behind the binder.

---

## Components
- **Binder cover:** cover color + frosted window. A blurred copy of the top card (`blur(14px)`, 55% opacity) sits inside the cover at the card's real position. Not `backdrop-filter`, which is unreliable inside a 3D transform. Two hairline rules near the bottom, foil at 30%.
- **Spine:** 14px, darker cover shade (mix 20% black), 3 cream-yellow stitch dots.
- **Page:** `--wada-sulpher` with sepia paper noise (static SVG). Pocket outlines 1px `--wada-ivory-buff`. Benzol tab on the right edge.
- **Chase card:** real card image inside a sleeve. Sleeve = 4px clear border, 1px `--wada-ivory-buff` edge, 6% top sheen. Tag strip below the card with set code and Est. price.
- **Swatch:** 20px dot, cover color, 1px foil ring. Active = 2px foil ring offset 3px. Keyboard reachable, `aria-pressed`, `aria-label="Show Riftbound binder"`.
- **Focus:** Ledger focus ring (2px os-blue, offset 3px).

## Motion
- **Open:** hover (mouse), tap (touch), or Enter/Space on the cover. Cover `rotateY(-66deg)` desktop, `-72deg` under 600px, perspective 1200px, origin left, 520ms `cubic-bezier(.2,.8,.2,1)`. The first draft's -38deg left the cover over about 270 of 280px, so the page never showed.
- **Fan:** cards translate right and rotate 2, 4, 6deg, 60ms stagger, 420ms.
- **Close:** reverse, 360ms. Close on mouseleave, second tap, or Esc.
- **Swatch swap:** cover color crossfades 280ms. Cards swap only while closed, so the reveal is the payoff.
- **Reduced motion:** no rotate or fan. Open = the binder crossfades to a flat, centered 3-card spread.
- **Pause:** respects the Ledger MOTION chip (same behavior as reduced motion).
- **No JS:** binder renders open, swatches hidden.

---

## Data
- Cards come from real catalog rows. Est. price is `card_catalog.market_price`, the same value the app shows. Null price renders "—", never "$0.00".
- Price snapshot is baked into the page with its date shown: `Est. as of 11/11/2026`. Cards, prices and date are hard-coded in `index.html`. Images are local files in `/binder/`, 400px webp.
- Only pick rows whose price was refreshed recently. On 11/11/2026 the OP alt-art rows were last refreshed 11/03.
- Never describe how prices are captured. No pipeline words in markup, alt text, or JSON-LD.

## Page Order
One section, placed after the graded vault section of the Ledger page. Dossier label `SEC_04 // CHASE BINDER`. Later sections renumber to 05 through 09. One secondary CTA under the swatches: "Track your chase cards →".

---

## Guardrails
- Card images appear only inside the binder UI (sleeve + tag), never loose or as decoration.
- Disclaimer from CARDOS_VOICE.md present on the page. Game list matches the covers shown.
- No Japanese copy, no stamp motifs, no publisher logos on covers.
- No purple outside the RB cover material. Ledger's no-purple rule holds for all UI.
- Wada colors are material colors only. Never CTA, gain, or focus.
- Real-browser check, desktop + phone, before push.

## Open Items
- OP card art carries the SAMPLE watermark from the catalog images. Swap if clean art is sourced.
- Whether the set rotates monthly with the Monthly Recaps. Today a rotation is a hand edit of `index.html` and `/binder/`.
- IP call (Art): approved for card art inside the binder UI.

_Last confirmed: shipped P45.16 (11/11/2026)._
