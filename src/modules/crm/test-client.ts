import { z } from "zod";
import { db } from "@/lib/db";
import { audit, nextRef } from "@/lib/audit";
import { DomainError, forbidden } from "@/lib/errors";
import { can } from "@/modules/identity/permissions";
import type { StaffCtx } from "@/modules/identity/session";
import { inviteClientContact } from "./invite";

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

  const contactId = await db.$transaction(async (tx) => {
    let cu = await tx.customer.findFirst({ where: { workspaceId: ctx.workspaceId, displayName: TEST_CLIENT_NAME } });
    if (!cu) {
      cu = await tx.customer.create({ data: { workspaceId: ctx.workspaceId, reference: await nextRef(tx, ctx.workspaceId, "customer"), displayName: TEST_CLIENT_NAME, legalName: "Test Client Ltd", kind: "business", businessType: "Food and drink", town: "Bristol", lifecycle: "active", source: "demo" } });
      const k = await tx.contract.create({ data: { workspaceId: ctx.workspaceId, customerId: cu.id, reference: await nextRef(tx, ctx.workspaceId, "order"), title: "Website for Test Client", status: "completed", scopeSnapshot: "A five-page website with a contact form. Demo order for testing.", oneOffMinor: 120000, recurringMinor: 4900, completedAt: new Date(), signingMode: "manual_record" } });
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
