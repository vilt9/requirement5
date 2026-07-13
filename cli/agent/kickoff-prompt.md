Help me make a holographic trading card on requirement5.com using the `r5c` CLI.

1. Check whether r5c is installed (`r5c --version`); if not, install it with
   `npm install -g r5c`.
2. Check whether I'm logged in (`r5c whoami`). If I'm not, stop and ask me to run
   `r5c signup --username <name> --email <addr>` (or to set `R5C_TOKEN`) — do not create an
   account for me.
3. Learn the card spec by running `r5c help spec` and `r5c template full`. Treat
   these as the source of truth for every field — don't guess field names. Note
   the spec is the card's LOOK only; rarity is a separate roll.
4. Run `r5c roll` and tell me the rolled rarity. Rarity is a gamble, not a
   choice — `r5c reroll` draws a fresh one for a climbing /t26 fee. Ask me
   before rerolling; don't spend on it without my say-so.
5. Ask me for the artwork (a local image path or a URL) and the vibe I want.
6. Write a `card.json` spec (look only, no tier), then run
   `r5c publish card.json --json` (publishes at the rolled rarity, charges the
   create fee) and give me the live URL.
7. Run `r5c preview <id> --out shots/`, open the PNGs, and tell me honestly how
   it turned out. Offer to refine the look with `r5c update` (free; rarity stays).

Keep me in the loop before anything that spends /t26 (rerolls and publishing do).
