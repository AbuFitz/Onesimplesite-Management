import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { applyStripeEvent } from "@/modules/billing/service";
import { stripeSubId } from "@/lib/stripe";
import { reportProblem } from "@/lib/problems";
import { flushEmails } from "@/lib/flush-email";
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
  // Find the company this event belongs to from our own records, so it is right even with several workspaces.
  const o0 = ev.data?.object as Record<string, unknown> | undefined;
  const intentId = (o0?.metadata as Record<string, string> | undefined)?.intentId;
  const subId = String(ev.type).startsWith("customer.subscription.") ? (o0?.id as string | undefined) : stripeSubId(o0);
  const owner = intentId ? await db.billingIntent.findFirst({ where: { id: intentId }, select: { workspaceId: true } }) : subId ? await db.billingIntent.findFirst({ where: { stripeSubscriptionId: subId }, select: { workspaceId: true } }) : null;
  const w = owner ? { id: owner.workspaceId } : await db.workspace.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!w) return new Response("ok");
  const seen = await db.auditEvent.findFirst({ where: { workspaceId: w.id, targetType: "stripe_event", targetId: ev.id }, select: { id: true } });
  if (!seen) {
    const o = ev.data?.object;
    await db.$transaction((tx) => audit(tx, { workspaceId: w.id, actor: null, action: `stripe.${ev.type}`, targetType: "stripe_event", targetId: ev.id!, detail: { livemode: !!ev.livemode, object: o?.id, amount: o?.amount_paid ?? o?.amount_total, currency: o?.currency } }));
  }
  try { if (ev.data?.object) await applyStripeEvent(ev.type, ev.data.object as never, w.id); }
  catch (e) { await reportProblem({ workspaceId: w.id, area: "stripe_webhook", error: e, ref: `${ev.type} ${ev.id}` }); return new Response("Could not apply.", { status: 500 }); } // Stripe retries
  // Send the receipt now instead of waiting for the daily job.
  try { flushEmails(); } catch { /* not inside a request (tests): the outbox is drained elsewhere */ }
  return new Response("ok");
}
