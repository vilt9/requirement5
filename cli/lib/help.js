// All help text. `r5c help` / `r5c help <topic>`. The deep reference lives in
// cli/CLI.md; `r5c help spec` carries enough of it to write a card without
// leaving the terminal.
import {
  TIERS, BLEND_MODES, PATTERN_TYPES, HOLO_EFFECTS,
  HOLO_REVEAL_DIRECTIONS, HOLO_REVEAL_EASINGS, HOLO_REVEAL_MODES
} from './spec.js';

export const HELP = `r5c — Requirement5cards from the command line

USAGE
  r5c <command> [args] [--flags]

ACCOUNT
  signup --username <name> --email <addr> [--password <pw>]   Create an account (grants 50 /t26) and log in
  login  --username <name|email> [--password <pw>]            Log in (token saved to ~/.r5c/config.json)
  logout                                       Forget the saved token
  whoami                                       Show current user and balance
  balance                                      Show /t26 balance
  transactions                                 Show your /t26 ledger

CREATE A CARD  (r5c card create ... — mirrors the website's /create flow)
  card create begin                            Start the creation; shows your Rarity Value (free)
  card create regenerate-rarity                Gamble a fresh Rarity Value — climbing /t26 fee
  card create confirm-start [spec.json]        Pay the create fee, lock the rarity onto a PRIVATE draft
  card create update <id> <spec.json>          Shape the private draft (free, repeatable)
  card create preview <id> [--frames N] [--out <dir>]   Look at the draft: still PNGs (rest + orbit poses)
  card create publish <id> [--open] [--json]   Release the finished draft into the pool (free)
  card create status                           Where am I? Rarity Value, your drafts, balance
  card create sets                             List your sets (labels, blurbs, card counts)

OTHER CARD COMMANDS
  template [minimal|full]                      Print an example spec to start from
  get <id>                                     Fetch a card as JSON
  list [--mine]                                List community cards (or your own, drafts included)
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

const SPEC_HELP = `THE CARD SPEC (r5c card create confirm-start <spec.json>)

A spec describes a card's LOOK and its metadata. Its RARITY is not in the spec —
that's a server gamble (\`r5c card create begin\` / \`regenerate-rarity\`), locked
onto the card at confirm-start. Only "name" is required; add "image" for a real
card. Start from \`r5c template\`.

TOP LEVEL
  name        string    Card title. REQUIRED — publishing without one fails.
  info        string    Optional blurb about the card (max 280 chars)
  setName     string    Optional set to publish this card into. What you type is
                        the label; the server CANONICALIZES it and stores it
                        namespaced to you as <username>_<label>. The rule:
                        lowercased, spaces and underscores become dashes,
                        punctuation stripped, repeats collapsed. So
                        "Salt Marsh" -> salt-marsh, and the stored name is
                        alice_salt-marsh. Your original capitalisation is NOT
                        kept — the label is what's shown everywhere afterwards.
                        Because of that, "Deep Sea", "deep sea" and "DEEP_SEA"
                        are all the SAME set. Reuse a label to add to that set;
                        \`r5c card create sets\` lists the ones you have.
  setInfo     string    Optional blurb about the SET (max 280). Omit it and a set
                        you already have keeps the info it already had.
  tags        string[]  Search/discovery tags
  (tier / rarityScore are ignored if present — rarity comes from your Rarity
   Value gamble. Tier bands, for reference: common 0–.7, holo .7–.8,
   galaxy .8–.85, wowa .85–.9, ultra .9–.98, vmax .98–1)
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
    holoRevealMode       ${HOLO_REVEAL_MODES.join('|')}
                                    How the resting card opens into its holo state
    holoRevealDuration   0.05–3     Seconds for the activation reveal
    holoRevealEasing     ${HOLO_REVEAL_EASINGS.join('|')}
                                    The reveal's motion character
    holoRevealDirection  ${HOLO_REVEAL_DIRECTIONS.join('|')}
                                    Direction used by wipe (right = left-to-right)
    holoRevealSoftness   0–40       Feathered wipe edge, in percent
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
  - Rarity is a gamble: \`r5c card create begin\` gives a free Rarity Value for
    the next card; \`regenerate-rarity\` draws a fresh one for a climbing /t26 fee.
    \`confirm-start\` charges the (gentle) create fee and locks the rarity onto a
    private draft.
  - New accounts start with 50 /t26. You may spend into the red down to -1000
    (debt accrues 1.47%/day). When others save your card you earn a dividend.
  - The published card lives at <api-url>/card/<id>.
  - A "set" groups your published cards and is namespaced to your username, so it
    can never collide with another creator's. \`r5c card create sets\` lists yours.
  - Loop: card create begin → (regenerate-rarity to taste) → confirm-start card.json
    → preview <id> --out shots/ → look → update <id> card.json (free; rarity stays)
    → preview again → publish <id>.

TASTE
  This is the knob reference. For HOW to choose them — turning an image into a
  card that's subtly stunning rather than garish (the motion gloss, dark-image
  pitfalls, when to use each holo system, palette matching) — read
  cli/CARD_DESIGN.md. Do that before designing a card from real artwork.
`;

