import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { applyStripeEvent, clientBilling, startPayment, splitWebsiteFee, markPaidManually, cancelCharge } from "@/modules/billing/service";
import { formEncode } from "@/lib/stripe";
import type { StaffCtx } from "@/modules/identity/session";
import type { ClientCtx } from "@/modules/portal/service";

async function world(opts: { monthly?: boolean; oneOff?: boolean } = { monthly: true, oneOff: true }) {
  const w = await db.workspace.create({ data: { name: `bill-${Math.random()}` } });
  const m = await db.staffMembership.create({ data: { workspaceId: w.id, email: `s-${Math.random()}@example.test`, displayName: "Abukar", role: "owner", status: "active" } });
  const staff: StaffCtx = { userId: null as unknown as string, staffId: m.id, workspaceId: w.id, role: "owner", name: "Abukar", email: m.email };
  const c = await db.customer.create({ data: { workspaceId: w.id, reference: `OSS-CU-${Math.random().toString(36).slice(2, 8)}`, displayName: "Harbour Bakery" } });
  const k = await db.contract.create({ data: { workspaceId: w.id, customerId: c.id, reference: `OSS-OF-${Math.random().toString(36).slice(2, 8)}`, title: "Website", status: "completed", scopeSnapshot: "x", oneOffMinor: 120000, recurringMinor: 4900 } });
  const one = opts.oneOff === false ? null : await db.billingIntent.create({ data: { workspaceId: w.id, customerId: c.id, contractId: k.id, kind: "one_off", amountMinor: 120000 } });
  const mon = opts.monthly === false ? null : await db.billingIntent.create({ data: { workspaceId: w.id, customerId: c.id, contractId: k.id, kind: "recurring_setup", amountMinor: 4900 } });
  const client: ClientCtx = { userId: "u", name: "Hana", email: "hana@client.test", memberships: [{ customerId: c.id, role: "admin", customer: { id: c.id, displayName: "Harbour Bakery", workspaceId: w.id } }] };
  return { w, staff, c, k, one, mon, client };
}

describe("billing", () => {
  it("encodes nested Stripe params", () => {
    expect(formEncode({ mode: "payment", line_items: [{ quantity: 1, price_data: { currency: "gbp" } }], x: undefined })).toBe("mode=payment&line_items%5B0%5D%5Bquantity%5D=1&line_items%5B0%5D%5Bprice_data%5D%5Bcurrency%5D=gbp");
  });

  it("a paid checkout marks the website fee paid once, even if Stripe repeats the event", async () => {
    const { w, one } = await world();
    const ev = { id: "cs_1", metadata: { intentId: one!.id }, payment_status: "paid", payment_intent: "pi_1", subscription: null };
    await applyStripeEvent("checkout.session.completed", ev, w.id);
    await applyStripeEvent("checkout.session.completed", ev, w.id);
    const b = await db.billingIntent.findUniqueOrThrow({ where: { id: one!.id } });
    expect(b.status).toBe("paid"); expect(b.paidVia).toBe("stripe"); expect(b.stripePaymentIntent).toBe("pi_1");
    expect(await db.auditEvent.count({ where: { workspaceId: w.id, action: "billing.paid" } })).toBe(1);
  });

  it("an unpaid checkout (e.g. delayed method) changes nothing yet", async () => {
    const { w, one } = await world();
    await applyStripeEvent("checkout.session.completed", { id: "cs_2", metadata: { intentId: one!.id }, payment_status: "unpaid" }, w.id);
    expect((await db.billingIntent.findUniqueOrThrow({ where: { id: one!.id } })).status).toBe("pending");
  });

  it("the monthly plan goes active, then past due, then active again, then cancelled", async () => {
    const { w, mon } = await world();
    await applyStripeEvent("checkout.session.completed", { id: "cs_3", metadata: { intentId: mon!.id }, payment_status: "paid", subscription: "sub_1" }, w.id);
    const st = async () => (await db.billingIntent.findUniqueOrThrow({ where: { id: mon!.id } })).status;
    expect(await st()).toBe("active");
    await applyStripeEvent("invoice.payment_failed", { id: "in_1", subscription: "sub_1" }, w.id); expect(await st()).toBe("past_due");
    await applyStripeEvent("invoice.paid", { id: "in_2", subscription: "sub_1" }, w.id); expect(await st()).toBe("active");
    await applyStripeEvent("customer.subscription.deleted", { id: "sub_1" }, w.id); expect(await st()).toBe("cancelled");
  });

  it("an event for another workspace's charge is ignored", async () => {
    const a = await world(); const b = await world();
    await applyStripeEvent("checkout.session.completed", { id: "cs_4", metadata: { intentId: a.one!.id }, payment_status: "paid" }, b.w.id);
    expect((await db.billingIntent.findUniqueOrThrow({ where: { id: a.one!.id } })).status).toBe("pending");
  });

  it("clients only see their own completed orders; unsigned orders don't bill", async () => {
    const a = await world(); const b = await world();
    expect((await clientBilling(a.client)).map((x) => x.id).sort()).toEqual([a.one!.id, a.mon!.id].sort());
    await db.contract.update({ where: { id: b.k.id }, data: { status: "draft" } });
    expect(await clientBilling(b.client)).toHaveLength(0);
  });

  it("paying says so plainly when Stripe isn't switched on, and never for someone else's charge", async () => {
    const a = await world(); const b = await world();
    const key = process.env.STRIPE_SECRET_KEY; delete process.env.STRIPE_SECRET_KEY;
    await expect(startPayment(a.client, a.one!.id)).rejects.toThrow(/aren't switched on/);
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    await expect(startPayment(a.client, b.one!.id)).rejects.toMatchObject({ code: "not_found" });
    if (key) process.env.STRIPE_SECRET_KEY = key; else delete process.env.STRIPE_SECRET_KEY;
  });

  it("website-only jobs work: no monthly plan, split into deposit and balance, paid by bank, cancel", async () => {
    const { staff, k, w, one } = await world({ oneOff: true, monthly: false });
    await splitWebsiteFee(staff, k.id, 40);
    const rows = await db.billingIntent.findMany({ where: { contractId: k.id }, orderBy: { kind: "asc" } });
    expect(rows.map((r) => [r.kind, r.amountMinor])).toEqual([["balance", 72000], ["deposit", 48000]]);
    await expect(splitWebsiteFee(staff, k.id, 40)).rejects.toThrow();
    await markPaidManually(staff, rows.find((r) => r.kind === "deposit")!.id);
    await cancelCharge(staff, rows.find((r) => r.kind === "balance")!.id);
    const after = await db.billingIntent.findMany({ where: { contractId: k.id } });
    expect(after.find((r) => r.kind === "deposit")!.paidVia).toBe("bank");
    expect(after.find((r) => r.kind === "balance")!.status).toBe("cancelled");
    await expect(cancelCharge(staff, after.find((r) => r.kind === "deposit")!.id)).rejects.toThrow(/paid/);
    expect(one).toBeTruthy(); expect(w.id).toBeTruthy();
  });
});
