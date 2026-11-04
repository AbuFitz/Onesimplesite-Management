import { describe, it, expect, vi } from "vitest";
import { db } from "@/lib/db";
import { clientCreateTicket, clientReply, staffReply, updateSupportTicket, staffCreateTicket } from "@/modules/support/service";
import { quoteChange, clientApproveChange, clientDeclineChange } from "@/modules/support/change";
import { runTicketReminders } from "@/modules/support/reminders";
import { clientBilling, startPayment, applyStripeEvent } from "@/modules/billing/service";
import type { StaffCtx } from "@/modules/identity/session";
import type { ClientCtx } from "@/modules/portal/service";

async function world() {
  const w = await db.workspace.create({ data: { name: `tf-${Math.random()}` } });
  const m = await db.staffMembership.create({ data: { workspaceId: w.id, email: `s-${Math.random()}@example.test`, displayName: "Abukar", role: "owner", status: "active" } });
  const staff: StaffCtx = { userId: null as unknown as string, staffId: m.id, workspaceId: w.id, role: "owner", name: "Abukar", email: m.email };
  const c = await db.customer.create({ data: { workspaceId: w.id, reference: `OSS-CU-${Math.random().toString(36).slice(2, 8)}`, displayName: "Harbour Bakery" } });
  const mk = async (name: string, role: "admin" | "member", billing = false) => {
    const email = `${name.split(" ")[0].toLowerCase()}-${Math.random().toString(36).slice(2, 8)}@client.test`;
    await db.contact.create({ data: { workspaceId: w.id, customerId: c.id, name, email, isPrimary: role === "admin" } });
    return { userId: `u-${name}-${Math.random()}`, name, email, memberships: [{ customerId: c.id, role, billing, customer: { id: c.id, displayName: "Harbour Bakery", workspaceId: w.id } }] } as ClientCtx;
  };
  return { w, staff, c, owner: await mk("Olu Owner", "admin"), member: await mk("Mia Member", "member") };
}
const t0 = { kind: "request", title: "Add a booking page", body: "We'd like online bookings.", urgency: "normal" };
const outbox = async (ws: string, topic: string) => (await db.outbox.findMany({ where: { workspaceId: ws, topic } })).map((o) => o.payload as Record<string, unknown>);

describe("ticket statuses", () => {
  it("customer reply = Customer replied, our reply = Waiting on customer, resolving emails them once", async () => {
    const x = await world();
    const t = await clientCreateTicket(x.owner, undefined, t0);
    expect(t.lastCustomerAt).toBeTruthy();
    await staffReply(x.staff, t.id, { body: "On it." });
    let r = await db.ticket.findUniqueOrThrow({ where: { id: t.id } });
    expect(r.status).toBe("waiting_customer"); expect(r.lastStaffAt).toBeTruthy();
    await clientReply(x.owner, t.id, "Thanks!");
    r = await db.ticket.findUniqueOrThrow({ where: { id: t.id } });
    expect(r.status).toBe("customer_replied");
    await updateSupportTicket(x.staff, t.id, { status: "resolved" });
    await updateSupportTicket(x.staff, t.id, { status: "resolved" });
    expect(await outbox(x.w.id, "email.ticket_resolved")).toHaveLength(0);   // off by default: they can see the status in the portal
    await db.workspace.update({ where: { id: x.w.id }, data: { settings: { notify: { "email.ticket_resolved": "instant" } } } });
    await updateSupportTicket(x.staff, t.id, { status: "in_progress" });
    await updateSupportTicket(x.staff, t.id, { status: "resolved" });
    expect(await outbox(x.w.id, "email.ticket_resolved")).toHaveLength(1);
    await clientReply(x.owner, t.id, "Actually it's still broken.");           // replying reopens it
    expect((await db.ticket.findUniqueOrThrow({ where: { id: t.id } })).status).toBe("customer_replied");
  });
});

