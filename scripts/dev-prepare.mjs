// Dev builds only (see vercel-build.sh). After the database is migrated: set the permissions the live one has, and fill it with test data the first time.
import pg from "pg";
import { execSync } from "node:child_process";

const url = process.env.MIGRATE_DATABASE_URL;
const run = (cmd, env = {}) => execSync(cmd, { stdio: "inherit", env: { ...process.env, ...env } });

console.log("== permissions (same as live)");
run("npx prisma db execute --file docs/db/roles.sql");
run("npx prisma db execute --file docs/db/lock-down-data-api.sql");

const pool = new pg.Pool({ connectionString: url, max: 1, ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false } });
const { rows } = await pool.query('select count(*)::int as n from "Workspace"');
await pool.end();
if (rows[0].n === 0) {
  console.log("== empty database: adding test data");
  const env = { DATABASE_URL: url, APP_ENV: "staging" };
  run("npx tsx prisma/seed.ts", env);
  run("npx tsx scripts/showcase-data.ts", env);
} else console.log("== test data already there");
