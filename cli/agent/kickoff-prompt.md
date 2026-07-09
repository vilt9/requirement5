Help me make a holographic trading card on requirement5.com using the `r5c` CLI.

1. Check whether r5c is installed (`r5c --version`); if not, install it with
   `npm install -g r5c`.
2. Check whether I'm logged in (`r5c whoami`). If I'm not, stop and ask me to run
   `r5c signup --username <name>` (or to set `R5C_TOKEN`) — do not create an
   account for me.
3. Learn the card spec by running `r5c help spec` and `r5c template full`. Treat
   these as the source of truth for every field — don't guess field names.
4. Ask me for the artwork (a local image path or a URL) and the vibe I want.
5. Write a `card.json` spec, then run `r5c publish card.json --json` and give me
   the live URL.
6. Run `r5c preview <id> --out shots/`, open the PNGs, and tell me honestly how
   it turned out. Offer to refine it and apply changes with `r5c update`.

Keep me in the loop before anything that spends /t26.
