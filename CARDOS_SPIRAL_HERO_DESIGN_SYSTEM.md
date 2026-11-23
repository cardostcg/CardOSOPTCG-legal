# CARDOS_SPIRAL_HERO_DESIGN_SYSTEM.md · P45.23

> Status: LOCKED. Gates lifted 22 Nov 2026. The spiral is the landing hook. The wavefield sits in the readout, one section down. `?hero=wave` puts the wavefield back in the hero.
> Scope: landing page hook on cardostcg.com. Desktop and mobile web. Not the app.
> Supplements CARDOS_BINDER_DESIGN_SYSTEM.md and CARDOS_LEDGER_DESIGN_SYSTEM.md.
> Precedence on this page: the live `index.html`, then Binder where Binder names an exception, then Ledger.
> Reference: the top frame of `1000004191.mp4` (Heyday spiral). Mood and interaction only. The tunnel under it is a different piece.

Reviewed 22 Nov 2026 (America/Chicago). Decisions below are locked as proposed in that review, except where this file says otherwise.

## Gates, lifted

Art lifted the code block on 22 Nov 2026 and asked for the hook. The findings below stay in force. They no longer hold the code.

### Gate 2, closed by dropping the games

Magic and Gundam stay off the spiral. There is still no device pass that shows a price, a search hit, and an add on the current store builds. Digimon and Pokemon stay out. The passing games are One Piece, Riftbound, and Palworld.

Image use cuts the count further. The only card art already published on this page is the chase binder: One Piece 3, Riftbound 4, Palworld 3. Terms for any other marketing art are not confirmed, so those games do not gain cards, and the hand list is these ten. A later device pass for Magic or Gundam still needs cleared art before that game joins.

Chase rims sit on the three nearest Riftbound cards (two on mobile). One Piece orange `#F99D1B` and PSA gold `#EF9F27` sit too close, so One Piece cards have no rim. Palworld cream `#FDBF68` merged with that orange on Abyss, so the Palworld mat is now Poel Blue `#064F6E`, the cover color already used on the Palworld binder. The 2px Abyss gap stays on the Riftbound rim, where violet and gold separate.

### Gate 5, lifted for this hook

The CTA stays `Log your first card →`. It goes to `https://app.cardostcg.com/` with `utm_source`, `utm_medium`, `card_id`, `game`, and `source` (`hero` or `detail`). The web app still asks for an account before Add to Vault. The label matches the CTA this page already used. Attribution for the card is on the query string and on `cta_click`.

### Gate 8, answered, kill switch on

Weekly landing traffic cannot support 2,000 `hero_view` events per arm. The spiral ships as the page, not as a 50/50 split. `?hero=wave` returns the current wavefield for the whole visit. Revert after the spiral window if the CTA rate per visitor is below the wavefield window, or if nobody who clicked reaches `first_card_added` or `account_created`. A zero on both windows turns the spiral off. Do not ship on CTA clicks alone.

## Open gates (record)

### Gate 2. Magic and Gundam stay off the hero

The hero promise has to match the current store builds. A game is on the spiral only when that build shows a price, a search hit, and an add.

What is already true:

- The mobile registry and the web registry both mark Magic and Gundam `live`, with a price source (`tcgplayer_mtg`, `tcgplayer_gd`) and catalog search.
- In November 2026, PostHog `game_selected` on store builds includes Magic and Gundam. Unique people: Magic 2 on 1.0.48 and 1 on 1.0.45, Gundam 1 on 1.0.48 and 1 on 1.0.45.
- `search_performed` and `vault_add_tapped` are not tagged by game. `first_card_added` in the last 30 days includes Gundam (1 person) and does not include Magic. A first-card event only fires once per person, so a later Magic add would not show there.

What is not shown: a price on screen, a search that returns a card, and an add, on the current App Store and Play builds, for each game.

Until that device pass exists, Magic and Gundam are out. Digimon stays out (prices are null). Pokemon stays out.

Passing games for v1: One Piece, Riftbound, Palworld.

Count rule: 4 cards per passing game, then the cards of a failed game are spread across the passing games. An uneven remainder goes to the larger catalogs first. That target is 20 cards: One Piece 7, Riftbound 7, Palworld 6. The shipped hand list is the 10 cards already on the page, because further art is not cleared. A game that later passes the device check takes 4 cards back, once its art is cleared.

### Gate 5. The web log path is not confirmed

