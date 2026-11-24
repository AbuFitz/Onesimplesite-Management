import { db } from '@/lib/db';
import { allManagementLaunchChecksPass, managementLaunchChecks } from '@/lib/launch-readiness';

export const dynamic = 'force-dynamic';

/** Launch evidence for operators and monitors. Returns booleans only—never configuration or credentials. */
export async function GET() {
  const providers = managementLaunchChecks();
  let database = false;
  try { await db.$queryRaw`select 1`; database = true; } catch { /* fail closed */ }
  const checks = { database, ...providers };
  const ready = database && allManagementLaunchChecksPass(providers);
  return Response.json(
    { ready, version: (process.env.VERCEL_GIT_COMMIT_SHA ?? 'local').slice(0, 7), checks },
    { status: ready ? 200 : 503, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
  );
}
