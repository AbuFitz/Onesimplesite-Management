import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { deleteBusiness } from "@/modules/crm/delete";
import { todayData } from "@/modules/today/service";
import { customerStatusCounts } from "@/modules/crm/service";
import { supportCounts } from "@/modules/support/service";
import { suggestionsFor } from "@/modules/smart/service";
import { enqueue, audit } from "@/lib/audit";
import { createTestClient, TEST_CLIENT_NAME } from "@/modules/crm/test-client";
import type { StaffCtx } from "@/modules/identity/session";

describe("deleting a company erases it from every number and every list", () => {
  it("our stats afterwards equal our stats as if it had never existed, and nothing of it is left behind", async () => {
    const w = await db.workspace.create({ data: { name: `ds-${Math.random()}` } });
    const m = await db.staffMembership.create({ data: { workspaceId: w.id, email: `s-${Math.random()}@x.test`, displayName: "A", role: "owner", status: "active" } });
    const ctx: StaffCtx = { userId: null as unknown as string, staffId: m.id, workspaceId: w.id, role: "owner", name: "A", email: m.email };
    // a real, untouched company that must keep counting
    const keep = await db.customer.create({ data: { workspaceId: w.id, reference: "OSS-CU-KEEP", displayName: "Keep Co", lifecycle: "active" } });
    await db.ticket.create({ data: { workspaceId: w.id, customerId: keep.id, reference: "OSS-TK-KEEP", title: "Keep ticket", body: "x", priority: "normal", status: "open" } });
    const snap = async () => JSON.stringify({ today: await todayData(w.id, { staffId: m.id, seeBusiness: true }), status: await customerStatusCounts(ctx), support: await supportCounts(w.id), bubble: (await suggestionsFor(ctx)).map((s) => s.title) });
    const before = await snap();

    // the playing-around company: signed order (money owed, a plan), tickets, a project, queued and sent emails, a receipt, activity
    const id = await createTestClient(ctx, `play-${Math.random().toString(36).slice(2, 8)}@example.test`);
    await db.ticket.create({ data: { workspaceId: w.id, customerId: id, reference: "OSS-TK-GONE", title: "Gone ticket", body: "x", priority: "urgent", status: "customer_replied" } });
    await db.opportunity.create({ data: { workspaceId: w.id, customerId: id, title: "Gone lead" } });
    const bi = await db.billingIntent.findFirstOrThrow({ where: { customerId: id, kind: "one_off" } });
    await db.billingIntent.update({ where: { id: bi.id }, data: { status: "paid", paidAt: new Date() } });
    await db.receipt.create({ data: { workspaceId: w.id, customerId: id, intentId: bi.id, ref: "RC-GONE", key: "k", description: "d", amountMinor: bi.amountMinor, method: "card", paidAt: new Date() } });
    const contact = await db.contact.findFirstOrThrow({ where: { customerId: id } });
    await db.$transaction(async (tx) => {
      await enqueue(tx, w.id, "email.ticket_reminder", "gone-1", { to: contact.email, name: "Demo", ref: "OSS-TK-GONE" });
      await enqueue(tx, w.id, "email.ticket_notice", "gone-2", { to: "internal", business: TEST_CLIENT_NAME, title: "Gone ticket", ref: "OSS-TK-GONE" });
      await enqueue(tx, w.id, "email.ticket_notice", "keep-1", { to: "internal", business: "Keep Co", title: "Keep ticket", ref: "OSS-TK-KEEP" });
      await audit(tx, { workspaceId: w.id, actor: { userId: null, label: "A" }, action: "ticket.created", targetType: "ticket", targetId: id, customerId: id });
    });
    expect(await snap()).not.toBe(before);                                        // it really did move the numbers while it existed

    await deleteBusiness(ctx, id, TEST_CLIENT_NAME);

    expect(await snap()).toBe(before);                                            // every figure is back to exactly what it was
    expect(await db.customer.count({ where: { id: keep.id } })).toBe(1);
    expect(await db.ticket.count({ where: { customerId: keep.id } })).toBe(1);
    for (const [n, c] of Object.entries({
      tickets: await db.ticket.count({ where: { customerId: id } }), billing: await db.billingIntent.count({ where: { customerId: id } }), receipts: await db.receipt.count({ where: { customerId: id } }),
      contracts: await db.contract.count({ where: { customerId: id } }), projects: await db.project.count({ where: { customerId: id } }), opportunities: await db.opportunity.count({ where: { customerId: id } }),
      contacts: await db.contact.count({ where: { customerId: id } }), activity: await db.auditEvent.count({ where: { customerId: id } }),
      emails: await db.outbox.count({ where: { workspaceId: w.id, dedupeKey: { in: ["gone-1", "gone-2"] } } }),
    })) expect(c, n).toBe(0);
    expect(await db.outbox.count({ where: { workspaceId: w.id, dedupeKey: "keep-1" } })).toBe(1);   // other companies' mail untouched
    const tomb = await db.auditEvent.findMany({ where: { workspaceId: w.id, action: "company.deleted" } });
    expect(tomb).toHaveLength(1); expect(JSON.stringify(tomb[0])).not.toContain(TEST_CLIENT_NAME);   // one line that it happened, with no details
  });
});
