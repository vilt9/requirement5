// All help text. `r5c help` / `r5c help <topic>`. The deep reference lives in
// cli/CLI.md; `r5c help spec` carries enough of it to write a card without
// leaving the terminal.
import { TIERS, BLEND_MODES, PATTERN_TYPES, MASK_TYPES, HOLO_EFFECTS } from './spec.js';

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
  effectParams                   Shine + chromatic aberration:
                                 { imageShineIntensity "0.6"–"1.0",
                                   aberrationIntensity, aberrationSpeed "10s",
                                   filterBrightness/Contrast/Saturate,
                                   holoAngle 0–360, parallaxDepth,
                                   customHoloBlendMode: <blend mode> }
  imageEffects                   { maskType: ${MASK_TYPES.join('|')},
                                   maskOpacity, blurAmount "0px", glowIntensity "5px",
                                   glowColor, opacity, contrast, saturation }
  borderEffects                  { thickBorderEnabled, thinEdgeEnabled, borderImageEnabled,
                                   borderColor, borderOpacity, edgeColor1/2, thinEdgeColor }
  holoEffects                    Toggle the four holo systems (any combination):
                                 { ${HOLO_EFFECTS.map((e) => `${e}: bool`).join(', ')} }
  rareHoloParams                 { space 0.5–5, hue 1–50, saturation 20–100, lightness 20–80,
                                   intensity "subtle"|"extreme", filterStrength 0.1–3,
                                   mouseSpeed 0.1–5, blendMode, colors: rgb string[],
                                   backgroundImage: path|URL }
  rareHoloGalaxyParams           { space 1–10, brightness 0.1–2, contrast 0.5–3,
                                   saturation 0.5–3, blendMode, gradientSize 100–800,
                                   gradientHeight 200–1500, smoothTransitions 0–1,
                                   colors, backgroundImage }
  wowaHoloParams                 { space 1–10, angle 0–360, brightness 0.1–2, contrast 0.5–3 }
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
