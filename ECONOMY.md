# The /t26 economy (Slash_T2.6)

The currency loop for Requirement5 cards. Single source of truth for the numbers is
`server/services/economy.js`; this document explains the design. The frontend reads
everything from `GET /api/economy/config` — no number below is duplicated in client code.

## The loop

```
                 +3 × tier        save: −4 × tier
   the cloud ──────────────▸ user ──────────────▸ 20% to the card's creator
       ▴        (generate)              │
       │                                ▾
       └──────────── 80% returns to the cloud
```

- Generating (drawing) a card yields /t26 — channeling imagination earns.
- Saving a card to your collection spends /t26.
- The card's creator receives a dividend on every save of their card.
- The bulk of every save returns to the cloud (the system treasury).

## Tiers

Rarity score ranges match the bands already used by the renderer.

| Tier        | Score range | Draw probability | Odds      | Multiplier |
|-------------|-------------|------------------|-----------|------------|
| Vmax rare   | 0.98 – 1.00 | 0.0005           | 1 : 2,000 | ×40        |
| Ultra rare  | 0.90 – 0.98 | 0.002            | 1 : 500   | ×18        |
| Wowa rare   | 0.85 – 0.90 | 1/220            | 1 : 220   | ×9         |
| Galaxy rare | 0.80 – 0.85 | 1/90             | 1 : 90    | ×5         |
| Holo rare   | 0.70 – 0.80 | 1/24             | 1 : 24    | ×2         |
| Common      | 0.00 – 0.70 | remainder ≈ 0.94 | —         | ×1         |

## Amounts

Amounts are **per-card and decoupled from rarity**. Every card rolls its own price
from its id: a bell-shaped roll mapped across a wide band on a log scale (most cards
land near the band's geometric middle; the tails are rare but real). Deterministic —
the same card id always prices the same, client and server agree exactly.

| Action            | Band            | Typical (median) |
|-------------------|-----------------|------------------|
| Generate yield    | 0.002 – 1.8     | ≈ 0.06           |
| Save cost         | 1.5 – 48        | ≈ 8.5            |
| Creator dividend  | 20% of the card's save cost | ≈ 1.7 |
| Publish stake     | 1 – 4 (rolled at publish)   | ≈ 2   |

Fixed amounts:

- Starting grant on signup: **50 /t26** (from the cloud).
- Daily yield cap: **100 /t26 per day** from generating. Past the cap you can keep
  drawing — draws are never blocked — but they yield 0 until the next day (UTC).

## Why these numbers hold up

- **Saving is a real decision.** The median save costs ~140 draws' worth of median
  yield. You cannot save everything you like; the collection means something. The
  starting grant funds the first few saves.
- **Rarity ≠ price is the point.** A rare-looking card can be cheap to claim — the
  diamond in the rough — and an ordinary card can carry a surprising price. Price is
  discovered per card, not read off a tier table.
- **The cloud is the main sink.** 80% of every save plus every publish stake leaves
  circulation. An engaged user who saves regularly is roughly currency-neutral; pure
  generators accumulate slowly up to the daily cap.
- **Hoarding is allowed.** Per the mission, recorded stocks of /t26 are a promise to be
  honoured in 2082. Erosion ("self correcting erosion of the Slash_T branch") is
  deliberately not implemented — it is suppressed on the R5c platform — but the ledger
  design (append-only transactions) leaves room to introduce it later if supply growth
  becomes a problem.

## Ledger

Append-only `transactions` collection; a user's balance is cached on the user row and
every transaction records `balance_after`. Transaction types:

- `grant` — signup grant from the cloud
- `draw_yield` — credit for generating (0 when past the daily cap)
- `save` — debit for saving a card
- `dividend` — credit to a card's creator when someone saves their card
- `publish_stake` — debit for publishing a card to the pool

All amounts are rounded to six decimal places (/t26 has a smallest unit of 0.000001).

## The draw

1. Roll a tier from the probability table (server-side).
2. If the pool has published cards in that tier, pick one uniformly at random.
3. If the pool has none in that tier, the server records a *synthetic* draw of that tier
   and the client renders a procedurally generated card whose rarity score is forced
   into the tier's range — the game is playable from day one with an empty pool.

Every draw and save updates the card's `times_drawn` / `times_saved`, and the per-card
statistics shown on the generate screen (draw weight, pool share, circulation,
dividend) come from these counters plus the tier table. Everything is exposed; the deep
game is the point.