export const COMMAND_HELP = {
  spec: SPEC_HELP,
  card: `r5c card create <step> — the guided creation flow (mirrors the website)

  begin                      Start (or resume) the creation. Prints your Rarity
                             Value: the number, its tier, both prices, and your
                             balance. Free.
  regenerate-rarity          Gamble a fresh Rarity Value for a climbing /t26 fee.
  confirm-start [spec.json]  Accept the current Rarity Value: pays the create fee,
                             locks the rarity, and makes a PRIVATE draft card. An
                             optional spec seeds the draft's look.
  update <id> <spec.json>    Shape the private draft (free, repeatable). Honours
                             every spec field, including name/info/setName/setInfo.
  sets                       List your sets — labels, blurbs, and counts of the
                             PUBLISHED cards in each (private drafts don't count).
  preview <id> [--out dir]   Look at the draft: still PNGs (rest + orbit poses).
  publish <id> [--open]      Release the finished draft into the pool (free — the
                             create fee was paid at confirm-start).
  status                     Where am I? Rarity Value, your private drafts, balance.

Nobody sees the card until you publish. Rarity is a gamble, never a spec field.
regenerate-rarity and confirm-start spend /t26 (you may go to -1000 in debt).`,
  update: `r5c card create update <id> <spec.json> [--json]

Rebuilds a card YOU own from the spec file and replaces its LOOK and metadata —
name, info, set, tags, images, every visual parameter. Free, and the rarity does
NOT change (that was the gamble). Used to shape a private draft before publishing:

  r5c card create begin                        # see the Rarity Value
  r5c card create confirm-start card.json      # private draft (prints the id)
  r5c card create preview <id> --out shots/    # look at it
  # edit card.json...
  r5c card create update <id> card.json        # same draft, new look
  r5c card create preview <id> --out shots/    # look again (fresh frames)
  r5c card create publish <id>                 # release it`,
  preview: `r5c card create preview <id> [--frames N] [--out <dir>] [--json]

Captures still PNGs of the card — one at rest (holo dormant) and N-1 poses along
the tilt orbit with the holo awake — and prints their URLs. Works on a private
draft too (only you can see it). With --out the frames are downloaded as
<dir>/<id>_frameN.png, ready for an agent (or a human) to look at. N defaults to
4, max 8.

Much cheaper than \`r5c render\` and made for design iteration: confirm-start or
update, preview the frames, adjust the spec, update again. Frames re-capture
automatically after an update (the cache is keyed to the card's version).`,
  template: `r5c template [minimal|full]

Prints an example card spec as JSON, ready to save and edit:
  r5c template full > card.json

"minimal" (default) is the smallest useful spec; "full" demonstrates every
visual knob including all four holo effect systems. Reference: r5c help spec`,
  signup: `r5c signup --username <name> --email <addr> [--password <pw>]

Creates an account and stores the session token in ~/.r5c/config.json.
Username: 3-24 chars (letters, numbers, underscore). Email: required (kept
private, server-side only). Password: min 8 chars — prompted interactively if
omitted (or piped via stdin). Log in later with either the username or email.
New accounts are granted 50 /t26; regenerating the rarity and confirm-start
spend from it (you may go into the red down to -1000, which accrues 1.47%/day
interest).`,
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
