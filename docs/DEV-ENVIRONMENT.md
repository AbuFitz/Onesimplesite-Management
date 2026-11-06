# Dev environment

Two separate worlds, so nothing is ever tried on live.

| | **Live** | **Dev** |
|---|---|---|
| Team app | manage.onesimplesite.co.uk | manage.dev.onesimplesite.co.uk (`dev.onesimplesite.co.uk` redirects here) |
| Customer portal | portal.onesimplesite.co.uk | portal.dev.onesimplesite.co.uk |
| Database | Supabase "OneSimpleSite's Project" | Supabase "onesimplesite-dev" (fake data only) |
| Runs from | the production deploy you start in Vercel | the working branch, automatically on every push |
| Payments | real Stripe | Stripe **test mode** only |
| Email | real Resend | only to addresses in `MAIL_ALLOWLIST`, or kept unsent |
| Accounts | real people | fake: demo.owner@example.test, demo.delivery@example.test, client.a@example.test, client.b@example.test (password = `DEMO_PASSWORD` in Vercel) |

A yellow **DEV SITE · test data only · not live** strip and a **[DEV]** tab title make dev impossible to mistake for live.

## How dev stays away from live

- Dev has its own database, its own secrets and its own settings. Every dev setting in Vercel is limited to the dev branch.
- The app **refuses to start** if a non-live site is pointed at the live database (or the live site at the dev one): `src/lib/db-guard.ts`, covered by tests.
- The dev build step (`scripts/vercel-build.sh`) migrates the dev database and adds test data, and **refuses** if either database address contains the live project id.

## What a dev build does

Every push to the working branch builds the dev site. Because `DEV_AUTO_MIGRATE=1` is set for that branch, the build first runs `prisma migrate deploy` on the dev database, sets the database permissions to match live (`docs/db/roles.sql`), and adds the fake test data if the database is empty. So a new database change is tested on dev **before** it ever goes near live.

## One-off setup (already done except the secrets)

1. Supabase project `onesimplesite-dev` (done). Create the app login: in its SQL editor run `CREATE ROLE oss_app LOGIN PASSWORD '<choose one>';`
2. In Vercel, Settings, Environment Variables, add these for **Preview**, **branch `claude/bold-thompson-p6yykh`** (the dev branch), type Sensitive unless noted:
   - `DATABASE_URL` = session pooler address with the `oss_app.<project id>` user and its password
   - `MIGRATE_DATABASE_URL` = session pooler address with the `postgres.<project id>` user and the database password
   - `BETTER_AUTH_SECRET`, `CRON_SECRET` = new random values (`openssl rand -base64 32`), never the live ones
   - `DEMO_PASSWORD` (type Plain) = the password for the fake accounts
   - `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` = **test-mode** keys only (optional until you test payments)
   - `RESEND_API_KEY` (optional) = lets dev send email, but only to `MAIL_ALLOWLIST`
   - last: `DEV_AUTO_MIGRATE` = `1` (turns on the automatic dev database update)
3. DNS at GoDaddy: three CNAME records `dev`, `manage.dev`, `portal.dev` pointing to `cname.vercel-dns.com`.

## Day to day

1. Work and push to the working branch. Dev updates itself.
2. Test on dev (`MANAGE=https://manage.dev.onesimplesite.co.uk PORTAL=https://portal.dev.onesimplesite.co.uk npm run smoke`).
3. Only when dev is right: apply any database change to live (see DEPLOYING.md), then redeploy to production in Vercel.

Never use **Promote to Production** on a dev deployment. It would carry dev's settings. Always **Redeploy** to production so it is rebuilt with live's settings.
