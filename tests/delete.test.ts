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

describe("test client and deleting a company", () => {
  it("refuses an email that already has a login, such as your own team login", async () => {
    const ctx = await staffCtx();
    const email = `me-${Math.random().toString(36).slice(2, 8)}@example.test`;
    await db.user.create({ data: { id: `u-${Math.random()}`, name: "Me", email } });
    await expect(createTestClient(ctx, email)).rejects.toThrow(/already has a login/);
  });

  it("deletes a company and absolutely everything under it, and leaves other companies alone", async () => {
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
    // the protected trail a signed order leaves behind: signing request, signature, final PDF, receipt, logo, passkey
    const k = await db.contract.findFirstOrThrow({ where: { customerId: id } });
    const sr = await db.signingRequest.create({ data: { workspaceId: ctx.workspaceId, contractId: k.id, signerName: "Demo", signerEmail: email, contentText: "x", contentSha256: "abc", expiresAt: new Date(Date.now() + 1e9) } });
    await db.signatureRecord.create({ data: { workspaceId: ctx.workspaceId, signingRequestId: sr.id, signerName: "Demo", method: "typed", consentText: "c", consentVersion: "1", evidence: {}, evidenceSha256: "e" } });
    await db.contractDocument.create({ data: { workspaceId: ctx.workspaceId, contractId: k.id, kind: "final_pdf", bytes: Buffer.alloc(8), sha256: "s" } });
    const bi = await db.billingIntent.findFirstOrThrow({ where: { customerId: id } });
    await db.receipt.create({ data: { workspaceId: ctx.workspaceId, customerId: id, intentId: bi.id, ref: `RC-${Math.random()}`, key: "k", description: "d", amountMinor: 100, method: "card", paidAt: new Date() } });
    await db.companyLogo.create({ data: { customerId: id, workspaceId: ctx.workspaceId, bytes: Buffer.alloc(4), type: "image/png" } });
    await db.passkey.create({ data: { id: `pk-${u.id}`, userId: u.id, publicKey: "k", credentialID: `c-${u.id}`, counter: 0, deviceType: "singleDevice", backedUp: false } });

    await expect(deleteBusiness(ctx, id, "wrong name")).rejects.toThrow(/doesn't match/);
    expect(await db.customer.count({ where: { id } })).toBe(1);
    await resetTestClient(ctx);

    for (const [name, n] of Object.entries({
      customer: await db.customer.count({ where: { id } }), contacts: await db.contact.count({ where: { customerId: id } }), tickets: await db.ticket.count({ where: { customerId: id } }),
      files: await db.attachment.count({ where: { customerId: id } }), contracts: await db.contract.count({ where: { customerId: id } }), billing: await db.billingIntent.count({ where: { customerId: id } }),
      projects: await db.project.count({ where: { customerId: id } }), notes: await db.note.count({ where: { customerId: id } }), opps: await db.opportunity.count({ where: { customerId: id } }),
      members: await db.clientMembership.count({ where: { customerId: id } }), invites: await db.invitation.count({ where: { customerId: id } }),
      signatures: await db.signatureRecord.count({ where: { signingRequestId: sr.id } }), documents: await db.contractDocument.count({ where: { contractId: k.id } }), receipts: await db.receipt.count({ where: { customerId: id } }), logo: await db.companyLogo.count({ where: { customerId: id } }), passkeys: await db.passkey.count({ where: { userId: u.id } }),
    })) expect(n, name).toBe(0);
    expect(await db.user.count({ where: { id: u.id } })).toBe(0);                        // the login that only belonged to this company is gone
    expect(await db.customer.count({ where: { id: other.id } })).toBe(1);               // other companies untouched
    expect(await db.contact.count({ where: { customerId: other.id } })).toBe(1);
  });

  it("will not delete a company with a monthly plan still running in Stripe", async () => {
    const ctx = await staffCtx();
    const id = await createTestClient(ctx, `d-${Math.random().toString(36).slice(2, 8)}@example.test`);
    await db.billingIntent.updateMany({ where: { customerId: id, kind: "recurring_setup" }, data: { status: "active", stripeSubscriptionId: "sub_live" } });
    await expect(deleteBusiness(ctx, id, TEST_CLIENT_NAME)).rejects.toThrow(/monthly plan running/);
  });
});

describe("demo order numbers", () => {
  it("come from the quotation counter, so a real order can never take the same number", async () => {
    const ctx = await staffCtx();
    const id = await createTestClient(ctx, `n-${Math.random().toString(36).slice(2, 8)}@example.test`);
    const k = await db.contract.findFirstOrThrow({ where: { customerId: id } });
    expect(k.reference).toMatch(/^OSS-OF-\d{4}-\d{3}$/);
    const next = await db.$transaction((tx) => import("@/lib/audit").then((m) => m.nextRef(tx, ctx.workspaceId, "quotation")));
    expect(next.replace("OSS-QT-", "OSS-OF-")).not.toBe(k.reference);
  });
});
