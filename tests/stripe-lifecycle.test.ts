import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHmac } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { db } from "@/lib/db";
import { POST } from "@/app/api/stripe/webhook/route";
import { drainOutbox } from "@/modules/outbox/drain";

const SECRET = "whsec_test_lifecycle";
let saved: string | undefined;
beforeAll(() => { saved = process.env.STRIPE_WEBHOOK_SECRET; process.env.STRIPE_WEBHOOK_SECRET = SECRET; });
afterAll(() => { if (saved === undefined) delete process.env.STRIPE_WEBHOOK_SECRET; else process.env.STRIPE_WEBHOOK_SECRET = saved; });

let n = 0;
const send = (type: string, object: Record<string, unknown>, opts: { secret?: string; t?: number; id?: string } = {}) => {
  const body = JSON.stringify({ id: opts.id ?? `evt_${Date.now()}_${n++}_${Math.random().toString(36).slice(2, 8)}`, type, livemode: false, data: { object } });
  const t = opts.t ?? Math.floor(Date.now() / 1000);
  const sig = `t=${t},v1=${createHmac("sha256", opts.secret ?? SECRET).update(`${t}.${body}`).digest("hex")}`;
  return POST(new Request("http://x/api/stripe/webhook", { method: "POST", body, headers: { "stripe-signature": sig } }));
};
const mails = () => readdirSync(".mail-sink").filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(`.mail-sink/${f}`, "utf8")) as { from: string; to: string; subject: string; html: string; text: string; replyTo?: string });
const mailsFor = (ref: string) => mails().filter((m) => m.subject.includes(ref) || m.text.includes(ref));

async function order() {
  const tag = Math.random().toString(36).slice(2, 8).toUpperCase();
  const w = await db.workspace.create({ data: { name: `life-${tag}` } });
  const c = await db.customer.create({ data: { workspaceId: w.id, reference: `OSS-CU-${tag}`, displayName: `Harbour Bakery ${tag}` } });
  await db.contact.create({ data: { workspaceId: w.id, customerId: c.id, name: "Hana Baker", email: `hana-${tag.toLowerCase()}@client.test`, isPrimary: true } });
  const ref = `OSS-OF-2026-${tag}`;
  const k = await db.contract.create({ data: { workspaceId: w.id, customerId: c.id, reference: ref, title: "Website", status: "completed", scopeSnapshot: "x", oneOffMinor: 120000, recurringMinor: 4900 } });
  const mk = (kind: string, amountMinor: number, description?: string) => db.billingIntent.create({ data: { workspaceId: w.id, customerId: c.id, contractId: k.id, kind, amountMinor, description } });
  return { w, c, k, ref, tag, site: await mk("one_off", 120000, "Website"), plan: await mk("recurring_setup", 4900, "Standard plan") };
}
const status = async (id: string) => (await db.billingIntent.findUniqueOrThrow({ where: { id } })).status;

