// Dev builds only (see vercel-build.sh). After the database is migrated: set the permissions the live one has, and fill it with test data the first time.
import pg from "pg";
import { execSync } from "node:child_process";

const url = process.env.MIGRATE_DATABASE_URL;
const run = (cmd, env = {}) => execSync(cmd, { stdio: "inherit", env: { ...process.env, ...env } });

console.log("== permissions (same as live)");
run("npx prisma db execute --file docs/db/roles.sql");
run("npx prisma db execute --file docs/db/lock-down-data-api.sql");

const ssl = (u) => (/localhost|127\.0\.0\.1/.test(u) ? undefined : { rejectUnauthorized: false });
// A dev-only place for emails the test sink "sends" (see src/lib/dev-mail.ts). Its own schema, so it is never part of the app or the public API.
{
  const p = new pg.Pool({ connectionString: url, max: 1, ssl: ssl(url) });
  await p.query(`create schema if not exists dev_tools;
    create table if not exists dev_tools.mail_sink (id uuid primary key, created_at timestamptz not null default now(), mail jsonb not null);
    grant usage on schema dev_tools to oss_app;
    grant select, insert, delete on dev_tools.mail_sink to oss_app;`);
  await p.end();
}

const pool = new pg.Pool({ connectionString: url, max: 1, ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false } });
const { rows } = await pool.query('select count(*)::int as n from "Workspace"');
await pool.end();
if (rows[0].n === 0) {
  console.log("== empty database: adding test data");
  const env = { DATABASE_URL: url, APP_ENV: "staging" };
  run("npx tsx prisma/seed.ts", env);
  run("npx tsx scripts/showcase-data.ts", env);
} else console.log("== test data already there");
console.log("== dev logins");
run("npx tsx scripts/dev-accounts.ts", { DATABASE_URL: url, APP_ENV: "staging" });