describe("change requests", () => {
  it("team prices it, only an owner/billing person can approve, approval creates one payment, and paying marks the ticket paid", async () => {
    const x = await world();
    const t = await clientCreateTicket(x.owner, undefined, t0);
    await quoteChange(x.staff, t.id, { price: 180, note: "Includes setup." });
    let r = await db.ticket.findUniqueOrThrow({ where: { id: t.id } });
    expect(r).toMatchObject({ category: "change_request", priceMinor: 18000, chargeStatus: "quoted", status: "waiting_customer" });
    expect((await outbox(x.w.id, "email.change_request_quote"))[0]).toMatchObject({ price: "£180.00" });
    await expect(clientApproveChange(x.member, t.id)).rejects.toThrow(/owner, or someone with billing/);
    await Promise.all([clientApproveChange(x.owner, t.id), clientApproveChange(x.owner, t.id)]);   // double click
    r = await db.ticket.findUniqueOrThrow({ where: { id: t.id } });
    expect(r).toMatchObject({ chargeStatus: "approved", status: "open", approvedByName: "Olu Owner" });
    const bills = await db.billingIntent.findMany({ where: { ticketId: t.id } });
    expect(bills).toHaveLength(1); expect(bills[0]).toMatchObject({ kind: "change", amountMinor: 18000, contractId: null });
    expect(await outbox(x.w.id, "email.change_request_decision")).toHaveLength(1);
    expect((await clientBilling(x.owner)).map((b) => b.id)).toContain(bills[0].id);
    await expect(quoteChange(x.staff, t.id, { price: 99 })).rejects.toThrow(/already approved/);

    const key = process.env.STRIPE_SECRET_KEY; process.env.STRIPE_SECRET_KEY = "sk_test_x";
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (u, init) => new Response(JSON.stringify(String(u).endsWith("/customers") ? { id: "cus_1" } : { id: "cs_1", url: "https://stripe.test/pay" }), { status: 200 }));
    try { expect(await startPayment(x.owner, bills[0].id)).toBe("https://stripe.test/pay"); } finally { spy.mockRestore(); if (key) process.env.STRIPE_SECRET_KEY = key; else delete process.env.STRIPE_SECRET_KEY; }
    await applyStripeEvent("checkout.session.completed", { id: "cs_1", metadata: { intentId: bills[0].id }, payment_status: "paid" }, x.w.id);
    expect((await db.ticket.findUniqueOrThrow({ where: { id: t.id } })).chargeStatus).toBe("paid");
    const pay = await outbox(x.w.id, "email.payment_received");
    expect(pay[0]).toMatchObject({ what: "Add a booking page" });                                       // receipt names the change, not an order
  });
  it("£0 means included in their plan; a decline tells the team and creates no payment", async () => {
    const x = await world();
    const a = await clientCreateTicket(x.owner, undefined, t0);
    await quoteChange(x.staff, a.id, { price: 0 });
    expect(await db.ticket.findUniqueOrThrow({ where: { id: a.id } })).toMatchObject({ category: "change_request", chargeStatus: "none", priceMinor: 0 });
    expect(await outbox(x.w.id, "email.change_request_quote")).toHaveLength(0);
    const b = await clientCreateTicket(x.owner, undefined, { ...t0, title: "Redo the whole logo" });
    await quoteChange(x.staff, b.id, { price: 900 });
    await clientDeclineChange(x.owner, b.id, "Too much for now");
    expect(await db.ticket.findUniqueOrThrow({ where: { id: b.id } })).toMatchObject({ chargeStatus: "declined" });
    expect(await db.billingIntent.count({ where: { ticketId: b.id } })).toBe(0);
    expect((await outbox(x.w.id, "email.change_request_decision")).some((p) => p.approved === false)).toBe(true);
  });
  it("a staff-raised change request starts in the right category", async () => {
    const x = await world();
    const person = await db.contact.findFirstOrThrow({ where: { customerId: x.c.id } });
    const t = await staffCreateTicket(x.staff, { customerId: x.c.id, contactId: person.id, category: "change_request", title: "Move the menu page", body: "They phoned.", priority: "normal" });
    expect(t.category).toBe("change_request");
  });
});

describe("reminders", () => {
  it("nudges us about waiting customers once a day, and nudges customers at 3 and 7 days then closes at 10", async () => {
    const x = await world();
    const now = new Date();
    const ago = (h: number) => new Date(+now - h * 3_600_000);
    const t = await clientCreateTicket(x.owner, undefined, { ...t0, urgency: "high" });          // high = 4 hours
    await db.ticket.update({ where: { id: t.id }, data: { lastCustomerAt: ago(2) } });
    await runTicketReminders(now); expect(await outbox(x.w.id, "email.ticket_team_reminder")).toHaveLength(0);
    await db.ticket.update({ where: { id: t.id }, data: { lastCustomerAt: ago(6) } });
    await runTicketReminders(now); await runTicketReminders(now);
    const digest = await outbox(x.w.id, "email.ticket_team_reminder");
    expect(digest).toHaveLength(1); expect((digest[0].items as unknown[]).length).toBe(1);

    const u = await clientCreateTicket(x.owner, undefined, { ...t0, title: "Another thing" });
    await staffReply(x.staff, u.id, { body: "Could you send the photos?" });
    const setAge = (days: number) => db.ticket.update({ where: { id: u.id }, data: { lastStaffAt: new Date(+now - days * 864e5) } });
    await setAge(2); await runTicketReminders(now); expect(await outbox(x.w.id, "email.ticket_reminder")).toHaveLength(0);
    await setAge(3.2); await runTicketReminders(now); await runTicketReminders(now);
    expect((await outbox(x.w.id, "email.ticket_reminder")).map((p) => p.final)).toEqual([false]);
    await db.ticket.update({ where: { id: u.id }, data: { remindedAt: ago(96) } });   // the first nudge went out four days ago
    await setAge(7.2); await runTicketReminders(now);
    expect((await outbox(x.w.id, "email.ticket_reminder")).map((p) => p.final).sort()).toEqual([false, true]);
    await setAge(10.5); await runTicketReminders(now);
    expect(await db.ticket.findUniqueOrThrow({ where: { id: u.id } })).toMatchObject({ status: "resolved" });
    expect((await db.ticketComment.findMany({ where: { ticketId: u.id } })).some((c) => /marked this as sorted/.test(c.body))).toBe(true);
  });
});
