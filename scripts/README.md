# scripts

Dev-only helpers. Synthetic data only; never run against a production database.

- `showcase-data.ts` (`npm run showcase:data`): creates sample proposals/contracts, writes the two signed sample PDFs to `docs/showcase/` and the sample links to `$SHOWCASE_JSON` (default `/tmp/showcase.json`).
- `showcase-shots.mjs`: screenshots the sample pages/emails/staff screens into `docs/showcase/` (needs `npm start` running with `APP_ENV=development`, seeded dev users, and Playwright; run with `NODE_PATH=$(npm root -g)`).
  Then rebuild `docs/showcase/index.html` from the PNGs.
