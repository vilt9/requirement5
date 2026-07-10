// All help text. `r5c help` / `r5c help <topic>`. The deep reference lives in
// cli/CLI.md; `r5c help spec` carries enough of it to write a card without
// leaving the terminal.
import { TIERS, BLEND_MODES, PATTERN_TYPES, HOLO_EFFECTS } from './spec.js';

export const HELP = `r5c — Requirement5 cards from the command line

USAGE
  r5c <command> [args] [--flags]

ACCOUNT
  signup --username <name> [--password <pw>]   Create an account (grants 50 /t26) and log in
  login  --username <name> [--password <pw>]   Log in (token saved to ~/.r5c/config.json)
  logout                                       Forget the saved token
  whoami                                       Show current user and balance
  balance                                      Show /t26 balance
  transactions                                 Show your /t26 ledger

RARITY (a card's rarity is a server gamble, not something you pick)
  roll                                         Start / show your rarity roll for the next card (free)
  reroll                                       Draw a fresh rarity — costs a climbing /t26 fee
CARDS
  publish <spec.json> [--open] [--json]        Publish a card at your rolled rarity (charges the create fee)
  create  <spec.json> [--open] [--json]        Alias for publish
  update <id> <spec.json> [--json]             Re-design a card you own from a spec (free; rarity unchanged)
  preview <id> [--frames N] [--out <dir>]      Capture still PNGs of the live card (rest + orbit poses)
  template [minimal|full]                      Print an example spec to start from
  get <id>                                     Fetch a card as JSON
  list [--mine]                                List community cards (or your published cards)
  collection                                   List cards you have saved
  delete <id>                                  Delete a card you created
  render <id> [--format gif|mp4] [--open]      Render a card to a shareable GIF/MP4 URL
  open <id>                                    Print + open a card's page in the browser

SETUP
  config [--api-url <url>]                     Show config / point the CLI at another server

FLAGS
  --json          Machine-readable output (recommended for scripts/agents)
  --open          Open the resulting URL in the default browser (off by default)

ENVIRONMENT
  R5C_API_URL     Override API base (default https://requirement5.com)
  R5C_TOKEN       Bearer token — bypasses the stored login (good for CI/agents)

MORE
  r5c help <command>    Detail on one command
  r5c help spec         The card spec reference (every visual knob)
  cli/CLI.md            Full documentation
`;