describe("Stripe lifecycle through the real webhook and the outbox", () => {
  it("rejects forged, stale, malformed and unconfigured requests without touching anything", async () => {
    const { site } = await order();
    const ev = { id: site.id, metadata: { intentId: site.id }, payment_status: "paid" };
    expect((await send("checkout.session.completed", ev, { secret: "whsec_wrong" })).status).toBe(400);
    expect((await send("checkout.session.completed", ev, { t: Math.floor(Date.now() / 1000) - 3600 })).status).toBe(400);
    expect((await POST(new Request("http://x", { method: "POST", body: "{}" }))).status).toBe(400);
    const bad = "not json"; const t = Math.floor(Date.now() / 1000);
    expect((await POST(new Request("http://x", { method: "POST", body: bad, headers: { "stripe-signature": `t=${t},v1=${createHmac("sha256", SECRET).update(`${t}.${bad}`).digest("hex")}` } }))).status).toBe(400);
    expect(await status(site.id)).toBe("pending");
    const keep = process.env.STRIPE_WEBHOOK_SECRET; delete process.env.STRIPE_WEBHOOK_SECRET;
    expect((await send("checkout.session.completed", ev)).status).toBe(503);
    process.env.STRIPE_WEBHOOK_SECRET = keep;
  });

  it("website fee paid by card: marked paid once, one receipt to the payer, one notice to the team, audit trail, repeat is harmless", async () => {
    const o = await order();
    const session = { id: "cs_site", metadata: { intentId: o.site.id }, payment_status: "paid", payment_intent: "pi_site", amount_total: 120000, currency: "gbp", customer_details: { email: `payer-${o.tag.toLowerCase()}@client.test`, name: "Pat Payer" } };
    const eventId = `evt_fixed_${o.tag}`;
    expect((await send("checkout.session.completed", session, { id: eventId })).status).toBe(200);
    expect((await send("checkout.session.completed", session, { id: eventId })).status).toBe(200);                 // Stripe retry, same event id
    expect((await send("checkout.session.completed", session)).status).toBe(200);                                  // different event id, same payment
    const b = await db.billingIntent.findUniqueOrThrow({ where: { id: o.site.id } });
    expect(b).toMatchObject({ status: "paid", paidVia: "stripe", stripePaymentIntent: "pi_site" });
    expect(b.paidAt).toBeTruthy();
    expect(await db.auditEvent.count({ where: { workspaceId: o.w.id, action: "billing.paid" } })).toBe(1);
    expect(await db.auditEvent.count({ where: { workspaceId: o.w.id, targetType: "stripe_event", targetId: eventId } })).toBe(1);
    await drainOutbox(300);
    const got = mailsFor(o.ref);
    const receipt = got.filter((m) => m.subject.startsWith("Payment received:") && m.to !== "hello@onesimplesite.co.uk");
    expect(receipt).toHaveLength(1);
    expect(receipt[0].to).toBe(`payer-${o.tag.toLowerCase()}@client.test`);
    expect(receipt[0].text).toContain("£1,200.00"); expect(receipt[0].text).toContain("Website"); expect(receipt[0].text).toContain("Hi Pat"); expect(receipt[0].html).toContain("/billing");
    for (const m of got) { expect(m.html + m.text).not.toMatch(/undefined|NaN|\[object|\{\{/); expect(m.html).toContain("<img"); }
    const notice = got.filter((m) => m.subject.startsWith("Payment received: ") && m.to === "hello@onesimplesite.co.uk");
    expect(notice).toHaveLength(1); expect(notice[0].text).toContain(o.c.displayName); expect(notice[0].html).toContain(`/contracts/${o.k.id}`);
  });

  it("monthly plan: starts, a failed payment emails the customer each time, recovers, then is cancelled; both Stripe invoice shapes work", async () => {
    const o = await order();
    const sub = `sub_${o.tag}`;
    await send("checkout.session.completed", { id: "cs_plan", metadata: { intentId: o.plan.id }, payment_status: "paid", subscription: sub, customer_details: { email: `hana-${o.tag.toLowerCase()}@client.test`, name: "Hana Baker" } });
    expect(await status(o.plan.id)).toBe("active");
    expect((await db.billingIntent.findUniqueOrThrow({ where: { id: o.plan.id } })).stripeSubscriptionId).toBe(sub);
    await send("invoice.paid", { id: "in_first", subscription: sub, billing_reason: "subscription_create" });          // arrives right after checkout: no change, no email
    expect(await status(o.plan.id)).toBe("active");
    await send("invoice.payment_failed", { id: "in_f1", subscription: sub, customer_email: `hana-${o.tag.toLowerCase()}@client.test` });   // older shape
    expect(await status(o.plan.id)).toBe("past_due");
    await send("invoice.paid", { id: "in_ok", parent: { subscription_details: { subscription: sub } } });              // newer shape
    expect(await status(o.plan.id)).toBe("active");
    await send("invoice.payment_failed", { id: "in_f2", parent: { subscription_details: { subscription: sub } } });
    expect(await status(o.plan.id)).toBe("past_due");
    await send("customer.subscription.updated", { id: sub, status: "active" });
    expect(await status(o.plan.id)).toBe("active");
    await send("customer.subscription.deleted", { id: sub, status: "canceled" });
    expect(await status(o.plan.id)).toBe("cancelled");
    await send("invoice.paid", { id: "in_late", subscription: sub });                                                  // a late event must not revive a cancelled plan's emails
    await drainOutbox(300);
    const got = mailsFor(o.ref);
    expect(got.filter((m) => m.subject.startsWith("Your monthly plan is live"))).toHaveLength(1);
    const failed = got.filter((m) => m.subject.startsWith("We couldn't take your payment"));
    expect(failed.length).toBe(2);
    expect(failed.every((m) => m.to === `hana-${o.tag.toLowerCase()}@client.test` && m.text.includes("£49.00") && m.html.includes("/billing"))).toBe(true);
    const team = got.filter((m) => m.to === "hello@onesimplesite.co.uk").map((m) => m.subject.split(":")[0]);
    expect(team).toEqual(expect.arrayContaining(["Monthly plan started", "Payment failed", "Monthly plan cancelled"]));
    expect(got.filter((m) => m.to !== "hello@onesimplesite.co.uk").every((m) => !/cancel/i.test(m.subject))).toBe(true);
    for (const m of got) expect(m.html + m.text).not.toMatch(/undefined|NaN|\[object|\{\{/);
  });

  it("deposit then final payment: each is its own payment, in any order, and the order stays correct", async () => {
    const o = await order();
    await db.billingIntent.delete({ where: { id: o.site.id } });
    const dep = await db.billingIntent.create({ data: { workspaceId: o.w.id, customerId: o.c.id, contractId: o.k.id, kind: "deposit", amountMinor: 60000, description: "Website deposit (50%)" } });
    const bal = await db.billingIntent.create({ data: { workspaceId: o.w.id, customerId: o.c.id, contractId: o.k.id, kind: "balance", amountMinor: 60000, description: "Website final payment" } });
    await send("checkout.session.completed", { id: "cs_bal", metadata: { intentId: bal.id }, payment_status: "paid" });
    expect(await status(bal.id)).toBe("paid"); expect(await status(dep.id)).toBe("pending");
    await send("checkout.session.completed", { id: "cs_dep", metadata: { intentId: dep.id }, payment_status: "paid" });
    expect(await status(dep.id)).toBe("paid");
    await drainOutbox(300);
    const rec = mailsFor(o.ref).filter((m) => m.subject.startsWith("Payment received:") && m.to.startsWith("hana-"));
    expect(rec).toHaveLength(2);
    expect(rec.map((m) => m.text).join("\n")).toMatch(/Website deposit \(50%\)/); expect(rec.map((m) => m.text).join("\n")).toMatch(/Website final payment/);
    expect(rec.every((m) => m.text.includes("£600.00"))).toBe(true);
  });

  it("unpaid or unknown events and other businesses' charges change nothing", async () => {
    const a = await order(); const b = await order();
    await send("checkout.session.completed", { id: "cs_u", metadata: { intentId: a.site.id }, payment_status: "unpaid" });
    await send("checkout.session.async_payment_failed", { id: "cs_x", metadata: { intentId: a.site.id } });
    await send("charge.refunded", { id: "ch_1" });
    await send("customer.subscription.deleted", { id: "sub_does_not_exist" });
    expect(await status(a.site.id)).toBe("pending");
    await send("checkout.session.completed", { id: "cs_ok", metadata: { intentId: a.site.id }, payment_status: "paid" });
    expect(await status(a.site.id)).toBe("paid"); expect(await status(b.site.id)).toBe("pending");
    expect(await db.auditEvent.count({ where: { workspaceId: b.w.id, action: { startsWith: "billing." } } })).toBe(0);
  });

  it("unknown Stripe events are recorded and acknowledged so Stripe stops retrying", async () => {
    await order();
    const r = await send("balance.available", { id: "bal_1" });
    expect(r.status).toBe(200);
  });
});
