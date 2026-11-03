import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { applyStripeEvent } from "@/modules/billing/service";
import { verifyStripeSignature } from "@/lib/stripe-signature";

export const dynamic = "force-dynamic";

/** Stripe calls this. It checks the signature, then records each event once. It then updates the matching charge (paid, plan active, payment failed, cancelled). */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("Stripe is not set up.", { status: 503 });
  const body = await req.text();
  if (!verifyStripeSignature(body, req.headers.get("stripe-signature"), secret)) return new Response("Bad signature.", { status: 400 });
  let ev: { id?: string; type?: string; livemode?: boolean; data?: { object?: Record<string, unknown> & { id?: string; amount_total?: number; amount_paid?: number; currency?: string } } };
  try { ev = JSON.parse(body); } catch { return new Response("Bad payload.", { status: 400 }); }
  if (!ev.id || !ev.type) return new Response("Bad payload.", { status: 400 });
  const w = await db.workspace.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!w) return new Response("ok");
  const seen = await db.auditEvent.findFirst({ where: { workspaceId: w.id, targetType: "stripe_event", targetId: ev.id }, select: { id: true } });
  if (!seen) {
    const o = ev.data?.object;
    await db.$transaction((tx) => audit(tx, { workspaceId: w.id, actor: null, action: `stripe.${ev.type}`, targetType: "stripe_event", targetId: ev.id!, detail: { livemode: !!ev.livemode, object: o?.id, amount: o?.amount_paid ?? o?.amount_total, currency: o?.currency } }));
  }
  try { if (ev.data?.object) await applyStripeEvent(ev.type, ev.data.object as never, w.id); }
  catch (e) { console.error("stripe event failed", ev.id, e); return new Response("Could not apply.", { status: 500 }); } // Stripe retries
  return new Response("ok");
}
