import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Readiness probe: confirms the app can reach its database. Returns only a short error code on failure. */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ ok: true });
  } catch (e) {
    const err = e as { code?: string; name?: string; message?: string; cause?: { code?: string; message?: string } };
    const code = err.cause?.code ?? err.code ?? err.name ?? "unknown";
    // Log the message server-side only; it never contains the connection string.
    console.error("health: database check failed", code, (err.cause?.message ?? err.message ?? "").slice(0, 200));
    return Response.json({ ok: false, reason: String(code).slice(0, 40) }, { status: 503 });
  }
}
