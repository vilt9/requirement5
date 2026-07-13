---
name: r5c
description: Create, publish, preview, and update Requirement5 holographic trading cards from the terminal with the r5c CLI. Use when the user wants to make/publish/render an R5c card or mentions requirement5.com or "/t26".
---

# r5c — Requirement5cards from the terminal

`r5c` is a CLI for requirement5.com. A card is a single JSON **spec** file: you
write it, publish it, and inspect the rendered result — no browser needed. The
CLI expands your spec into the full card the web customizer would produce, so
you only specify what you care about.

## Setup (once)

- Check it's installed: `r5c --version`. If missing: `npm install -g r5c`
  (or `curl -fsSL https://requirement5.com/install | sh` for a no-root install).
- Auth: `r5c whoami` shows the current login. If the user isn't logged in, ask
  them to run `r5c signup --username <name> --email <addr>` / `r5c login`, or to set
  `R5C_TOKEN`. Never invent credentials or sign up on their behalf.

## Rarity is a gamble, not a choice

A card's rarity is a **server roll**, not a spec field. You cannot pick the
tier — you roll for it.

- `r5c roll` → your free rarity for the next card (idempotent — one per card).
- `r5c reroll` → draws a fresh rarity for a climbing /t26 fee (the gambling tax).
- Publishing stamps the current roll onto the card and charges the (gentle)
  create fee. The spec only describes the **look**.

Never promise the user a specific tier — surface the rolled number and let them
decide whether to reroll (which spends /t26).

## Learn the spec FIRST

Run `r5c help spec` and `r5c template full` before hand-writing a card. They are
the authoritative reference for every field, its range, and its default — do not
guess field names from memory.

A minimal spec (look only — no tier/rarity):

```json
{ "name": "My card", "image": "./art.png" }
```

Everything omitted gets coherent defaults. Add a `card` object to override any
visual system (background, patterns, the holo effects, borders). `image` is a
local path or a URL.

## Workflow

1. `r5c roll` → see the rolled rarity. `r5c reroll` to gamble (spends /t26) —
   confirm with the user before rerolling.
2. Write `card.json` (start from `r5c template`) — the look only.
3. `r5c publish card.json --json` → publishes at the rolled rarity; prints the
   card id + URL. Charges the create fee.
4. `r5c preview <id> --out shots/` → writes PNG stills (one at rest, the others
   mid-orbit with the holo awake). **Open and look at these images** to judge it.
5. Edit the spec, then `r5c update <id> card.json` → redesigns the *same* card,
   free, rarity unchanged.
6. Repeat 4–5 until it looks right. `r5c open <id>` shows it in the browser.

## Other commands

- `r5c list --mine` / `r5c collection` — your published cards / your saved cards
- `r5c get <id>` — full card record as JSON
- `r5c balance` / `r5c transactions` — /t26 balance and ledger
- `r5c render <id> --format gif|mp4` — a shareable animation
- Every command accepts `--json` for machine-readable output.

## Rules

- `r5c help spec` before writing fields — the spec is the source of truth.
- Rarity comes from `r5c roll` / `reroll`, never the spec. Don't set tier.
- Confirm the user is authed before rerolling or publishing; both spend /t26.
- `reroll` costs a climbing fee — always confirm before spending it.
- Iterate the LOOK with `update`, not fresh `publish` calls (a new card needs a
  new roll + create fee).
- Balances may go into the red down to -1000 /t26 (1.47%/day interest). Keep the
  user in the loop before anything that spends currency.