The CTA label is `Log your first card →`. The destination is the web app, with `card_id`, `game`, and `source` on the query string.

What the web app actually does today:

- `https://app.cardostcg.com/app/` is a sign-in screen (Google, Apple, or a magic link). There is no web guest.
- Explore says sign in to browse the catalog. After a session, a card sheet has Add to Vault.
- `account_created` in October and November 2026 is only `posthog-react-native`. No web signup event.
- `first_card_added` on `cardos-ph-lite` is one person in October and none in November.
- The web auth helper stores `utm_source` and `utm_content` only. It does not read `card_id` or `game`. Attribution for those two fields lives on the landing `cta_click` event, which fires before the navigation.

A first-time visitor cannot log a card until they create an account, and that full path has not been completed in a browser. The CTA stays off the spiral until someone new signs up on the web and adds a card. If that path fails, the label changes to a destination the page can actually finish.

### Gate 8. Sample size, answered

PostHog project `Default project`. Unique people with a `$pageview` whose URL contains `https://cardostcg.com/`. Weeks are UTC. The partial week is through the evening of 22 Nov 2026, America/Chicago.

| Week starting | Unique visitors |
|---|---|
| 27 Sep 2026 | 58 |
| 4 Oct 2026 | 15 |
| 11 Oct 2026 | 38 |
| 18 Oct 2026 | 16 |
| 25 Oct 2026 | 12 |
| 1 Nov 2026 | 12 |
| 8 Nov 2026 | 20 |
| 15 Nov 2026 | 14 |
| 22 Nov 2026, partial | 6 |

The last four complete weeks are 12, 20, 14, and the partial week is 6. Even adding those weeks as if nobody returned is about 50 people. A 50/50 split cannot put 2,000 `hero_view` events on each arm in four weeks. A sequential run cannot either.

Ship test, locked:

- Sequential. Four weeks on the current hero, then four weeks on the spiral. The kill switch is on the whole time and returns the current hero.
- Revert, set now: after the spiral window, turn it off if the CTA rate per visitor is below the control window, or if nobody who clicked reaches `first_card_added` or `account_created`.
- A zero on both windows is inconclusive. The spiral comes back off.
- Do not ship on CTA clicks alone.
- `account_created` is not firing on the web today. A web signup will not count toward the guardrail until that event exists there. `first_card_added` will, when the web path emits it.

## Locked decisions

1. Bend is out of v1. Cards are flat and tilted. CSS 3D does not bend a plane.
2. Games and counts: Gate 2. Magic and Gundam stay off. The live hand list is One Piece 3, Riftbound 4, Palworld 3. The 20-card mix waits on cleared art.
3. Mats, for the first browser pass. Distinguish One Piece orange `#F99D1B`, Palworld cream `#FDBF68`, and the gold chase rim `#EF9F27` on Abyss `#0A0E1A`, with a 2px Abyss gap. If they merge, change the Palworld mat or drop the rim on One Piece. Riftbound is Madder Violet `#4E1D4C` at 10px with a 1px Cream Yellow inner hairline.

| Game | Mat |
|---|---|
| One Piece | `#F99D1B` |
| Riftbound | `#4E1D4C` plus `#FDBF68` hairline |
| Palworld | `#064F6E` (cream `#FDBF68` merged with One Piece orange, so the mat changed) |
| Magic, if it later passes | `#378ADD` |
| Gundam, if it later passes | `#00978D` |

Teal `#5DCAA5` is gains only. Chase rims are PSA Gold `#EF9F27`, at most 3 on desktop and 2 on mobile. OS Blue as a Magic mat is a named exception to the focus-ring rule.

4. Line under the H1 is the live lede: "The One Piece, Magic, Gundam, Riftbound, and Palworld TCG portfolio tracker." The One Piece-only tagline is out. While Magic and Gundam are off the spiral, the lede stays the live sentence. The spiral does not rewrite the page's game list.
5. CTA: `Log your first card →` to the web app, with `card_id`, `game`, and `source` on the query string. Same label on the hero and in the detail. Gate 5 is lifted. The destination still requires an account.
6. Curation: a hand list in the repo. The weekly job refreshes price only. It writes derived numbers: percent move, a coarse series, and `as_of`. It does not write raw daily rows. The word Spine and price-source names stay out of file names and field names. The service key stays in CI secrets. The browser reads the static JSON and the static images. No catalog call from the page.
7. Tile B is the 30-day move. Gain in teal, loss in vermilion `#D9381E`, flat in faint gray. A missing number is an em dash in the tile. Never `$0.00`. The tile stays. Prices older than 10 days show the date. Older than 21 days, the detail drops both numbers and keeps art, name, set, and the CTA. Every price is tagged Est.
8. Ship test: Gate 8.

