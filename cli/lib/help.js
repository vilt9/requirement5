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

CARDS
  publish <spec.json> [--open] [--json]        Build + publish a card from a spec file (stake: 10 /t26)
  update <id> <spec.json> [--json]             Re-design a card you own from a spec (no new stake)
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

A spec is a JSON file. Only "tier" is required; add "image" for a real card.
Start from \`r5c template\` (minimal) or \`r5c template full\` (every knob).

TOP LEVEL
  name        string    Card title
  tier        string    ${TIERS.join(' | ')}
                        (common→vmax = rarest; save cost & creator dividends scale with tier)
  rarityScore number    0–1, clamped into the tier's band by the server. Optional:
                        defaults to the middle of the tier's band.
                        Bands: common 0–.7, holo .7–.8, galaxy .8–.85,
                        wowa .85–.9, ultra .9–.98, vmax .98–1
  tags        string[]  Search/discovery tags
  image       path|URL  Main artwork. Local paths are inlined and the server
                        stores them (downscaled to 1200px, WebP) on its CDN.
  holoImage   path|URL  Optional overlay artwork for the holo layer
  card        object    Visual overrides, deep-merged over good defaults (below)

CARD OVERRIDES (spec.card.*) — everything optional
  backgroundColor.baseHue        0–360; drives the default color scheme
  baseBackground                 { type: linear|radial|conic, color1..color3 (#hex),
                                   useThird, angle 0–360, posX/posY 0–100,
                                   fadeStart 0–25, fadeEnd 72–100,
                                   vignette 0.1–0.55, grain 0–0.22 }
  patternInfo                    { type: ${PATTERN_TYPES.join('|')},
                                   opacity 0.3–0.9, numLines, lineOpacity }
  effectParams                   { parallaxDepth 0–1 (3D shift of the artwork as
                                   the card tilts), filterBrightness/Contrast/Saturate
                                   (drive the Nebula/Pulse filters),
                                   customHoloBlendMode: <blend mode> (the Veil overlay) }
  imageEffects                   { opacity 0–1, opacityHover (while touched),
                                   contrast 0.5–2, saturation 0–2, blendMode }
  borderEffects                  { thickBorderEnabled (center panel), color, opacity,
                                   colorHover, opacityHover, transitionDuration,
                                   borderImageEnabled + imageOpacity (blurred artwork
                                   wash on the panel), thinEdgeEnabled,
                                   edgeColor1/2, thinEdgeColor }
  holoEffects                    Toggle the four animated holo systems (any combination;
                                 display names: rareHolo=Prism, rareHoloGalaxy=Nebula,
                                 wowaHolo=Signal, rareHoloVmax=Pulse; the top-level
                                 "holoImage" is the fifth technique, the Veil overlay):
                                 { ${HOLO_EFFECTS.map((e) => `${e}: bool`).join(', ')} }
  rareHoloParams                 { space 0.5–5, hue 1–50, saturation 20–100, lightness 20–80,
                                   intensity "subtle"|"extreme", filterStrength 0.1–3,
                                   mouseSpeed 0.1–5, blendMode, colors: rgb string[],
                                   backgroundImage: path|URL }
  rareHoloGalaxyParams           { space 1–10, brightness 0.1–2, contrast 0.5–3,
                                   saturation 0.5–3, blendMode, gradientSize 100–800,
                                   gradientHeight 200–1500, smoothTransitions 0–1,
                                   colors, backgroundImage }
  wowaHoloParams                 { space 1–10, angle 0–360, backgroundImage }
  rareHoloVmaxParams             { space 1–15, angle 0–360, brightness 0.1–2, contrast 0.5–4 }

BLEND MODES
  ${BLEND_MODES.join(', ')}

NOTES
  - Enabling a holo effect without its params block applies that effect's defaults.
  - Any local image path anywhere in spec.card (e.g. rareHoloParams.backgroundImage)
    is inlined automatically if the file exists (relative to the spec file).
  - Publishing stakes 10 /t26 (new accounts start with 50). When others save your
    card you earn a dividend scaled by tier.
  - The published card lives at <api-url>/card/<id>.
`;

export const COMMAND_HELP = {
  spec: SPEC_HELP,
  publish: `r5c publish <spec.json> [--open] [--json]

Builds a complete card from the spec file and publishes it into the public pool.
Costs the 10 /t26 publish stake. Local image paths in the spec are resolved
relative to the spec file, inlined, and offloaded to the server's image store.

Prints the card's public URL. --open additionally opens it in the browser.
--json prints the full server response (card, stats, balance) plus "url".

See \`r5c help spec\` for the spec format and \`r5c template full\` for a
maximal example.`,
  update: `r5c update <id> <spec.json> [--json]

Rebuilds a card YOU created from the spec file and replaces its design —
name, tier, tags, images, every visual parameter. No new stake: you already
paid to publish it. The spec is expanded exactly like \`r5c publish\`, so the
iterate loop is:

  r5c publish card.json          # first version (prints the id)
  r5c preview <id> --out shots/  # look at it
  # edit card.json...
  r5c update <id> card.json      # same card, new design
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
New accounts are granted 50 /t26; publishing costs 10.`,
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
