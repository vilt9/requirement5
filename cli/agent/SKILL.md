---
name: r5c
description: Create, publish, preview, and update Requirement5 holographic trading cards from the terminal with the r5c CLI. Use when the user wants to make/publish/render an R5c card or mentions requirement5.com or "/t26".
---

# r5c — Requirement5 cards from the terminal

`r5c` is a CLI for requirement5.com. A card is a single JSON **spec** file: you
write it, publish it, and inspect the rendered result — no browser needed. The
CLI expands your spec into the full card the web customizer would produce, so
you only specify what you care about.

## Setup (once)

- Check it's installed: `r5c --version`. If missing: `npm install -g r5c`
  (or `curl -fsSL https://requirement5.com/install | sh` for a no-root install).
- Auth: `r5c whoami` shows the current login. If the user isn't logged in, ask
  them to run `r5c signup --username <name>` / `r5c login`, or to set
  `R5C_TOKEN`. Never invent credentials or sign up on their behalf.

## Learn the spec FIRST

Run `r5c help spec` and `r5c template full` before hand-writing a card. They are
the authoritative reference for every field, its range, and its default — do not
guess field names from memory.

A minimal spec:

```json
{ "name": "My card", "tier": "holo", "image": "./art.png" }
```

Only `tier` is required — one of `common | holo | galaxy | wowa | ultra | vmax`.
Everything omitted gets coherent defaults. Add a `card` object to override any
visual system (background, patterns, the holo effects, borders). `image` is a
local path or a URL.

## Workflow

1. Write `card.json` (start from `r5c template`).
2. `r5c publish card.json --json` → prints the card id and live URL. Costs 1–4 /t26.
3. `r5c preview <id> --out shots/` → writes PNG stills (one at rest, the others
   mid-orbit with the holo awake). **Open and look at these images** to judge it.
4. Edit the spec, then `r5c update <id> card.json` → redesigns the *same* card
   with no new stake.
5. Repeat 3–4 until it looks right. `r5c open <id>` shows it in the browser.

## Other commands

- `r5c list --mine` / `r5c collection` — your published cards / your saved cards
- `r5c get <id>` — full card record as JSON
- `r5c balance` / `r5c transactions` — /t26 balance and ledger
- `r5c render <id> --format gif|mp4` — a shareable animation
- Every command accepts `--json` for machine-readable output.

## Rules

- `r5c help spec` before writing fields — the spec is the source of truth.
- Confirm the user is authed before publishing; it spends /t26.
- Iterate with `update`, not fresh `publish` calls — each new card costs a stake.
- Keep the user in the loop before anything that spends currency.
