import { describe, it, expect, vi } from "vitest";
import { db } from "@/lib/db";
import { runCompletionWorkflow } from "@/modules/contracts/service";
import { startPayment, requestFinalPayment, isScheduled, applyStripeEvent } from "@/modules/billing/service";
import { todayData } from "@/modules/today/service";
import { suggestionsFor } from "@/modules/smart/service";
import { transitionProject } from "@/modules/projects/service";
import type { StaffCtx } from "@/modules/identity/session";
import type { ClientCtx } from "@/modules/portal/service";

async function world() {
  const w = await db.workspace.create({ data: { name: `fp-${Math.random()}` } });
  const m = await db.staffMembership.create({ data: { workspaceId: w.id, email: `s-${Math.random()}@x.test`, displayName: "A", role: "owner", status: "active" } });
  const staff: StaffCtx = { userId: null as unknown as string, staffId: m.id, workspaceId: w.id, role: "owner", name: "A", email: m.email };
  const c = await db.customer.create({ data: { workspaceId: w.id, reference: `OSS-CU-${Math.random().toString(36).slice(2, 8)}`, displayName: "Harbour Bakery" } });
  await db.contact.create({ data: { workspaceId: w.id, customerId: c.id, name: "Hana Lee", email: "hana@client.test", isPrimary: true } });
  const p = await db.proposal.create({ data: { workspaceId: w.id, customerId: c.id, reference: `OSS-QT-${Math.random().toString(36).slice(2, 8)}`, title: "Site", currentVersion: 1 } });
  const v = await db.proposalVersion.create({ data: { workspaceId: w.id, proposalId: p.id, number: 1, scope: "x", terms: "", currency: "GBP", oneOffMinor: 100000, recurringMinor: 0, requirements: { depositPercent: "40", promoPercent: "10" } as never } });
  const k = await db.contract.create({ data: { workspaceId: w.id, customerId: c.id, reference: `OSS-OF-${Math.random().toString(36).slice(2, 8)}`, title: "Website", status: "completed", scopeSnapshot: "x", oneOffMinor: 100000, recurringMinor: 0, proposalVersionId: v.id } });
  const project = await db.$transaction((tx) => runCompletionWorkflow(tx, k.id));
  const client: ClientCtx = { userId: "u", name: "Hana", email: "hana@client.test", memberships: [{ customerId: c.id, role: "admin", customer: { id: c.id, displayName: c.displayName, workspaceId: w.id } }] };
  return { w, staff, c, k, client, project };
}

describe("deposit and final payment", () => {
  it("takes the percentage off first, then splits what is left", async () => {
    const x = await world();
    const bills = await db.billingIntent.findMany({ where: { contractId: x.k.id }, orderBy: { kind: "asc" } });
    expect(bills.map((b) => [b.kind, b.amountMinor])).toEqual([["balance", 54000], ["deposit", 36000]]);   // £1,000 - 10% = £900: 40% now, 60% later
  });

  it("the final payment cannot be paid until it is asked for, then the customer is emailed and can pay", async () => {
    const x = await world();
    const bal = await db.billingIntent.findFirstOrThrow({ where: { contractId: x.k.id, kind: "balance" } });
    expect(isScheduled(bal)).toBe(true);
    await expect(startPayment(x.client, bal.id)).rejects.toThrow(/isn't due yet|aren't switched on/);
    await requestFinalPayment(x.staff, x.k.id);
    const after = await db.billingIntent.findUniqueOrThrow({ where: { id: bal.id } });
    expect(after.requestedAt).toBeTruthy(); expect(isScheduled(after)).toBe(false);
    const mail = await db.outbox.findMany({ where: { workspaceId: x.w.id, topic: "email.balance_requested" } });
    expect(mail).toHaveLength(1); expect(mail[0].payload).toMatchObject({ to: "hana@client.test", amount: "£540.00" });
    await expect(requestFinalPayment(x.staff, x.k.id)).rejects.toThrow(/no final payment waiting/);      // asking twice is safe, and says so
    expect(await db.outbox.count({ where: { workspaceId: x.w.id, topic: "email.balance_requested" } })).toBe(1);
  });

  it("asks for it by itself when the project is ready to launch", async () => {
    const x = await world();
    const p = await db.project.findFirstOrThrow({ where: { contractId: x.k.id } });
    await transitionProject(x.staff, p.id, "ready_to_launch", p.version);
    const bal = await db.billingIntent.findFirstOrThrow({ where: { contractId: x.k.id, kind: "balance" } });
    expect(bal.requestedAt).toBeTruthy();
    expect(await db.outbox.count({ where: { workspaceId: x.w.id, topic: "email.balance_requested" } })).toBe(1);
  });
});

