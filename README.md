# OneSimpleSite Manage

Original internal operations app (staff, "Manage") and customer portal ("Client Portal") for OneSimpleSite.
Next.js App Router + TypeScript, PostgreSQL + Prisma, Better Auth, pg-boss worker, React Email, Tailwind.

## Where things are
```
src/app/          routes: (staff) manage host · portal/* portal host · p/ s/ public proposal & signing · api/auth
src/modules/      domain services by area: identity crm sales contracts signing projects calendar notes outbox portal
src/emails/       React Email layout + templates      src/components/  shared UI
src/lib/          env, db, auth, audit/outbox, mail, tokens
prisma/           schema, migrations (incl. raw-SQL integrity), seed
workers/          background worker (npm run worker)
tests/            domain/DB tests (vitest) and tests/e2e browser journey
scripts/          dev-only showcase generators        brand/  logo pack + manifest
docs/             see docs/README.md
```
Start with `docs/reference/IMPLEMENTATION-STATUS.md` (what works, what is unconnected) and `docs/setup/SETUP-AND-ACCEPTANCE.md`.

## Local run
```bash
cp .env.example .env            # fill placeholders
npm install
npx prisma migrate deploy && npx prisma generate
APP_ENV=development npm run db:seed
npm run build && npm start      # http://manage.localhost:3000 and http://portal.localhost:3000
npm run worker                  # separate process; local mail sink writes .mail-sink/
```
Checks: `npm run typecheck` · `npm test` · `npm run e2e` (needs a running server; `NODE_PATH=$(npm root -g)`).