const SPEC_HELP = `THE CARD SPEC (r5c publish <spec.json>)

A spec describes a card's LOOK. Its RARITY is not in the spec — it's a server
roll (\`r5c roll\` / \`r5c reroll\`), stamped on publish. Nothing here is
required; add "image" for a real card. Start from \`r5c template\`.

TOP LEVEL
  name        string    Card title
  tags        string[]  Search/discovery tags
  (tier / rarityScore are ignored if present — rarity comes from your roll.
   Tier bands, for reference: common 0–.7, holo .7–.8, galaxy .8–.85,
   wowa .85–.9, ultra .9–.98, vmax .98–1)
  image       path|URL  Main artwork. Local paths are inlined and the server
                        stores them (downscaled to 1200px, WebP) on its CDN.
  holoImage   path|URL  Optional overlay artwork for the holo layer
  card        object    Visual overrides, deep-merged over good defaults (below)

CARD OVERRIDES (spec.card.*) — everything optional
Every key below says what it does to the pixels, so you can design blind —
but you don't have to: \`r5c preview <id>\` shows you still frames, and
\`r5c update <id> spec.json\` lets you iterate on the same card.

  backgroundColor.baseHue   0–360   One knob for the whole color scheme: sets the
                                    family (0 red, 120 green, 220 blue, 280 purple)
                                    that all defaults are derived from.

  baseBackground — the backdrop behind the artwork (visible where the image is
  transparent or its opacity is lowered):
    type            linear|radial|conic|solid   Fade shape: one direction / from a
                                    point / sweeping around a point / flat color
    color1..color3  #hex            Fade colors (color3 is the middle stop; set
                                    useThird: true to include it)
    angle           0–360           Direction of a linear fade / start of a conic sweep
    posX, posY      0–100           Center of a radial/conic fade (% of card)
    fadeStart/End   0–100           Where the blend begins and completes: high start =
                                    color1 fills more; low end = harder, tighter edge
    vignette        0.1–0.55        Darkens the corners, pulls focus to the middle
    grain           0–0.22          Film-like noise for a printed, tactile feel

  patternInfo — a faint decorative texture over the backdrop:
    type            ${PATTERN_TYPES.join('|')}
    opacity         0.3–0.9         How visible the texture is

  effectParams — cross-cutting knobs:
    parallaxDepth        0–1        The artwork shifts against the frame as the card
                                    tilts, like a window into the scene. 0 = flat.
    customHoloBlendMode  <blend>    How the Veil overlay (holoImage) mixes with the
                                    card: color-dodge = bright shine, overlay = subtle
    filterBrightness/Contrast/Saturate   Push the Nebula + Pulse filter looks

  imageEffects — how the artwork itself is treated:
    opacity         0–1             How solid the artwork is; lower it to let the
                                    backdrop show through
    opacityHover    0–1             Artwork opacity while the card is touched — set
                                    below opacity to make the holo flare on touch
    contrast        0.5–2           Deepens shadows, brightens highlights
    saturation      0–2             0 = black & white, 2 = vivid
    blendMode       <blend>         How the artwork mixes with the backdrop

  borderEffects — the frame:
    edgeColor1/2                    The glowing line sweeping around the card's edge
                                    as it tilts, and the color it fades into
    thickBorderEnabled              The center panel: a tinted pane over the middle
    color / opacity                 Panel tint at rest
    colorHover / opacityHover       Panel tint while touched
    transitionDuration  0–2 (s)     How long the panel takes to shift on touch
    borderImageEnabled              Lays a blurred copy of the artwork over the panel
    imageOpacity        0–1         ...and how visible that frosted wash is
    thinEdgeEnabled + thinEdgeColor A hairline outline at the very edge

  holoEffects — the five animated holographic systems; combine freely. Site
  display names in brackets. Toggling one on without its params block applies
  good defaults:
    { ${HOLO_EFFECTS.map((e) => `${e}: bool`).join(', ')} }
    rareHolo [Prism]        rainbow bands sweeping with the tilt
    rareHoloGalaxy [Nebula] deep-space color swirls that drift and stretch
    wowaHolo [Signal]       one broad angular light sweep crossing the card
    rareHoloVmax [Pulse]    hard high-contrast bands, red/pink by default
    (holoImage at the top level is the fifth: [Veil], your image blended
    straight over the card, shining under the pointer)

  rareHoloParams [Prism]:
    space           0.5–5           Band width: low = tight stripes, high = broad washes
    hue             1–50            Color spread: how many colors pack into the sweep
    saturation      20–100          Vividness: grey → neon
    lightness       20–80           Band brightness: moody → glowing
    intensity       "subtle"|"extreme"   extreme stacks a second, heavier rainbow pass
    filterStrength  0.1–3           One knob for how hard the whole effect hits
    mouseSpeed      0.1–5           Tilt response: high snaps, low glides
    blendMode       <blend>         How the rainbow mixes with the artwork
    colors          rgb string[]    The band colors, in order
    backgroundImage path|URL        Replace the rainbow with your own texture

  rareHoloGalaxyParams [Nebula]:
    space              1–10         Swirl scale: fine detail → broad clouds
    brightness         0.1–2        Lifts or dims the whole effect
    contrast           0.5–3        Split between glow and shadow
    saturation         0.5–3        Vividness: grey → neon
    gradientSize       100–800      Stretches the color field sideways
    gradientHeight     200–1500     ...and vertically, as the card tilts
    smoothTransitions  0–1          0 = hard color edges, 1 = melted together
    blendMode, colors, backgroundImage   as in Prism

  wowaHoloParams [Signal]:
    space           1–10            Distance between the sweeping stripes
    angle           0–360           Direction the stripes travel
    backgroundImage path|URL        Replace the sweep texture

  rareHoloVmaxParams [Pulse]:
    space           1–15            Distance between the bands
    angle           0–360           Direction the bands run
    brightness      0.1–2           Lifts or dims the whole effect
    contrast        0.5–4           Split between light and dark bands
    backgroundImage path|URL        Replace the band texture

BLEND MODES
  ${BLEND_MODES.join(', ')}

NOTES
  - Enabling a holo effect without its params block applies that effect's defaults.
  - Any local image path anywhere in spec.card (e.g. rareHoloParams.backgroundImage)
    is inlined automatically if the file exists (relative to the spec file).
  - Rarity is a gamble: \`r5c roll\` gives a free rarity for the next card;
    \`r5c reroll\` draws a fresh one for a climbing /t26 fee. Publishing charges
    the (gentle) create fee and stamps the current roll onto the card.
  - New accounts start with 50 /t26. You may spend into the red down to -1000
    (debt accrues 1.47%/day). When others save your card you earn a dividend.
  - The published card lives at <api-url>/card/<id>.
  - Loop: roll → (reroll to taste) → publish → \`r5c preview <id> --out shots/\`
    → look → \`r5c update <id> spec.json\` (free; rarity stays) → preview again.

TASTE
  This is the knob reference. For HOW to choose them — turning an image into a
  card that's subtly stunning rather than garish (the motion gloss, dark-image
  pitfalls, when to use each holo system, palette matching) — read
  cli/CARD_DESIGN.md. Do that before designing a card from real artwork.
`;