## Scene

Abyss `#0A0E1A`. A warm-white flare at the vanishing point with a gold falloff. OS Blue stays the focus ring. The core is decorative. No type and no button on it.

One funnel, one rotating group. CSS 3D, perspective 1200px. About 2.2 turns. Far radius about 12 percent of the shorter viewport side, near radius about 55 percent, then reduced until every card stays inside the viewport and clear of the H1, the lede, and the CTA. Depth from about -1800px to about +260px, with the radius rising steeply so one card is large, a few are medium, and the rest sit small at the flare. Each card faces the helix with a seeded tilt, 6 to 14 degrees of roll and 4 to 9 degrees of pitch. Same layout per load and per device class. The left scrim keeps the type readable over the brightest card.

Slot order is curated. No two cards of the same game adjacent. No two similar mats adjacent. Chase cards are spread across depth. No collisions. The minimum gap between near cards is 8 percent of card width, checked at 360, 768, 1440, and 1920.

Cards are 63:88. Corner radius about 3.5 percent of width. The art is not cropped. No type on the card. A 6 to 10px mat. Secret Rare and Special get a faint sheen on desktop pointer and on a device tilt only when permission already exists. The page never asks for that permission.

Detail is a flat card, tilt 0. Desktop: columns 1 to 7, about 72vh tall. The reference posters are landscape, so width is not copied from the clip. Mobile: the card is about 46vh, and the panel is a bottom sheet.

## Type and chrome

Display is self-hosted DM Sans 600. There is no 700 file on the landing page. Labels, the counter, and the eyebrow are DM Mono.

The header stays the live header: wordmark, section rail, Motion chip, Web app, Get the app. The Motion chip is the pause control. No second pause button.

Slots:

- Eyebrow: "Tracks profit, not just worth."
- Caption: active card, small. Index, game, name, set code.
- H1, real text: "Every card logged. Every dollar tracked."
- Lede, real text: the live lede.
- CTA pill: `Log your first card →`, once Gate 5 is closed.
- Hint, bottom right, desktop: "Tap a card to see its price move." It leaves after the first interaction. Hidden when motion is reduced.

The H1 and the lede are HTML text. They are not drawn into an image. Each card image has alt text: game, card name, set code.

Focus ring: 2px OS Blue, 3px offset, including on gold and yellow mats.

## Motion and input

Orbit is about one turn per 90 seconds, clockwise, linear, one CSS animation on the group. A small seeded drift of 2 to 4px. Hover and focus pause the orbit over 400ms. Leaving resumes over 600ms. Hidden tab or an offscreen hero pauses everything.

`prefers-reduced-motion: reduce` is honored by default. The spiral is paused. No orbit, no drift, no parallax. Opening is a 200ms crossfade. The Motion chip does the same when it is off.

No pointer parallax. No scroll hijack. Vertical swipe and wheel scroll the page. Horizontal drag, horizontal swipe, and left and right arrows rotate the funnel. The first 8px of a touch decides swipe versus scroll. On mobile, only the nearest 8 cards are tappable. Tap targets are at least 44px.

Opening is 650ms, `cubic-bezier(0.22, 1, 0.36, 1)`. The card flies from its slot to the detail pose. The spiral dims. Closing is 500ms and returns the card to the same slot. The orbit stays paused during detail. Prev and next fly the neighbor in spiral order.

## Detail

Eyebrow: game, set code, number. Title: card name, two lines, then ellipsis. Subtitle: rarity and printing.

Tile A: Est. price, with the as-of date. Tile B: 30-day move. A sparkline only when the coarse series exists. No axes. The last point is labeled. Missing series hides the line and shows an em dash.

Meta: set, printing, last updated. Primary CTA as above. Legal line: the publisher's own current required wording, plus the Est. note.

No invented editorial. A chase line is a human field on the card record, or it is omitted.

## Data

Anon does not read `card_price_history`. The page does not call Supabase. A CI job with the service key in CI secrets builds the JSON and the images, weekly. The hand list decides membership. The job fails the build if a listed card is missing from the catalog or has no image.