describe("the whole deposit and final payment journey, with Stripe faked", () => {
  it("deposit paid, final payment locked then asked for then paid; each charge is the right amount and nothing is double-counted", async () => {
    const x = await world();                                           // £1,000 less 10% = £900: 40% (£360) now, £540 later
    const key = process.env.STRIPE_SECRET_KEY; process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    const sessions: URLSearchParams[] = [];
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (u, init) => { const url = String(u); const body = new URLSearchParams(String((init as RequestInit).body ?? "")); if (url.endsWith("/checkout/sessions")) sessions.push(body); return new Response(JSON.stringify(url.endsWith("/customers") ? { id: "cus_1" } : { id: `cs_${sessions.length}`, url: "https://checkout.stripe.test/x" }), { status: 200 }); });
    try {
      const dep = await db.billingIntent.findFirstOrThrow({ where: { contractId: x.k.id, kind: "deposit" } });
      const bal = await db.billingIntent.findFirstOrThrow({ where: { contractId: x.k.id, kind: "balance" } });
      const m = await db.staffMembership.findFirstOrThrow({ where: { workspaceId: x.w.id } });
      // 1. Only the deposit can be paid. The locked final payment is not "due" and nobody is told to chase it.
      await startPayment(x.client, dep.id);
      expect(sessions[0].get("line_items[0][price_data][unit_amount]")).toBe("36000"); expect(sessions[0].get("mode")).toBe("payment");
      await expect(startPayment(x.client, bal.id)).rejects.toThrow(/isn't due yet/);
      await db.contract.update({ where: { id: x.k.id }, data: { completedAt: new Date(Date.now() - 20 * 864e5) } });
      const t0 = await todayData(x.w.id, { staffId: m.id, seeBusiness: true });
      expect(t0!.money.dueMinor).toBe(36000);                          // only the deposit is due now
      // 2. Stripe says the deposit is paid. It is marked paid once, with one receipt, even if Stripe repeats the event.
      const ev = { id: "cs_1", metadata: { intentId: dep.id }, payment_status: "paid", payment_intent: "pi_dep", customer_details: { email: "hana@client.test", name: "Hana" } };
      await applyStripeEvent("checkout.session.completed", ev, x.w.id); await applyStripeEvent("checkout.session.completed", ev, x.w.id);
      expect(await db.billingIntent.findUniqueOrThrow({ where: { id: dep.id } })).toMatchObject({ status: "paid", paidVia: "stripe" });
      expect(await db.receipt.count({ where: { intentId: dep.id } })).toBe(1);
      expect(await db.billingIntent.findUniqueOrThrow({ where: { id: bal.id } })).toMatchObject({ status: "pending", requestedAt: null });   // the final payment is untouched
      // 3. The team asks for the final payment: the customer is emailed and can now pay exactly the rest.
      await requestFinalPayment(x.staff, x.k.id);
      await startPayment(x.client, bal.id);
      expect(sessions[1].get("line_items[0][price_data][unit_amount]")).toBe("54000");
      const total = Number(sessions[0].get("line_items[0][price_data][unit_amount]")) + Number(sessions[1].get("line_items[0][price_data][unit_amount]"));
      expect(total).toBe(90000);                                       // the two halves add up to exactly what was agreed
      // 4. The final payment is paid. Everything is paid, two receipts, nothing left due.
      await applyStripeEvent("checkout.session.completed", { id: "cs_2", metadata: { intentId: bal.id }, payment_status: "paid", payment_intent: "pi_bal", customer_details: { email: "hana@client.test", name: "Hana" } }, x.w.id);
      expect((await db.billingIntent.findMany({ where: { contractId: x.k.id } })).every((b) => b.status === "paid")).toBe(true);
      expect(await db.receipt.count({ where: { customerId: x.c.id } })).toBe(2);
      const t1 = await todayData(x.w.id, { staffId: m.id, seeBusiness: true });
      expect(t1!.money.dueMinor).toBe(0);
      expect((await suggestionsFor(x.staff)).filter((s) => s.id.startsWith("unpaid:"))).toHaveLength(0);
    } finally { spy.mockRestore(); if (key === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = key; }
  });

  it("does not tell the team to chase a final payment that has not been asked for yet, but does once it has been asked for and left", async () => {
    const x = await world();
    const bal = await db.billingIntent.findFirstOrThrow({ where: { contractId: x.k.id, kind: "balance" } });
    await db.billingIntent.updateMany({ where: { contractId: x.k.id, kind: "deposit" }, data: { status: "paid", paidAt: new Date() } });
    await db.contract.update({ where: { id: x.k.id }, data: { completedAt: new Date(Date.now() - 30 * 864e5) } });
    expect((await suggestionsFor(x.staff)).filter((s) => s.id === `unpaid:${bal.id}`)).toHaveLength(0);            // locked: no nag
    await db.billingIntent.update({ where: { id: bal.id }, data: { requestedAt: new Date(Date.now() - 5 * 864e5) } });
    expect((await suggestionsFor(x.staff)).filter((s) => s.id === `unpaid:${bal.id}`)).toHaveLength(1);            // asked 5 days ago and still unpaid: nudge
  });
});

describe("money in on the home page", () => {
  it("counts payments that were actually received, not plans that have only started", async () => {
    const x = await world();
    const m = await db.staffMembership.findFirstOrThrow({ where: { workspaceId: x.w.id } });
    const dep = await db.billingIntent.findFirstOrThrow({ where: { contractId: x.k.id, kind: "deposit" } });
    expect((await todayData(x.w.id, { staffId: m.id, seeBusiness: true }))!.months.reduce((n, mo) => n + mo.value, 0)).toBe(0);
    await applyStripeEvent("checkout.session.completed", { id: "cs_in", metadata: { intentId: dep.id }, payment_status: "paid", payment_intent: "pi_in", customer_details: { email: "hana@client.test", name: "Hana" } }, x.w.id);
    expect((await todayData(x.w.id, { staffId: m.id, seeBusiness: true }))!.months.reduce((n, mo) => n + mo.value, 0)).toBe(360);   // the £360 deposit, once
  });
});

import { readFileSync } from "node:fs";
import { emailPaymentLink, startCarePlanNow } from "@/modules/billing/service";

describe("telling the customer how to pay, and the care plan opening at launch", () => {
  it("emails the deposit straight after signing, and again whenever the team asks", async () => {
    const x = await world();
    const first = await db.outbox.findMany({ where: { workspaceId: x.w.id, topic: "email.payment_ready" } });
    expect(first).toHaveLength(1); expect(first[0].payload).toMatchObject({ to: "hana@client.test", what: "deposit", amount: "£360.00", ref: x.k.reference });
    const dep = await db.billingIntent.findFirstOrThrow({ where: { contractId: x.k.id, kind: "deposit" } });
    const bal = await db.billingIntent.findFirstOrThrow({ where: { contractId: x.k.id, kind: "balance" } });
    await expect(emailPaymentLink(x.staff, bal.id)).rejects.toThrow(/isn't due yet/);                      // a locked final payment has no link to send yet
    expect(await emailPaymentLink(x.staff, dep.id)).toBe("hana@client.test");
    expect(await db.outbox.count({ where: { workspaceId: x.w.id, topic: "email.payment_ready" } })).toBe(2);
    await db.billingIntent.update({ where: { id: dep.id }, data: { status: "paid", paidAt: new Date() } });
    await expect(emailPaymentLink(x.staff, dep.id)).rejects.toThrow(/isn't waiting to be paid/);           // nothing to send once it is paid
    expect(await db.auditEvent.count({ where: { workspaceId: x.w.id, action: "billing.link_emailed" } })).toBe(1);
  });

  it("opens a paid care plan when the site goes live, with one email, and lets the team open it early", async () => {
    const w = await db.workspace.create({ data: { name: `cp-${Math.random()}` } });
    const m = await db.staffMembership.create({ data: { workspaceId: w.id, email: `s-${Math.random()}@x.test`, displayName: "A", role: "owner", status: "active" } });
    const staff: StaffCtx = { userId: null as unknown as string, staffId: m.id, workspaceId: w.id, role: "owner", name: "A", email: m.email };
    const c = await db.customer.create({ data: { workspaceId: w.id, reference: `OSS-CU-${Math.random().toString(36).slice(2, 8)}`, displayName: "Card Plan Ltd" } });
    await db.contact.create({ data: { workspaceId: w.id, customerId: c.id, name: "Cara Lee", email: "cara@card.test", isPrimary: true } });
    const p = await db.proposal.create({ data: { workspaceId: w.id, customerId: c.id, reference: `OSS-QT-${Math.random().toString(36).slice(2, 8)}`, title: "Site", currentVersion: 1 } });
    const v = await db.proposalVersion.create({ data: { workspaceId: w.id, proposalId: p.id, number: 1, scope: "x", terms: "", currency: "GBP", oneOffMinor: 50000, recurringMinor: 2900, recurringPeriod: "month", requirements: { promoFreeMonths: "2" } as never } });
    const k = await db.contract.create({ data: { workspaceId: w.id, customerId: c.id, reference: `OSS-OF-${Math.random().toString(36).slice(2, 8)}`, title: "Website", status: "completed", scopeSnapshot: "x", oneOffMinor: 50000, recurringMinor: 2900, proposalVersionId: v.id } });
    await db.$transaction((tx) => runCompletionWorkflow(tx, k.id));
    const plan = await db.billingIntent.findFirstOrThrow({ where: { contractId: k.id, kind: "recurring_setup" } });
    expect(plan).toMatchObject({ status: "pending", requestedAt: null, trialMonths: 2 }); expect(isScheduled(plan)).toBe(true);     // locked: it does not start at signing
    const project = await db.project.findFirstOrThrow({ where: { contractId: k.id } });
    await transitionProject(staff, project.id, "launched", project.version);
    expect((await db.billingIntent.findUniqueOrThrow({ where: { id: plan.id } })).requestedAt).toBeTruthy();
    const mail = await db.outbox.findMany({ where: { workspaceId: w.id, topic: "email.plan_ready" } });
    expect(mail).toHaveLength(1); expect(mail[0].payload).toMatchObject({ to: "cara@card.test", freeMonths: 2, amount: "£29.00" });
    await expect(startCarePlanNow(staff, k.id)).rejects.toThrow(/no care plan waiting/);                     // already open: pressing again is safe
    expect(await emailPaymentLink(staff, plan.id)).toBe("cara@card.test");                                   // and the team can resend the link
  });

  it("puts a free care period that started at signing back to waiting for launch (the repair for orders signed before this change)", async () => {
    const x = await world();
    const k2 = await db.contract.create({ data: { workspaceId: x.w.id, customerId: x.c.id, reference: `OSS-OF-${Math.random().toString(36).slice(2, 8)}`, title: "Old order", status: "completed", scopeSnapshot: "x", oneOffMinor: 0, recurringMinor: 2900 } });
    await db.project.create({ data: { workspaceId: x.w.id, customerId: x.c.id, contractId: k2.id, reference: `OSS-PR-${Math.random().toString(36).slice(2, 8)}`, name: "Old", scopeSnapshot: "x" } });
    const ends = new Date(Date.now() + 30 * 864e5);
    const old = await db.billingIntent.create({ data: { workspaceId: x.w.id, customerId: x.c.id, contractId: k2.id, kind: "recurring_setup", amountMinor: 2900, status: "active", paidVia: "free", paidAt: new Date(), trialMonths: 1, trialEndsAt: ends, cancelsAt: ends } });
    const remind = await db.task.create({ data: { workspaceId: x.w.id, customerId: x.c.id, title: "Old Co: free care plan ends 4 Dec 2026. Ask if they want to continue" } });
    const sql = readFileSync("prisma/migrations/20261105100000_free_care_starts_at_launch/migration.sql", "utf8");
    for (const stmt of sql.split(/;\s*\n/).map((t) => t.replace(/^--.*$/gm, "").trim()).filter(Boolean)) await db.$executeRawUnsafe(stmt);
    expect(await db.billingIntent.findUniqueOrThrow({ where: { id: old.id } })).toMatchObject({ status: "pending", paidAt: null, trialEndsAt: null, cancelsAt: null, paidVia: "free" });
    expect(await db.task.findUnique({ where: { id: remind.id } })).toBeNull();
    // running it again changes nothing
    for (const stmt of sql.split(/;\s*\n/).map((t) => t.replace(/^--.*$/gm, "").trim()).filter(Boolean)) await db.$executeRawUnsafe(stmt);
    expect((await db.billingIntent.findUniqueOrThrow({ where: { id: old.id } })).status).toBe("pending");
  });
});