export const COMMAND_HELP = {
  spec: SPEC_HELP,
  roll: `r5c roll

Starts (or shows) your rarity roll for the NEXT card — a server-owned random
0–1 score that decides the card's tier. Free, and idempotent: you get one roll
per card, so calling it again returns the same roll (not a new free one).
To gamble for a better number, \`r5c reroll\`. Publishing consumes the roll.`,
  reroll: `r5c reroll

Draws a FRESH random rarity onto your active roll and charges the reroll fee
(climbs each time — the gambling tax). Prints the new rarity, the next reroll
price, and the create fee you'll pay at publish. Run \`r5c roll\` first if you
have no active roll.`,
  publish: `r5c publish <spec.json> [--open] [--json]   (alias: r5c create)

Publishes a card into the pool at your ROLLED rarity (\`r5c roll\` / \`reroll\`).
If you have no active roll, one is created for you (a free first roll). Charges
the create fee unless you already paid it. The spec provides only the LOOK —
rarity/tier come from the roll. Local image paths are inlined and offloaded to
the server's image store.

Prints the card's public URL. --open opens it; --json prints the full response.
See \`r5c help spec\` for the spec format.`,
  update: `r5c update <id> <spec.json> [--json]

Rebuilds a card YOU created from the spec file and replaces its LOOK — name,
tags, images, every visual parameter. Free, and the rarity does NOT change
(that was the roll). Iterate loop:

  r5c roll                       # (or reroll to gamble)
  r5c publish card.json          # first version (prints the id)
  r5c preview <id> --out shots/  # look at it
  # edit card.json...
  r5c update <id> card.json      # same card, new look
  r5c preview <id> --out shots/  # look again (fresh frames after updates)`,
  preview: `r5c preview <id> [--frames N] [--out <dir>] [--json]

Captures still PNGs of the LIVE card — one at rest (holo dormant) and N-1
poses along the tilt orbit with the holo awake — and prints their URLs.
With --out the frames are downloaded as <dir>/<id>_frameN.png, ready for an
agent (or a human) to look at. N defaults to 4, max 8.

Much cheaper than \`r5c render\` and made for design iteration: publish or
update, preview the frames, adjust the spec, update again. Frames re-capture
automatically after an update (the cache is keyed to the card's version).`,
  template: `r5c template [minimal|full]

Prints an example card spec as JSON, ready to save and edit:
  r5c template full > card.json

"minimal" (default) is the smallest useful spec; "full" demonstrates every
visual knob including all four holo effect systems. Reference: r5c help spec`,
  signup: `r5c signup --username <name> [--password <pw>]

Creates an account and stores the session token in ~/.r5c/config.json.
Username: 3-24 chars (letters, numbers, underscore). Password: min 8 chars —
prompted interactively if omitted (or piped via stdin).
New accounts are granted 50 /t26; rerolling and publishing spend from it (you
may go into the red down to -1000, which accrues 1.47%/day interest).`,
  login: `r5c login --username <name> [--password <pw>]

Logs in and stores the session token (valid 30 days) in ~/.r5c/config.json.
Password is prompted if omitted. For non-interactive use pass --password or
set R5C_TOKEN directly.`,
  render: `r5c render <id> [--format gif|mp4] [--open]

Asks the server to render the card through its capture pipeline (headless
browser + ffmpeg) and prints the resulting media URL. First render of a card
takes ~30s; repeats are served from cache. Render URLs are disposable
(expire after ~14 days) — re-run to refresh.`,
  list: `r5c list [--mine] [--json]

Without flags: all public community cards (id, tier, name per line).
--mine: cards you published, with save statistics in --json mode.`,
  config: `r5c config [--api-url <url>]

Shows effective configuration (API URL, login, token source). --api-url
persists a different server, e.g. a local dev API:
  r5c config --api-url http://localhost:4000
Environment variables R5C_API_URL / R5C_TOKEN always win over the file.`
};
