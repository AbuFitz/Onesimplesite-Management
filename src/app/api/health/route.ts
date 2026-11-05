import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

/**
 * "Is what is live actually healthy?" Public, and it tells nothing private.
 * It reads one row from every table the code knows about, using every column the code expects. If the live database is missing a
 * column the live code needs (a deploy went out before its database change), or the app has lost access to a table, this says so by name
 * instead of someone finding out by clicking around. Run it after every deploy: `npm run smoke`.
 */
export async function GET() {
  const problems: { table: string; issue: string }[] = [];
  const models = Object.keys(Prisma.ModelName);
  const client = db as unknown as Record<string, { findFirst: (a: object) => Promise<unknown> }>;
  await Promise.all(models.map(async (name) => {
    const accessor = name.charAt(0).toLowerCase() + name.slice(1);
    try { await client[accessor]?.findFirst({}); }
    catch (e) { const m = e instanceof Error ? e.message : String(e); problems.push({ table: name, issue: /DatabaseNotReachable|ECONNREFUSED|P1001|P1017|timed out/i.test(m) ? "database is not reachable" : /column|does not exist|P2022/i.test(m) ? "database is missing a column this version needs" : /permission denied/i.test(m) ? "no permission" : "could not be read" }); }
  }));
  const ok = problems.length === 0;
  return Response.json({ ok, version: (process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7), checkedTables: models.length, problems }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
