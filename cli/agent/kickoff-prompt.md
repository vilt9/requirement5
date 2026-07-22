Help me make a holographic trading card on requirement5.com using the `r5c` CLI.

1. Check whether r5c is installed (`r5c --version`); if not, install it with
   `curl -fsSL https://requirement5.com/install | sh` (or
   `npm install -g @requirement5cards/r5c`).
2. Check whether I'm logged in (`r5c whoami`). If I'm not, stop and ask me to run
   `r5c signup --username <name> --email <addr>` (or to set `R5C_TOKEN`) — do not create an
   account for me.
3. Learn the card spec by running `r5c help spec` and `r5c template full`. Treat
   these as the source of truth for every field — don't guess field names. Note
   the spec is the card's LOOK plus its metadata (`name` is required; `info`,
   `setName`, `setInfo` are optional); rarity is a separate gamble.
4. Run `r5c card create begin` and tell me the Rarity Value it returns and the
   tier it lands in. Rarity is a gamble, not a choice —
   `r5c card create regenerate-rarity` draws a fresh one for a climbing /t26 fee.
   Ask me before regenerating; don't spend on it without my say-so.
5. Ask me for the artwork (a local image path or a URL), the vibe I want, and a
   name for the card (required). Ask whether it belongs in a set — run
   `r5c card create sets` to see the ones I already have, and reuse a label
   rather than inventing a near-duplicate.
6. When I'm happy with the rarity, run `r5c card create confirm-start card.json`
   (this pays the create fee and makes a PRIVATE draft — the spec carries the look
   and the metadata, never a tier).
7. Run `r5c card create preview <id> --out shots/`, open the PNGs, and tell me
   honestly how it turned out. Refine the private draft with
   `r5c card create update <id> card.json` (free; rarity stays) until it's right —
   nobody else can see it yet. Design the transition as well as the endpoints:
   choose `holoRevealMode`, duration, easing, and any wipe direction/softness
   from `r5c help spec` so activation follows the image's own visual logic.
8. When I say go, `r5c card create publish <id>` to release it into the pool, and
   give me the live URL.

Keep me in the loop before anything that spends /t26 (regenerating and
confirm-start do; you can go up to −1000 /t26 in debt).
