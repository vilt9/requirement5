---
tags:
  - "economy"
---
# The /t26 economy (Slash_T2.6)

The currency loop for Requirement5 cards. Single source of truth for the numbers is
`server/services/economy.js`; this document explains the design. The frontend reads
everything from `GET /api/economy/config` — no number below is duplicated in client code.

## The loop

```
                 draw yield        save cost
   the cloud ──────────────▸ user ──────────────▸ 70% to the card's creator
       ▴        (generate)              │
       │                                ▾
       └──────────── 30% returns to the cloud
```

- Generating (drawing) a card yields /t26 — channeling imagination earns.
- Saving a card to your collection spends /t26.
- The card's creator receives a dividend on every save of their card: 70% of the
  price paid (`ECONOMY.DIVIDEND_RATE`), uncapped.
- The remainder of every save returns to the cloud (the system treasury).

Neither side of the loop scales with tier: yields and prices are **per-card**,
seeded from the card's id (see Amounts).

## Tiers

Rarity score ranges match the bands already used by the renderer.

A tier **is** a band of the rarity score, and nothing more. Creation draws a
uniform value in 0–1 (`rollRarity`) and the band it lands in is the tier — so a
tier's frequency is exactly its band width, and there is no separate probability
to keep in sync.

| Tier        | Score range | Band width (how often) |
|-------------|-------------|------------------------|
| Vmax rare   | 0.98 – 1.00 | 2%                     |
| Ultra rare  | 0.90 – 0.98 | 8%                     |
| Wowa rare   | 0.85 – 0.90 | 5%                     |
| Galaxy rare | 0.80 – 0.85 | 5%                     |
| Holo rare   | 0.70 – 0.80 | 10%                    |
| Common      | 0.00 – 0.70 | 70%                    |

> Tiers once also carried a hardcoded `probability` (0.002 for Ultra, etc.) that
> no live code read, yet a user-facing "appears at 1 : N" label was derived from
> it — claiming Ultra was 1 : 500 when the band makes it 1 : 12.5. The field, the
> label, and `rollTier()` have all been removed. Don't reintroduce a frequency
> that isn't derived from `scoreRange`.
>
> A tier still carries a `multiplier` (×40 down to ×1), and the API still ships
> it, but **nothing reads it**: it dates from when price scaled with tier, and
> prices have since become per-card. Treat it as vestigial.

## Amounts

Amounts are **per-card**. Every card gets its own price from its id: a bell-shaped
draw mapped across a wide band on a log scale (most cards land near the band's
geometric middle; the tails are rare but real). Deterministic — the same card id
always prices the same, and client and server agree exactly.

| Action            | Band            | Typical (median) |
|-------------------|-----------------|------------------|
| Generate yield    | 0.01 – 0.35     | ≈ 0.06           |
| Save cost         | 1.5 – 48        | ≈ 5.0            |
| Creator dividend  | 70% of the card's save cost | ≈ 3.5 |

Rarity doesn't *set* a price, but it isn't irrelevant either: it slides the
**centre** of the band the draw happens around (`priceCentre`), so rarer cards
trend expensive while the ranges keep overlapping — a lucky Common can outprice
an unlucky Fine. The medians above are across all rarities; a single card's
spread is much narrower and sits wherever its rarity put the centre.

Creating a card costs too, and those fees climb rather than sitting in a band:

| Action                          | Cost                                        |
|---------------------------------|---------------------------------------------|
| `card create begin`             | free                                        |
| `regenerate-rarity`             | 1 + 1.00 × regenerations so far, + a seeded fraction |
| `confirm-start` (the create fee)| 2 + 0.20 × regenerations so far, + a seeded fraction |
| publish                         | free — the create fee was paid at confirm-start |

Regenerating climbs steeply and creating climbs gently, so fishing for a rare
value costs you at the gamble, not at the mint.

Fixed amounts:

- Starting grant on signup: **250 /t26** (from the cloud).
- Overdraft: you may spend into the red down to **−1000 /t26** (`DEBT_FLOOR`); at
  the floor, spending stops. A negative balance accrues **1.47%/day**, compounded
  daily (`DEBT_INTEREST_DAILY`).

> There is **no publish stake**. `PRICE_BANDS.publishStake` (1 – 4) and
> `rollPublishStake()` still exist and the API still ships the band, but nothing
> ever charges it — only tests call it. This is the same shape of trap as the old
> `probability` field: a live-looking constant that once drove user-facing copy
> claiming publishing cost 1 – 4 /t26. Publishing is free.
>
> There is also **no daily yield cap** — it was removed. Draws always yield.

## Why these numbers hold up

- **Saving is a real decision.** The median save (~5 /t26) costs about **85 draws'**
  worth of median yield (~0.06). You cannot save everything you like; the
  collection means something. The starting grant funds the first few saves.
- **Rarity ≠ price is the point.** A rare-looking card can be cheap to claim — the
  diamond in the rough — and an ordinary card can carry a surprising price. Price is
  discovered per card, not read off a tier table.
- **The cloud is the main sink.** 30% of every save leaves circulation, alongside
  the create and regenerate fees. The creator's 70% stays in circulation — it moves
  between users rather than draining — so the sink is thinner than the loop diagram
  alone suggests, and the create/regenerate fees do real work.
- **Hoarding is allowed.** Per the mission, recorded stocks of /t26 are a promise to be
  honoured in 2082. Erosion ("self correcting erosion of the Slash_T branch") is
  deliberately not implemented — it is suppressed on the R5c platform — but the ledger
  design (append-only transactions) leaves room to introduce it later if supply growth
  becomes a problem.

## Ledger

Append-only `transactions` collection; a user's balance is cached on the user row and
every transaction records `balance_after`. Transaction types:

- `grant` — signup grant from the cloud
- `draw_yield` — credit for generating
- `claimed_yield` — credit for the stash a logged-out visitor earned, banked on
  signup/login (capped by `STASH_CLAIM_CAP`)
- `save` — debit for saving a card
- `dividend` — credit to a card's creator when someone saves their card
- `create_stake` — debit for the create fee, charged once at `confirm-start`
- `reroll` — debit for regenerating a Rarity Value
- `interest` — debit accrued daily on a negative balance
- `topup` — credit for a /t26 bundle bought through Stripe

There is no `publish_stake` transaction: nothing issues one. (A stale label for it
still sits in the Account page's type→label map.)

All amounts are rounded to six decimal places (/t26 has a smallest unit of 0.000001).

## The draw

1. A fixed share of draws (`SYNTHETIC_DRAW_SHARE`) is *synthetic* by design, so
   generating stays generative however big the pool gets.
2. Otherwise, pick a published card from the pool weighted by rarity
   (`e^(-8·rarity)`), normalised over whatever is currently published — so a
   rarer card surfaces less, and a newly published card just joins the lottery.
3. If the pool is empty, the draw is synthetic too: the client renders a
   procedurally generated card — the game is playable from day one.

Every draw and save updates the card's `times_drawn` / `times_saved`, and the per-card
statistics shown on the generate screen (pool share, circulation,
dividend) come from these counters plus the tier table. Everything is exposed; the deep
game is the point.
