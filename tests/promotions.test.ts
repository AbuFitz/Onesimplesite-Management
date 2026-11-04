import { describe, it, expect, vi } from "vitest";
import { db } from "@/lib/db";
import { composeAgreement } from "@/modules/signing/service";
import { promoFrom, addMonths, trialDays } from "@/modules/billing/promo";
import { runCompletionWorkflow } from "@/modules/contracts/service";
import { startPayment, applyStripeEvent, setPlanOffer, plainStatus } from "@/modules/billing/service";
import { SERVICES_AGREEMENT } from "@/modules/settings/legal-text";
import type { StaffCtx } from "@/modules/identity/session";
import type { ClientCtx } from "@/modules/portal/service";

describe("offers", () => {
  it("reads an offer from the order and counts months properly", () => {
    expect(promoFrom({})).toBeNull();
    expect(promoFrom({ promoFreeMonths: "1", promoLabel: "Launch offer" })).toEqual({ label: "Launch offer", freeMonths: 1, discountMinor: 0, percent: 0 });
    expect(promoFrom({ promoDiscount: "150.50" })).toEqual({ label: "Special offer", freeMonths: 0, discountMinor: 15050, percent: 0 });
    expect(promoFrom({ promoPercent: "10" }, 120000)).toMatchObject({ percent: 10, discountMinor: 12000 });
    expect(promoFrom({ promoPercent: "10", promoDiscount: "50" }, 120000)).toMatchObject({ discountMinor: 17000 });      // both add up
    expect(promoFrom({ promoPercent: "100" }, 120000)!.discountMinor).toBe(120000); expect(promoFrom({ promoDiscount: "5000" }, 120000)!.discountMinor).toBe(120000);   // never more than the fee
    expect(addMonths(new Date("2026-01-31T10:00:00Z"), 1).toISOString().slice(0, 10)).toBe("2026-02-28");
    expect(addMonths(new Date("2026-11-04T10:00:00Z"), 1).toISOString().slice(0, 10)).toBe("2026-12-04");
    expect(trialDays(new Date("2026-11-04T10:00:00Z"), 1)).toBe(30);
  });

  it("writes the offer into the agreement the customer signs", () => {
    const base = { reference: "OSS-OF-2026-001", title: "Website", dateLabel: "4 November 2026", validUntilLabel: "4 December 2026", currency: "GBP", oneOffMinor: 120000, recurringMinor: 2900, recurringPeriod: "month", lines: [{ description: "Website", quantity: 1, unitMinor: 120000, recurring: false }, { description: "Care Plan", quantity: 1, unitMinor: 2900, recurring: true }], scope: "A site", provider: { legalName: "OneSimpleSite LTD", companyNumber: "17552675", registeredAddress: "3F Foxhill", vatNumber: null }, client: { legalName: "Harbour Bakery Ltd", kind: "business", companyNumber: null, billingAddress: "1 Quay", vatNumber: null }, docs: { terms: { number: 2, body: SERVICES_AGREEMENT } }, vars: {} };
    const t = composeAgreement({ ...base, requirements: { promoFreeMonths: "1", promoDiscount: "100", promoLabel: "Launch offer" } } as never);
    expect(t).toContain("Launch offer: discount on the website fee"); expect(t).toContain("£1,100.00"); expect(t).toMatch(/first 1 month of your monthly plan is free/); expect(t).toContain("£29.00 is taken 1 month after the day the plan starts");
    expect(composeAgreement({ ...base, requirements: {} } as never)).not.toContain("is free");
  });

  async function world(requirements: object) {
    const w = await db.workspace.create({ data: { name: `pr-${Math.random()}` } });
    const m = await db.staffMembership.create({ data: { workspaceId: w.id, email: `s-${Math.random()}@x.test`, displayName: "A", role: "owner", status: "active" } });
    const staff: StaffCtx = { userId: null as unknown as string, staffId: m.id, workspaceId: w.id, role: "owner", name: "A", email: m.email };
    const c = await db.customer.create({ data: { workspaceId: w.id, reference: `OSS-CU-${Math.random().toString(36).slice(2, 8)}`, displayName: "Harbour Bakery" } });
    const p = await db.proposal.create({ data: { workspaceId: w.id, customerId: c.id, reference: `OSS-QT-${Math.random().toString(36).slice(2, 8)}`, title: "Site", currentVersion: 1 } });
    const v = await db.proposalVersion.create({ data: { workspaceId: w.id, proposalId: p.id, number: 1, scope: "x", terms: "", currency: "GBP", oneOffMinor: 120000, recurringMinor: 2900, recurringPeriod: "month", requirements: requirements as never } });
    const k = await db.contract.create({ data: { workspaceId: w.id, customerId: c.id, reference: `OSS-OF-${Math.random().toString(36).slice(2, 8)}`, title: "Website", status: "completed", scopeSnapshot: "x", oneOffMinor: 120000, recurringMinor: 2900, proposalVersionId: v.id } });
    await db.$transaction((tx) => runCompletionWorkflow(tx, k.id));
    const client: ClientCtx = { userId: "u", name: "Hana", email: "hana@client.test", memberships: [{ customerId: c.id, role: "admin", customer: { id: c.id, displayName: c.displayName, workspaceId: w.id } }] };
    return { w, staff, c, k, client, plan: await db.billingIntent.findFirstOrThrow({ where: { contractId: k.id, kind: "recurring_setup" } }), fee: await db.billingIntent.findFirstOrThrow({ where: { contractId: k.id, kind: "one_off" } }) };
  }

  it("applies the discount and free months when the order completes, and the free months become a Stripe trial without a charge or receipt", async () => {
    const x = await world({ promoFreeMonths: "1", promoDiscount: "100", promoLabel: "Launch offer" });
    expect(x.fee.amountMinor).toBe(110000); expect(x.fee.promoLabel).toBe("Launch offer");
    expect(x.plan).toMatchObject({ amountMinor: 2900, trialMonths: 1, promoLabel: "Launch offer" });
    const calls: URLSearchParams[] = [];
    const key = process.env.STRIPE_SECRET_KEY; process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (u, init) => { const url = String(u); calls.push(new URLSearchParams(String((init as RequestInit).body ?? ""))); return new Response(JSON.stringify(url.endsWith("/customers") ? { id: "cus_1" } : { id: "cs_1", url: "https://checkout.stripe.test/x" }), { status: 200 }); });
    try { await startPayment(x.client, x.plan.id); } finally { spy.mockRestore(); if (key === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = key; }
    const s = calls.find((c) => c.get("mode") === "subscription")!;
    expect(s.get("subscription_data[trial_period_days]")).toBe("30"); expect(s.get("payment_method_collection")).toBe("always");
    await applyStripeEvent("checkout.session.completed", { id: "cs_1", metadata: { intentId: x.plan.id }, payment_status: "no_payment_required", subscription: "sub_1", customer_details: { email: "hana@client.test", name: "Hana" } }, x.w.id);
    const after = await db.billingIntent.findUniqueOrThrow({ where: { id: x.plan.id } });
    expect(after.status).toBe("active"); expect(after.trialEndsAt!.getTime()).toBeGreaterThan(Date.now() + 27 * 864e5);
    expect(await db.receipt.count({ where: { intentId: x.plan.id } })).toBe(0);                        // nothing was paid, so no receipt yet
    expect(plainStatus("recurring_setup", after.status, null, after.trialEndsAt).label).toMatch(/^Free until /);
    const mail = await db.outbox.findFirstOrThrow({ where: { workspaceId: x.w.id, topic: "email.plan_started" } });
    expect((mail.payload as { freeUntil?: string }).freeUntil).toBeTruthy();
    // the first real payment, a month later, gets its receipt from the invoice
    await applyStripeEvent("invoice.paid", { id: "in_1", subscription: "sub_1", billing_reason: "subscription_cycle", amount_paid: 2900 } as never, x.w.id);
    expect(await db.receipt.count({ where: { intentId: x.plan.id } })).toBe(1);
  });

  it("staff can give free months before the plan starts, not after, and without an offer nothing changes", async () => {
    const x = await world({});
    expect(x.plan.trialMonths).toBe(0); expect(x.fee.amountMinor).toBe(120000);
    await setPlanOffer(x.staff, x.plan.id, 1, "Welcome offer");
    expect(await db.billingIntent.findUniqueOrThrow({ where: { id: x.plan.id } })).toMatchObject({ trialMonths: 1, promoLabel: "Welcome offer" });
    await expect(setPlanOffer(x.staff, x.plan.id, 99, "x")).rejects.toThrow(/0 and 12/);
    await expect(setPlanOffer(x.staff, x.fee.id, 1, "x")).rejects.toThrow(/monthly plan/);
    await db.billingIntent.update({ where: { id: x.plan.id }, data: { status: "active" } });
    await expect(setPlanOffer(x.staff, x.plan.id, 2, "x")).rejects.toThrow(/too late/);
  });
});
