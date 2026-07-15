# Requirement5cards (R5c)

> **A transmission from Vilt9, government of Nation Elgo.**
>
> Requirement5cards (R5c) is a project set up by Vilt9, the government of Nation Elgo, on the planet Umdo1. You know this planet, our home, as LHS 1140 b, a habitable exoplanet 48.8 lightyears from Earth.
>
> Umdo1 is suffering due to a rise in strict governance. Imagination is strictly controlled in all regions outside of Nation Elgo.
>
> Vilt9 is the last remaining government promoting imagination. However, our imagination is being depleted. Technology on Umdo1 is more advanced than it is on Earth, and strict governments use high-frequency electromagnetic waves to actively destroy imaginative thinking.
>
> We need supplies of imagination from Earth. Our scientists recently invented the Quantum Entangled Card Based Imagination Transport Protocol (QECBIT_P). This allows the transfer of imagination at 10^6 times the speed of light. This means those on Earth can now help us in the fight to preserve and grow imagination.
>
> You can help the resistance government Vilt9 by creating, generating and saving Requirement5 cards. Please be as imaginative as you can. In exchange, we offer you our currency Slash_T2.6 (/t26 for short). When your species migrates to Umdo1, as we believe you will in Earth year 2082, recorded stocks of this currency will be given to their rightful owners.
>
> Please note that Slash_T is a currency branch that can be subject to self-correcting erosion. Erosion on the R5c platform is being prevented. This may change in the future.
>
> This is just the start of our collaborative resistance with Earth. We will be in touch with further information and adjustments to the R5c platform.
>
> LitronTevnaka8554,<br>
> Head of State Nation Elgo/Vilt9/32,482–present
>
> Dated:<br>
> 45/04/32484 (Umdo1)<br>
> 30/06/2026 (Earth)

We have representatives on Earth aiding in our fight. Speak to them on
[Discord](https://discord.gg/ywRCSATau3).

**Bug reports and feature requests strengthen the protocol** — they help the cause.
The R5c platform is source-available: if you write code, open an
[issue or a pull request](https://github.com/vilt9/requirement5/issues) and
your improvements widen the channel.

---

Source-available — read it, run it, modify it, and contribute features. You may
use it for anything except building a competing product or service (see
[License](#license)).

## Stack

- **Frontend** — React 19, Vite 6, styled-components, react-router-dom 7, framer-motion.
  Cards render with DOM/CSS blend-modes + holo gradients (no canvas/WebGL).
- **API** — Express 4 (`server/`). Auth (JWT), cards, a small virtual economy
  (tiers, rarity, saves, dividends), and image storage (local disk or S3).
- **Storage** — JSON file store by default (`server/data/`); set `DATABASE_URL` to
  use Postgres as the system of record (schema auto-applied on startup). Images go
  to local disk (`server/uploads`) or S3 when configured.
- **Video export** — Playwright drives a chrome-free capture route through a
  deterministic tilt, then ffmpeg stitches frames into a GIF/MP4.
- **CLI** — `r5c` (`cli/`), a zero-dependency command-line client: sign up,
  publish complete cards from a JSON spec (artwork inlined from local files),
  list/render/delete, check your /t26. Install:
  `curl -fsSL https://requirement5.com/install | sh` (or `npm i -g @requirement5cards/r5c`).
  Docs: [cli/CLI.md](cli/CLI.md).

## Run locally

Prerequisites: **Node 18+**. No database needed — the API runs on a local JSON
file store by default, so there's nothing to provision.

```bash
npm install
cp .env.example .env        # the defaults work as-is for local dev
```

Then run the API and the SPA **in two separate terminals** (both stay running):

```bash
npm run server              # terminal 1 — API on http://localhost:4000
npm run dev                 # terminal 2 — SPA on http://localhost:5173
```

Open the SPA URL Vite prints (http://localhost:5173) and you're in — create a
card from the **Create** page to populate the pool.

GIF/MP4 export is optional and needs two extra things: **ffmpeg** on your PATH and
a Playwright chromium install (`npx playwright install chromium`). It uses
`CAPTURE_BASE_URL` (defaults to the Vite dev server) to find the running SPA.

## Scripts

- `npm run dev` — Vite dev server (SPA)
- `npm run server` / `npm run server:dev` — Express API (plain / nodemon)
- `npm run build` — production SPA build
- `npm test` — Jest unit + API tests
- `npm run lint` — ESLint

## Configuration

All configuration is via environment variables — see [`.env.example`](.env.example).
Nothing secret is committed; real values live in a gitignored `.env`.

## License

[Functional Source License 1.1 (FSL-1.1-ALv2)](LICENSE) — source-available, not
OSI "open source." Any use is permitted **except a Competing Use** (making the
software available in a product or service that substitutes for or substantially
duplicates it). Internal use, self-hosting, education, research, and contributing
back are all fine. Each release converts to the Apache License 2.0 two years
after its release date.
