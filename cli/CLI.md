# r5c — the Requirement5cards CLI

Create, publish, and render R5c trading cards from the terminal. Built for
humans and agents: every command has `--json` output, auth is a stored token or
an environment variable, and a single JSON spec file describes a complete card
down to the last holo parameter.

```bash
# Install (pick one)
curl -fsSL https://requirement5.com/install | sh   # no root, installs to ~/.r5c
npm install -g r5c                                 # via npm
cd cli && npm link                                 # from a repo checkout

# One-minute card
r5c signup --username ada_l --email ada@example.com --password 'correct-horse-9'
r5c template > card.json               # edit: point "image" at your artwork
r5c publish card.json                  # prints https://requirement5.com/card/<id>
```

## How it fits together

The CLI talks to the same JSON API as the web app (default
`https://requirement5.com`, override with `R5C_API_URL` or
`r5c config --api-url`). You write a small **spec file**; the CLI expands it
into the complete card state the web customizer would produce — sensible
defaults for every visual system, deep-merged with whatever you override —
inlines your local artwork as data URLs, and publishes. The server downscales
images to 1200px WebP and moves them to object storage, then the card is live
at `/card/<id>`.

## Authentication

| Method | How | Good for |
|---|---|---|
| `r5c signup` / `r5c login` | Stores a 30-day token in `~/.r5c/config.json` (mode 600) | Humans |
| `--password` flag | Non-interactive login | Scripts |
| `R5C_TOKEN` env var | Bypasses the config file entirely | CI, agents, multi-account |

New accounts are granted **50 /t26** (the platform currency). Publishing a card
stakes **1–4 /t26** (rolled per publish), so a fresh account can publish many cards immediately.
When other players save your card you earn a dividend, scaled by tier — check
with `r5c balance` / `r5c transactions`.

## Commands

### Account
- `r5c signup --username <name> --email <addr> [--password <pw>]` — create account + log in
- `r5c login --username <name|email> [--password <pw>]` — log in with a username or email (password prompted if omitted)
- `r5c logout` — forget the stored token
- `r5c whoami` — current user, balance, API URL
- `r5c balance` / `r5c transactions` — /t26 balance and ledger

### Cards
- `r5c publish <spec.json> [--open] [--json]` — build and publish a card; prints its URL
- `r5c update <id> <spec.json>` — re-design a card you own from a spec (no new stake)
- `r5c preview <id> [--frames N] [--out <dir>]` — capture still PNGs of the live
  card (one at rest, the others mid-orbit with the holo awake) — the agent-friendly
  way to *look at* a card between updates
- `r5c template [minimal|full]` — print an example spec to start from
- `r5c get <id>` — full card record as JSON
- `r5c list [--mine]` — community pool, or your published cards
- `r5c collection` — cards you've saved
- `r5c delete <id>` — delete a card you created
- `r5c render <id> [--format gif|mp4] [--open]` — server-side render to a shareable
  GIF/MP4 URL (first render ~30s; URLs expire after ~14 days)
- `r5c open <id>` — print and open the card's page

### Setup
- `r5c config` — show effective config and where each value comes from
- `r5c config --api-url http://localhost:4000` — target a local dev server

`--open` is always opt-in: nothing ever pops a browser unless you ask.

## The spec file

Only `tier` is required, but a real card wants `name`, `image`, and `tags`:

```json
{
  "name": "Neon Reliquary",
  "tier": "ultra",
  "tags": ["cosmic", "portrait"],
  "image": "./artwork.png"
}
```

`image` / `holoImage` accept a local path (resolved relative to the spec file),
an `https://` URL, or a raw data URL. PNG, JPEG, WebP, GIF, AVIF.

### Tiers

| tier | display | rarity band | save cost | notes |
|---|---|---|---|---|
| `common` | Common | 0–0.7 | 4 | |
| `holo` | Uncommon | 0.7–0.8 | 8 | |
| `galaxy` | Scarce | 0.8–0.85 | 20 | |
| `wowa` | Rare | 0.85–0.9 | 36 | |
| `ultra` | Fine | 0.9–0.98 | 72 | |
| `vmax` | Singular | 0.98–1.0 | 160 | 1-in-2000 draw odds |

`rarityScore` (0–1) is optional; it defaults to the middle of the tier's band
and is clamped into the band by the server. Creator dividends are 20% of the
save cost, so rarer tiers earn more per save.

### Visual overrides — `spec.card`

Everything below is optional and deep-merges over coherent defaults derived
from `backgroundColor.baseHue`. The one-stop terminal reference is
`r5c help spec`; the full example is `r5c template full`.

