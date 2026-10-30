# Setting up the database on Supabase (manual steps for you)

**I have not touched any Supabase project.** Everything so far ran against a throwaway local Postgres 16 in my sandbox. This app uses Supabase purely as a Postgres host through Prisma. It does not use the Supabase client, Supabase Auth, Storage, Realtime or RLS. **Not yet tested on Supabase itself**; the SQL is plain Postgres and passed locally.

## 0. Use a separate project
Create a **new** Supabase project just for OneSimpleSite Manage (e.g. `oss-manage-prod`, plus `oss-manage-staging` later). Do not point this app at your other project: the migrations create ~30 tables in `public`.

## 1. Collect three connection strings (Project → Connect)
| Use | Which string | Goes in |
|---|---|---|
| Migrations | **Direct connection** (port 5432), user `postgres` | `MIGRATE_DATABASE_URL` (only on your laptop / CI, never the web host) |
| Web app | **Transaction pooler** (port 6543) using the `oss_app` user (step 3) | `DATABASE_URL` |
| Worker (pg-boss) | **Session pooler** or direct (port 5432) using `oss_app`... see note | `DATABASE_URL` for the worker process |

Note: pg-boss creates its own `pgboss` schema on first start, so the worker's role needs CREATE on the database for that first start. Simplest: start the worker once with the `postgres` direct URL, then switch it to `oss_app` and run `GRANT USAGE ON SCHEMA pgboss TO oss_app; GRANT ALL ON ALL TABLES IN SCHEMA pgboss TO oss_app;`.

## 2. Run the migrations (from this repo, on your machine)
```bash
cp .env.example .env
# edit .env: MIGRATE_DATABASE_URL=<direct postgres connection string>, DATABASE_URL=<same for now>
npm install
npx prisma migrate deploy
```
Expect "All migrations have been successfully applied" (7 migrations).

## 3. Create the restricted app user
Open **SQL Editor** in Supabase. Paste the contents of `docs/db/roles.sql`, replace `CHANGE_ME` with a long random password, run it. Then paste and run `docs/db/lock-down-data-api.sql` (stops the anon/authenticated API roles seeing any table). Build the runtime URL from the pooler string but with user `oss_app.<project-ref>` (Supabase poolers need the `user.projectref` form) and your new password.

## 4. Also in the Supabase dashboard
- Settings → API (Data API): turn it **off** if you can. This app never uses it.
- Database → Backups: confirm the plan's backup/PITR level covers "≤24h data loss". Note any plan limits.
- Do **not** create Storage buckets yet; file storage isn't built.

## 5. Environment variables for the web host (Vercel/Fly/etc.)
`DATABASE_URL` (oss_app, pooler), `MANAGE_ORIGIN`, `PORTAL_ORIGIN`, `APP_ENV=production`, `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), `RESEND_API_KEY`, `INTERNAL_NOTICE_TO=hello@onesimplesite.co.uk`, `TRUST_PROXY=1` only if behind your own proxy. The worker needs the same plus `DATABASE_URL`.
The worker must run as a separate long-running process (`npm run worker`); serverless alone won't run it.

## 6. First staff invitations
With `APP_ENV=production` run `npm run db:seed`. It creates Abukar/Farhan/Matthew as **pending** staff and prints one single-use invite path each (valid 7 days). Open `https://manage.<your domain>/invite/<token>` for each to set a password. Production seeding creates no demo users.

## If something fails
- `P1001/P1002` can't reach DB: you used the pooler for migrations. Use the direct string.
- `prepared statement ... already exists`: you used the transaction pooler with a driver that names statements; tell me and I'll switch the runtime to the session pooler.
- `permission denied`: roles.sql was run before the migrations, or on the wrong database. Re-run it.
