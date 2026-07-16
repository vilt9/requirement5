---
name: r5c
description: Create, publish, preview, and update Requirement5 holographic trading cards from the terminal with the r5c CLI. Use when the user wants to make/publish/render an R5c card or mentions requirement5.com or "/t26".
---

# r5c — Requirement5cards from the terminal

`r5c` is a CLI for requirement5.com. A card is a single JSON **spec** file: you
write it, shape a private draft, look at the rendered result, and release it —
no browser needed. The CLI expands your spec into the full card the web
customizer would produce, so you only specify what you care about.

## Setup (once)

- Check it's installed: `r5c --version`. If missing: `npm install -g r5c`
  (or `curl -fsSL https://requirement5.com/install | sh` for a no-root install).
- Auth: `r5c whoami` shows the current login. If the user isn't logged in, ask
  them to run `r5c signup --username <name> --email <addr>` / `r5c login`, or to set
  `R5C_TOKEN`. Never invent credentials or sign up on their behalf.
- **The login lives in one global file (`~/.r5c/config.json`), not in your
  shell.** Anything else that logs in on this machine — another agent, another
  terminal, the user themselves — silently changes who *you* are, mid-run. The
  failure is silent: your spend and your draft land on the other account.
  If that's a risk, pin the identity by exporting `R5C_TOKEN` (it bypasses the
  file) and re-check `r5c whoami` before anything that spends.

## The creation flow — `r5c card create ...`

Creating a card mirrors the website's /create flow exactly. It is a small
guided session:

1. **`r5c card create begin`** — start (or resume) the creation. Returns your
   **Rarity Value**: the number and its tier, plus the two prices and your
   balance. Free.
2. **`r5c card create regenerate-rarity`** — gamble for a fresh Rarity Value for
   a **climbing /t26 fee** (the gambling tax). Confirm with the user first.
3. **`r5c card create confirm-start [card.json]`** — accept the current Rarity
   Value: pays the (gentle) **create fee**, locks the rarity, and makes a
   **private draft** card. An optional spec seeds the draft's look.
4. **`r5c card create update <id> card.json`** — shape the private draft. Free,
   as often as you like, rarity unchanged.
5. **`r5c card create preview <id> --out shots/`** — writes PNG stills of the
   draft (one at rest, the rest mid-orbit with the holo awake). **Open and look
   at these** to judge it. Nobody else can see the draft.
6. **`r5c card create publish <id>`** — release the finished draft into the
   pool. Free — the create fee was already paid at confirm-start.

`r5c card create status` shows where you are at any point: the current Rarity
Value, your private drafts, and your balance.

## Rarity is a gamble, not a choice

A card's rarity is **server-assigned**, not a spec field. You cannot pick the
tier — you gamble for it. A tier is a band of the Rarity Value (Fine is
0.9–0.98, and so on), so the band's width is how often it comes up. Surface the
Rarity Value and its tier, and let the user decide whether to
`regenerate-rarity` (which spends /t26). Never promise a specific tier, and
don't quote odds the CLI doesn't give you. The spec only describes the **look**.

## Learn the spec FIRST

Run `r5c help spec` and `r5c template full` before hand-writing a card. They are
the authoritative reference for every field, its range, and its default — do not
guess field names from memory.

A minimal spec (`name` is the only required field — rarity is never in the spec):

```json
{ "name": "My card", "image": "./art.png" }
```

Everything omitted gets coherent defaults. Add a `card` object to override any
visual system (background, patterns, the holo effects, borders). `image` is a
local path or a URL.

### Card metadata and sets

Besides `name`, a spec carries optional `info` (a blurb about the card),
`setName`, and `setInfo`. A **set** groups the user's published cards.

**The server canonicalizes the set label** — lowercased, spaces and underscores
become dashes, punctuation stripped — and namespaces it under their username:
`"Salt Marsh"` is stored as `alice_salt-marsh` and displays as `salt-marsh`.
Send the plain label; never write the namespaced form yourself. Two consequences
worth telling the user about:

- Their capitalisation is not preserved. If they ask for "Weather Machines",
  what they get back everywhere afterwards is `weather-machines`.
- `"Deep Sea"`, `"deep sea"` and `"DEEP_SEA"` are all the same set — which is
  what stops near-duplicates, but also means a set can't be renamed by re-casing.

Before inventing a set name, run `r5c card create sets` and prefer a label the
user already has. It lists each set's label, blurb, and how many **published**
cards it holds — a private draft doesn't count until you publish it.

`setInfo` is sticky: an existing set keeps its blurb unless you pass a new one.
`update` honours the whole spec, so you can fix a draft's name, info, or set
before publishing. Ask the user before putting a card in a set — it's their
shelf, not yours.

## Other commands

- `r5c list --mine` / `r5c collection` — your cards (drafts included) / your saved cards
- `r5c get <id>` — full card record as JSON
- `r5c balance` / `r5c transactions` — /t26 balance and ledger
- `r5c render <id> --format gif|mp4` — a shareable animation
- Every command accepts `--json` for machine-readable output.

## Rules

- `r5c help spec` before writing fields — the spec is the source of truth.
- Rarity comes from `card create begin` / `regenerate-rarity`, never the spec. Don't set tier.
- Confirm the user is authed before anything that spends /t26.
- `regenerate-rarity` and `confirm-start` both spend /t26 — confirm before each.
- Design happens on the **private draft** (`update` / `preview`); publishing just
  releases it. Nobody sees the card until you `publish`.
- Balances may go into the red down to **−1000 /t26** (1.47%/day interest, compounding).
  Keep the user in the loop before anything that spends currency.