```json
{
  "name": "Neon Reliquary",
  "tier": "ultra",
  "image": "./artwork.png",
  "holoImage": "./holo-overlay.png",
  "card": {
    "backgroundColor": { "baseHue": 268 },
    "baseBackground": {
      "type": "radial",
      "color1": "#2a1046", "color2": "#080311", "color3": "#3a1d55",
      "useThird": true, "angle": 210, "posX": 60, "posY": 40,
      "fadeStart": 12, "fadeEnd": 88, "vignette": 0.42, "grain": 0.15
    },
    "patternInfo": { "type": "Constellation", "opacity": 0.7 },
    "effectParams": {
      "parallaxDepth": 0.5,
      "customHoloBlendMode": "color-dodge"
    },
    "imageEffects": { "opacity": 0.98, "saturation": 1.3 },
    "borderEffects": { "thickBorderEnabled": true, "color": "rgb(255,215,0)", "opacity": 0.4 },
    "holoEffects": { "rareHolo": true, "rareHoloGalaxy": true },
    "rareHoloParams": { "intensity": "extreme", "blendMode": "soft-light" }
  }
}
```

The systems, briefly:

- **`backgroundColor`** — the card's color scheme. Setting just `baseHue`
  (0–360) recolors the whole default scheme.
- **`baseBackground`** — the backdrop gradient: `linear` / `radial` / `conic`,
  up to three hex colors, plus `vignette` (0.1–0.55) and film `grain` (0–0.22).
- **`patternInfo`** — a decorative pattern layer. Types: `Circles`, `Spindles`,
  `Squares`, `Triangles`, `Starburst`, `Hexagons`, `Fractal Noise`, `3D Grid`,
  `3D Isometric`, `3D Wave`, `Constellation`. `opacity` 0.3–0.9.
- **`effectParams`** — `parallaxDepth` (0–1, the artwork's 3D shift as the
  card tilts), `filterBrightness`/`filterContrast`/`filterSaturate` (drive the
  Nebula/Pulse filters), and `customHoloBlendMode` (how the Veil overlay
  blends).
- **`imageEffects`** — how the artwork sits in the frame: `opacity` (and
  `opacityHover` while touched), `contrast`, `saturation`, `blendMode`.
- **`borderEffects`** — the center panel (`thickBorderEnabled`, `color`,
  `opacity`, touched variants, plus a blurred artwork wash via
  `borderImageEnabled`/`imageOpacity`), the thin edge line, and the edge
  glow colors.
- **`holoEffects`** — toggles for the four animated holographic systems
  (combine freely). Site display names in brackets: `rareHolo` [Prism —
  rainbow bands], `rareHoloGalaxy` [Nebula — galaxy swirl], `wowaHolo`
  [Signal — broad angular sweep], `rareHoloVmax` [Pulse — high-contrast
  bands]. The top-level `holoImage` is the fifth technique [Veil]: your image
  blended straight over the card; it stacks with the systems. Each system has
  a `<name>Params` block; enabling an effect without params applies its
  defaults. Params accept a `backgroundImage` — a local path works and is
  inlined automatically.

Blend modes anywhere a `blendMode` appears: `normal`, `color-dodge`,
`color-burn`, `soft-light`, `hard-light`, `screen`, `overlay`, `multiply`,
`difference`, `exclusion`, `hue`, `saturation`, `color`, `luminosity`.

## Agent recipes

The design-iterate loop — publish once, then look/adjust/update until it's right:

```bash
id=$(r5c publish card.json --json | jq -r .card.id)
r5c preview "$id" --out shots/     # 4 PNGs: rest pose + 3 orbit poses
# inspect shots/, edit card.json, then:
r5c update "$id" card.json
r5c preview "$id" --out shots/     # fresh frames (cache keys on card version)
```

Non-interactive end-to-end, no stored state:

```bash
export R5C_TOKEN=$(curl -s https://requirement5.com/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"bot","password":"..."}' | jq -r .data.token)

r5c publish card.json --json | jq -r .url
```

Batch-publish a directory of artwork:

```bash
for img in art/*.png; do
  jq -n --arg img "$img" --arg name "$(basename "$img" .png)" \
    '{name:$name, tier:"holo", image:$img, tags:["batch"]}' > /tmp/spec.json
  r5c publish /tmp/spec.json --json | jq -r .url
done
```

Exit codes: `0` success, `1` any failure (message on stderr, prefixed `r5c:`).
Failure modes worth handling: `402` not enough /t26, `401` token
missing/expired, `400` invalid spec (the CLI validates locally first with
field-level messages).

## Local development

```bash
npm run server                                  # API on :4000, JSON file store
r5c config --api-url http://localhost:4000
```

Note: `/card/<id>` pages are served by the frontend, which in dev runs on the
Vite port — the printed card URL assumes app and API share an origin, as in
production.
