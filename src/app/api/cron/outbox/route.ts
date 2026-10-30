import { drainOutbox } from "@/modules/outbox/drain";

export const dynamic = "force-dynamic";

/** Daily safety net (Vercel cron). Retries anything that did not send straight away. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorised", { status: 401 });
  const r = await drainOutbox(100);
  return Response.json(r);
}
