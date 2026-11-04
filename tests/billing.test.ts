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

  it("emails: customer gets one receipt and the team one notice, even if Stripe repeats the event; failures email again per attempt", async () => {
    const { w, one, mon } = await world();
    await db.contact.create({ data: { workspaceId: w.id, customerId: one!.customerId, name: "Hana Baker", email: "hana@client.test", isPrimary: true } });
    const ev = { id: "cs_9", metadata: { intentId: one!.id }, payment_status: "paid", customer_details: { email: "payer@client.test", name: "Pat Payer" } };
    await applyStripeEvent("checkout.session.completed", ev, w.id); await applyStripeEvent("checkout.session.completed", ev, w.id);
    const out = async () => (await db.outbox.findMany({ where: { workspaceId: w.id } })).map((o) => [o.topic, (o.payload as { to: string }).to]);
    expect(await out()).toEqual(expect.arrayContaining([["email.payment_received", "payer@client.test"], ["email.payment_notice", "internal"]]));
    expect((await out()).filter(([t]) => t === "email.payment_received")).toHaveLength(1);
    await applyStripeEvent("checkout.session.completed", { id: "cs_10", metadata: { intentId: mon!.id }, payment_status: "paid", subscription: "sub_9" }, w.id);
    await applyStripeEvent("invoice.payment_failed", { id: "in_a", subscription: "sub_9" }, w.id);
    await applyStripeEvent("invoice.paid", { id: "in_b", subscription: "sub_9" }, w.id);
    await applyStripeEvent("invoice.payment_failed", { id: "in_c", subscription: "sub_9" }, w.id);
    const o = await out();
    expect(o).toEqual(expect.arrayContaining([["email.plan_started", "hana@client.test"]]));
    expect(o.filter(([t]) => t === "email.payment_failed")).toHaveLength(2);
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

import { createTestClient, TEST_CLIENT_NAME } from "@/modules/crm/test-client";
describe("test client", () => {
  it("creates a demo company with a completed order to pay, invites the email, and is safe to run twice", async () => {
    const { w, staff } = await world();
    const email = `demo-${Math.random().toString(36).slice(2, 8)}@example.test`;
    const id = await createTestClient(staff, email);
    await createTestClient(staff, email);
    const cu = await db.customer.findMany({ where: { workspaceId: w.id, displayName: TEST_CLIENT_NAME } });
    expect(cu).toHaveLength(1); expect(cu[0].id).toBe(id);
    expect((await db.billingIntent.findMany({ where: { customerId: id } })).map((b) => b.kind).sort()).toEqual(["one_off", "recurring_setup"]);
    expect(await db.project.count({ where: { customerId: id } })).toBe(1);
    expect(await db.outbox.count({ where: { workspaceId: w.id, topic: "email.invitation" } })).toBeGreaterThanOrEqual(1);
  });
  it("refuses an email that already belongs to a real customer", async () => {
    const { w, staff, c } = await world();
    await db.contact.create({ data: { workspaceId: w.id, customerId: c.id, name: "Real Person", email: "real@client.test", isPrimary: true } });
    await expect(createTestClient(staff, "real@client.test")).rejects.toThrow(/already belongs/);
  });
});

import { vi } from "vitest";
describe("checkout requests sent to Stripe", () => {
  it("builds the right Checkout Session for a one-off fee and a monthly plan, reuses the Stripe customer, and never trusts the browser for amounts", async () => {
    const { client, one, mon, c } = await world();
    const calls: { url: string; body: URLSearchParams }[] = [];
    const key = process.env.STRIPE_SECRET_KEY; process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (u, init) => {
      const url = String(u); calls.push({ url, body: new URLSearchParams(String((init as RequestInit).body ?? "")) });
      const id = url.endsWith("/customers") ? { id: "cus_123" } : { id: "cs_abc", url: "https://checkout.stripe.test/pay/cs_abc" };
      return new Response(JSON.stringify(id), { status: 200 });
    });
    try {
      expect(await startPayment(client, one!.id)).toBe("https://checkout.stripe.test/pay/cs_abc");
      expect(await startPayment(client, mon!.id)).toBe("https://checkout.stripe.test/pay/cs_abc");
      expect(calls.filter((x) => x.url.endsWith("/customers"))).toHaveLength(1);                        // created once, then reused
      expect((await db.customer.findUniqueOrThrow({ where: { id: c.id } })).stripeCustomerId).toBe("cus_123");
      const [site, plan] = calls.filter((x) => x.url.endsWith("/checkout/sessions")).map((x) => x.body);
      expect(site.get("payment_method_types[0]")).toBeNull(); expect(site.get("mode")).toBe("payment"); expect(site.get("customer")).toBe("cus_123");
      expect(site.get("line_items[0][price_data][unit_amount]")).toBe("120000"); expect(site.get("line_items[0][price_data][currency]")).toBe("gbp");
      expect(site.get("line_items[0][price_data][recurring][interval]")).toBeNull();
      expect(site.get("metadata[intentId]")).toBe(one!.id); expect(site.get("payment_intent_data[metadata][intentId]")).toBe(one!.id);
      expect(site.get("success_url")).toMatch(/\/billing\?paid=1$/); expect(site.get("cancel_url")).toMatch(/\/billing$/);
      expect(plan.get("mode")).toBe("subscription"); expect(plan.get("line_items[0][price_data][unit_amount]")).toBe("4900");
      expect(plan.get("line_items[0][price_data][recurring][interval]")).toBe("month"); expect(plan.get("subscription_data[metadata][intentId]")).toBe(mon!.id);
      expect((await db.billingIntent.findUniqueOrThrow({ where: { id: one!.id } })).stripeSessionId).toBe("cs_abc");
      // once paid it can't be paid again
      await db.billingIntent.update({ where: { id: one!.id }, data: { status: "paid" } });
      await expect(startPayment(client, one!.id)).rejects.toThrow(/already paid/);
    } finally { spy.mockRestore(); if (key) process.env.STRIPE_SECRET_KEY = key; else delete process.env.STRIPE_SECRET_KEY; }
  });

  it("surfaces a Stripe error as a plain failure, not a crash", async () => {
    const { client, one } = await world();
    const key = process.env.STRIPE_SECRET_KEY; process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: { message: "Your card was declined." } }), { status: 402 }));
    try { await expect(startPayment(client, one!.id)).rejects.toThrow(/couldn.t start the payment/); } finally { spy.mockRestore(); if (key) process.env.STRIPE_SECRET_KEY = key; else delete process.env.STRIPE_SECRET_KEY; }
  });
});
