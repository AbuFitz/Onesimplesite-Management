import { z } from "zod";
import { db } from "@/lib/db";
import { audit, nextRef } from "@/lib/audit";
import { DomainError, forbidden } from "@/lib/errors";
import { can } from "@/modules/identity/permissions";
import type { StaffCtx } from "@/modules/identity/session";
import { inviteClientContact } from "./invite";
import { deleteBusiness } from "./delete";

export const TEST_CLIENT_NAME = "Test Client (demo)";

/**
 * A ready-made demo business so the team can walk the whole client experience: portal sign-in, a signed order with a
 * website fee and a monthly plan to pay (use Stripe test cards), a project, and a ticket. Reuses the same demo account
 * if it already exists, and just sends a fresh portal invitation to the email given.
 */
export async function createTestClient(ctx: StaffCtx, rawEmail: unknown) {
  if (!can(ctx.role, "settings.write")) throw forbidden();
  const email = z.string().trim().toLowerCase().email("Enter the email you want the portal invitation sent to.").parse(rawEmail);
  const taken = await db.contact.findFirst({ where: { workspaceId: ctx.workspaceId, email: { equals: email, mode: "insensitive" }, customer: { displayName: { not: TEST_CLIENT_NAME } } } });
  if (taken) throw new DomainError("conflict", "That email already belongs to a real customer. Use a different address (a +test alias works, for example you+test@gmail.com).");

  // Staff and clients share one login directory, so an email that already has a login (usually your own team login) can't also be a portal login.
  const login = await db.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true, clientMemberships: { select: { customer: { select: { displayName: true } } } } } });
  if (login && !login.clientMemberships.some((m) => m.customer.displayName === TEST_CLIENT_NAME)) throw new DomainError("conflict", "That email already has a login (probably your team login), so it can't also be a portal login. Use a different address. With Gmail you can add +test, for example you+test@gmail.com, and it still arrives in your inbox.");

  const contactId = await db.$transaction(async (tx) => {
    let cu = await tx.customer.findFirst({ where: { workspaceId: ctx.workspaceId, displayName: TEST_CLIENT_NAME } });
    if (!cu) {
      cu = await tx.customer.create({ data: { workspaceId: ctx.workspaceId, reference: await nextRef(tx, ctx.workspaceId, "customer"), displayName: TEST_CLIENT_NAME, legalName: "Test Client Ltd", kind: "business", businessType: "Food and drink", town: "Bristol", lifecycle: "active", source: "demo" } });
      const k = await tx.contract.create({ data: { workspaceId: ctx.workspaceId, customerId: cu.id, reference: (await nextRef(tx, ctx.workspaceId, "quotation")).replace("OSS-QT-", "OSS-OF-"), title: "Website for Test Client", status: "completed", scopeSnapshot: "A five-page website with a contact form. Demo order for testing.", oneOffMinor: 120000, recurringMinor: 4900, completedAt: new Date(), signingMode: "manual_record" } });
      await tx.billingIntent.createMany({ data: [
        { workspaceId: ctx.workspaceId, customerId: cu.id, contractId: k.id, kind: "one_off", amountMinor: 120000, description: "Website" },
        { workspaceId: ctx.workspaceId, customerId: cu.id, contractId: k.id, kind: "recurring_setup", amountMinor: 4900, description: "Standard plan" },
      ] });
      await tx.project.create({ data: { workspaceId: ctx.workspaceId, customerId: cu.id, contractId: k.id, reference: await nextRef(tx, ctx.workspaceId, "project"), name: "Website for Test Client", stage: "design", scopeSnapshot: k.scopeSnapshot } });
      await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "demo.test_client_created", targetType: "customer", targetId: cu.id, customerId: cu.id });
    }
    const existing = await tx.contact.findFirst({ where: { workspaceId: ctx.workspaceId, customerId: cu.id, email: { equals: email, mode: "insensitive" } } });
    const person = existing ?? await tx.contact.create({ data: { workspaceId: ctx.workspaceId, customerId: cu.id, name: "Test Owner", email, position: "Owner", isPrimary: true } });
    return { customerId: cu.id, contactId: person.id };
  });
  await inviteClientContact(ctx, contactId.customerId, contactId.contactId);
  return contactId.customerId;
}

/** What the Testing page shows about the demo business. */
export async function testClientStatus(ctx: StaffCtx) {
  const cu = await db.customer.findFirst({ where: { workspaceId: ctx.workspaceId, displayName: TEST_CLIENT_NAME }, select: { id: true, reference: true, contacts: { select: { email: true } }, createdAt: true } });
  if (!cu) return null;
  const email = cu.contacts[0]?.email ?? null;
  const user = email ? await db.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } }) : null;
  const pending = email ? await db.invitation.count({ where: { customerId: cu.id, email: { equals: email, mode: "insensitive" }, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } } }) : 0;
  return { id: cu.id, reference: cu.reference, email, signedUp: !!user, invitePending: pending > 0 };
}

/** Wipes the demo business so you can start the test again. */
export async function resetTestClient(ctx: StaffCtx) {
  if (!can(ctx.role, "settings.write")) throw forbidden();
  const cu = await db.customer.findFirst({ where: { workspaceId: ctx.workspaceId, displayName: TEST_CLIENT_NAME }, select: { id: true } });
  if (!cu) return;
  // A running test plan has to be cancelled in Stripe first, so the plain delete check is skipped only for test-mode demo data.
  await db.billingIntent.updateMany({ where: { customerId: cu.id }, data: { stripeSubscriptionId: null } });
  await deleteBusiness(ctx, cu.id, TEST_CLIENT_NAME);
}
