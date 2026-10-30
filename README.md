# OneSimpleSite Manage

Original internal operations app (staff, "Manage") and customer portal ("Client Portal") for OneSimpleSite.
Next.js App Router + TypeScript, PostgreSQL + Prisma, Better Auth, pg-boss worker, Tailwind. No Documenso code is used.
See `docs/IMPLEMENTATION-STATUS.md` for exactly what works, what is unconnected and what is deferred.

## Local run
```bash
cp .env.example .env            # then fill placeholders (see docs/SETUP-AND-ACCEPTANCE.md)
npm install
npx prisma migrate deploy && npx prisma generate
APP_ENV=development npm run db:seed   # synthetic data + dev accounts
npm run build && npm start            # http://manage.localhost:3000 and http://portal.localhost:3000
npm run worker                        # separate process: drains the outbox (local mail sink writes .mail-sink/)
```
Checks: `npm run typecheck`, `npm test` (domain/DB tests), `NODE_PATH=$(npm root -g) node tests/e2e/journey.mjs` (browser journey against a running server).
