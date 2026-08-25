# CardOS Brand Atmosphere — "Gold Vault"

The canonical reference for the gold-on-black atmospheric background system
shipped on cardostcg.com (2026-08). Apply it in any CardOS repo to get the
same premium backdrop. Atmosphere only: it never replaces functional accents.

## Tokens

| Role | Value | Use |
|------|-------|-----|
| Base | `#0A0E1A` | Page background behind the layer |
| Gold | `#EF9F27` | Atmosphere only (smoke, halo, embers) |
| Cool counter-tone | `rgba(55, 138, 221, 0.10)` | Keeps gold reading expensive |
| Cool counter-tone 2 | `rgba(93, 202, 165, 0.05)` | Subtle teal echo |
| Text on atmosphere | `#E8EAF0` headings / `#B9BECE` body | Over scrim only |
| Functional accents | teal `#5DCAA5`, blue `#378ADD` | CTAs, links — never recolored gold |

## Canonical assets

Served from the apex (Cloudflare-cached; hotlink or copy — both fine, same infra):

```text
https://cardostcg.com/bg-vault.webp   42 KB   (primary)
https://cardostcg.com/bg-vault.jpg    116 KB  (fallback)
```

Repo sources for re-rendering or remixing:

```text
brand/gold-smoke-texture.png   AI-generated gold-silk texture layer
brand/bg-render.html           composite harness (gradients, ghosted logo, grain)
bg-vault.jpg / bg-vault.webp   shipped 2048x2048 master exports
```

## Drop-in snippet

HTML, first child of `<body>`:

```html
<div class="bg-layer" aria-hidden="true">
  <picture>
    <source srcset="https://cardostcg.com/bg-vault.webp" type="image/webp" />
    <img src="https://cardostcg.com/bg-vault.jpg" alt="" decoding="async" />
  </picture>
  <div class="bg-scrim"></div>
</div>
```

CSS:

```css
.bg-layer { position: fixed; inset: 0; z-index: -1; overflow: hidden; background: #0A0E1A; }
.bg-layer img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 38%; pointer-events: none; }

/* Marketing surfaces (landing, capture, confirmations) */
.bg-scrim { position: absolute; inset: 0; background:
  radial-gradient(ellipse 70% 55% at 50% 42%, rgba(10,14,26,0.55), rgba(10,14,26,0.2) 60%, rgba(10,14,26,0.65)); }

/* Long-form surfaces (legal, docs) — stronger, use instead */
.bg-scrim--reading { background:
  linear-gradient(rgba(10,14,26,0.45), rgba(10,14,26,0.45)),
  radial-gradient(ellipse 75% 60% at 50% 30%, rgba(10,14,26,0.35), rgba(10,14,26,0.15) 55%, rgba(10,14,26,0.6)); }
```

Optionally preload for instant first paint:

```html
<link rel="preload" as="image" href="https://cardostcg.com/bg-vault.webp" type="image/webp" />
```

## Rules

1. `position: fixed; inset: 0` layer — never `background-attachment: fixed`
   (broken/janky on iOS Safari) and never `100vh` (mobile URL-bar bug).
2. `object-fit: cover` from the square master — any viewport, no distortion.
   Keep `object-position: 50% 38%` so the emblem crop stays intentional.
3. Always render text over a scrim; verify contrast by screenshot per surface.
4. Decorative: `aria-hidden`, empty `alt`, no motion, no parallax.
5. Gold stays atmosphere. CTAs, links, and state colors keep their tokens.
6. React/SPA ports: same markup as a component; keep it outside routed
   content so it never re-mounts.

## Regenerating the master

Requires the repo checkout plus headless Chrome and Pillow:

```bash
# 1. Render the composite (outputs a 2048x2048 PNG)
google-chrome --headless --disable-gpu --hide-scrollbars \
  --window-size=2048,2048 --screenshot=/tmp/bg-master.png \
  file:///path/to/repo/brand/bg-render.html

# 2. Export shipped formats
python3 - <<'EOF'
from PIL import Image
im = Image.open('/tmp/bg-master.png').convert('RGB')
im.save('bg-vault.jpg', 'JPEG', quality=82, optimize=True, progressive=True)
im.save('bg-vault.webp', 'WEBP', quality=80, method=6)
EOF
```

The harness is deterministic: same inputs reproduce the shipped master
pixel-for-pixel. Tune `brand/bg-render.html` (emblem opacity/blur/position,
halo strength, vignette) to remix; keep the calm dark center for text.

The texture layer was AI-generated once with `icon.png` as the style
reference; it is committed so regeneration needs no further generation.
