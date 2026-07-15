# r5c

Command-line client for [Requirement5cards](https://requirement5.com) —
create, publish, and render holographic trading cards from the terminal.

```bash
# install (either way)
curl -fsSL https://requirement5.com/install | sh
npm install -g @requirement5cards/r5c

# one-minute card
r5c signup --username your_name --email you@example.com
r5c template > card.json     # edit: point "image" at your artwork
r5c publish card.json        # prints your card's live URL
```

A card is described by a small JSON spec — name, tier, artwork path, and
optionally any of the visual systems (backgrounds, patterns, shine, borders,
and four holographic effect systems). Whatever you leave out gets the same
coherent defaults the web customizer produces.

- `r5c help` — all commands
- `r5c help spec` — the full card-spec reference, every knob and range
- `r5c template full` — a maximal example spec
- [CLI.md](https://github.com/vilt9/requirement5/blob/main/cli/CLI.md) —
  long-form docs, agent recipes, raw API notes

Built for automation: `--json` output on every command, non-interactive auth
via flags or `R5C_TOKEN`, exit code 1 with a self-explanatory message on any
failure. Zero dependencies; Node 18+.
