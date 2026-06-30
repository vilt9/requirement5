# R5c — Requirement5 cards

Holographic trading cards on the web. Generate a card, watch the holo react to
your cursor, save it to a collection, share a per-card URL, and export the moving
card as a GIF or MP4. A React + Vite SPA with an Express API.

Source-available — read it, run it, modify it, and contribute features. You may
use it for anything except building a competing product or service (see
[License](#license)).

## Stack

- **Frontend** — React 19, Vite 6, styled-components, react-router-dom 7, framer-motion.
  Cards render with DOM/CSS blend-modes + holo gradients (no canvas/WebGL).
- **API** — Express 4 (`server/`). Auth (JWT), cards, a small virtual economy
  (tiers, rarity, saves, dividends), and image storage (local disk or S3).
- **Storage** — JSON file store by default (`server/data/`); a Postgres adapter is
  stubbed. Images go to local disk (`server/uploads`) or S3 when configured.
- **Video export** — Playwright drives a chrome-free capture route through a
  deterministic tilt, then ffmpeg stitches frames into a GIF/MP4.

## Run locally

```bash
npm install
cp .env.example .env        # then edit as needed

npm run server              # API on :4000
npm run dev                 # SPA on :5173 (Vite)
```

Open the SPA URL Vite prints. For GIF/MP4 export you also need **ffmpeg** on your
PATH and a Playwright chromium install (`npx playwright install chromium`), and
`CAPTURE_BASE_URL` pointing at the running SPA.

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