Per card, derived fields only:

- `card_id` as a string
- `card_image_id`
- `game`, `set_code`, `number`, `name`, `rarity`, `printing`
- `mat` key
- `chase` flag
- `price` number or null
- `move_7d` and `move_30d` as percents, or null
- `series_30d` as a coarse series (at most one point per week) or null
- `as_of`
- optional human `line`

No `|| 0` and no `?? 0` on price or percent. Null price renders an em dash.

Images are self-hosted. Spiral images are 320px wide WebP. The open state uses the existing 400px binder file, because that is the master on hand. The nearest three load with the page. The rest wait until idle. Weight, this build: 315,898 bytes for all ten thumbs, 88,658 bytes for the nearest three. Budget: mobile LCP under 2.5s on a mid-range phone over 4G. The LCP element is the type, not the live scene. Mobile first paint under 450KB. Desktop under 700KB.

## Profiles

| Profile | Trigger | Cards | Blur | Sheen |
|---|---|---|---|---|
| Desktop | width at least 1100px | 20 | yes | yes |
| Tablet | 700 to 1099 | 16 | no | no |
| Mobile | under 700 | 12 | no | no |
| Lite | low memory, low cores, or fps under 40 for 2s | 10 | no | no |
| Reduced motion | `prefers-reduced-motion: reduce` | 12, still | no | no |

Tablet and mobile drop the farthest cards first and keep the game mix.

## Accessibility

Cards are buttons in a list, in spiral order. Accessible name: game, card name, set code, Est. price. Tab order starts at the nearest card. Focus inside the hero pauses the orbit.

Detail is a dialog. Focus moves to the close button, stays inside, and returns to the opening card. Escape closes. A live region announces the index.

Contrast of the H1 and the CTA stays AA over the scrim, including with the brightest card behind the type. The flare does not flash.

## Analytics

Existing `ph-boot.js` and `ph.js`. No second snippet. Events:

- `hero_view`, once, when half the hero has been in view for 1 second
- `spiral_open`, with `card_id`, `game`, and position
- `cta_click`, with `source` of `hero` or `detail`, and `card_id` when it is the detail

Properties stay free of name, email, and collection data. The downstream guardrail reads the existing `first_card_added` and `account_created` events. It does not add a new snippet to create them.

## Affiliation and image use

Each game shown uses that publisher's own current required wording, copied, not paraphrased. Art reviews the lines before they ship.

Candidate lines already in the product, for that review:

- One Piece, from the live footer: "CardOS TCG is a fan-made collection tracker. Not affiliated with, endorsed, or sponsored by Bandai, Shueisha, Toei Animation, Eiichiro Oda, Riot Games, UVS Games, Bushiroad, or Pocketpair."
- Magic, from the web registry: "CardOS TCG is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC."
- Riftbound, from the live footer: "RIFTBOUND: LEAGUE OF LEGENDS manufactured by UVS Games under license from Riot Games. ™ & © 2026 Riot Games, Inc."

Image use for marketing is a separate check per publisher. The binder IP approval covers the binder. It does not cover this hero. If a publisher's terms for card art in marketing are unclear, that game's cards leave the hero and their slots are spread by the Gate 2 rule.

## Fallbacks

No JS, or a JS error: a static row of card images, the same H1, the same lede, and the CTA once Gate 5 is closed. A broken image is removed from the spiral. A failed JSON file leaves the poster and the CTA. The kill switch returns the current wavefield hero.

## Out of scope

Card bend, WebGL, Three.js. Live prices, auth, and personalization on the landing page. Scroll-driven motion. A deep link that prefills the card. Pokemon, Digimon, and any game that fails Gate 2. Sound. Changes to REGRESSION_GUARD files, valuation, migrations, app.json, or tests.

## Acceptance, after the gates close

A mid-range Android phone in Chrome, and iPhone Safari. Desktop Chrome, Safari, and Firefox at 1440 and 1920. Reduced motion is a still spiral. A screen reader pass on the dialog and the card list. A null price renders an em dash with no layout shift. `as_of` at 12 days shows the date. `as_of` at 25 days drops the numbers. JS off shows the static row. LCP under 2.5s on throttled 4G, and the image weight is reported. Affiliation lines are the reviewed publisher text. The three events fire once and carry the right `card_id`.

_Locked 22 Nov 2026. Gates lifted the same night. Hand list is the ten binder cards. Kill switch is `?hero=wave`._
