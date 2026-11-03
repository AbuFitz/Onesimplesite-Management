import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { createTestClient, resetTestClient, TEST_CLIENT_NAME } from "@/modules/crm/test-client";
import { deleteBusiness } from "@/modules/crm/delete";
import { clientCreateTicket } from "@/modules/support/service";
import { saveUploads } from "@/modules/files/service";
import type { StaffCtx } from "@/modules/identity/session";
import type { ClientCtx } from "@/modules/portal/service";

async function staffCtx(): Promise<StaffCtx> {
  const w = await db.workspace.create({ data: { name: `del-${Math.random()}` } });
  const m = await db.staffMembership.create({ data: { workspaceId: w.id, email: `s-${Math.random()}@example.test`, displayName: "Abukar", role: "owner", status: "active" } });
  return { userId: null as unknown as string, staffId: m.id, workspaceId: w.id, role: "owner", name: "Abukar", email: m.email };
}

describe("test client and deleting a business", () => {
  it("refuses an email that already has a login, such as your own team login", async () => {
    const ctx = await staffCtx();
    const email = `me-${Math.random().toString(36).slice(2, 8)}@example.test`;
    await db.user.create({ data: { id: `u-${Math.random()}`, name: "Me", email } });
    await expect(createTestClient(ctx, email)).rejects.toThrow(/already has a login/);
  });

  it("deletes a business and absolutely everything under it, and leaves other businesses alone", async () => {
    const ctx = await staffCtx();
    const email = `demo-${Math.random().toString(36).slice(2, 8)}@example.test`;
    const id = await createTestClient(ctx, email);
    const other = await db.customer.create({ data: { workspaceId: ctx.workspaceId, reference: `OSS-CU-${Math.random().toString(36).slice(2, 8)}`, displayName: "Other Ltd" } });
    await db.contact.create({ data: { workspaceId: ctx.workspaceId, customerId: other.id, name: "Keep Me", email: "keep@x.test", isPrimary: true } });
    // a portal login for the demo person, a ticket with a file, a note, a calendar entry, an opportunity and a signed-style contract trail
    const u = await db.user.create({ data: { id: `u-${Math.random()}`, name: "Demo", email } });
    await db.clientMembership.create({ data: { userId: u.id, customerId: id, role: "admin" } });
    const client: ClientCtx = { userId: u.id, name: "Demo", email, memberships: [{ customerId: id, role: "admin", customer: { id, displayName: TEST_CLIENT_NAME, workspaceId: ctx.workspaceId } }] };
    const t = await clientCreateTicket(client, undefined, { kind: "issue", title: "Broken thing", body: "It is broken.", urgency: "normal" });
    await db.$transaction((tx) => saveUploads(tx, { workspaceId: ctx.workspaceId, customerId: id, ticketId: t.id, internal: false, by: "client", name: "Demo" }, [{ name: "a.png", type: "image/png", bytes: Buffer.alloc(20) }]));
    await db.note.create({ data: { workspaceId: ctx.workspaceId, title: "n", body: "b", ownerId: ctx.staffId, customerId: id, visibility: "team" } });
    await db.opportunity.create({ data: { workspaceId: ctx.workspaceId, customerId: id, title: "Lead" } });
    await db.auditEvent.create({ data: { workspaceId: ctx.workspaceId, action: "x", targetType: "customer", targetId: id, customerId: id } });

    await expect(deleteBusiness(ctx, id, "wrong name")).rejects.toThrow(/doesn't match/);
    expect(await db.customer.count({ where: { id } })).toBe(1);
    await resetTestClient(ctx);

    for (const [name, n] of Object.entries({
      customer: await db.customer.count({ where: { id } }), contacts: await db.contact.count({ where: { customerId: id } }), tickets: await db.ticket.count({ where: { customerId: id } }),
      files: await db.attachment.count({ where: { customerId: id } }), contracts: await db.contract.count({ where: { customerId: id } }), billing: await db.billingIntent.count({ where: { customerId: id } }),
      projects: await db.project.count({ where: { customerId: id } }), notes: await db.note.count({ where: { customerId: id } }), opps: await db.opportunity.count({ where: { customerId: id } }),
      members: await db.clientMembership.count({ where: { customerId: id } }), invites: await db.invitation.count({ where: { customerId: id } }),
    })) expect(n, name).toBe(0);
    expect(await db.user.count({ where: { id: u.id } })).toBe(0);                        // the login that only belonged to this business is gone
    expect(await db.customer.count({ where: { id: other.id } })).toBe(1);               // other businesses untouched
    expect(await db.contact.count({ where: { customerId: other.id } })).toBe(1);
  });

  it("will not delete a business with a monthly plan still running in Stripe", async () => {
    const ctx = await staffCtx();
    const id = await createTestClient(ctx, `d-${Math.random().toString(36).slice(2, 8)}@example.test`);
    await db.billingIntent.updateMany({ where: { customerId: id, kind: "recurring_setup" }, data: { status: "active", stripeSubscriptionId: "sub_live" } });
    await expect(deleteBusiness(ctx, id, TEST_CLIENT_NAME)).rejects.toThrow(/monthly plan running/);
  });
});
