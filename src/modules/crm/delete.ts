import { db } from "@/lib/db";
import { DomainError, forbidden, notFound } from "@/lib/errors";
import { can } from "@/modules/identity/permissions";
import type { StaffCtx } from "@/modules/identity/session";

/**
 * Deletes a business and everything under it: people, tickets and files, orders and signed agreements, projects, payments records,
 * notes and calendar entries. The only thing left is the tamper-proof security log, which cannot be edited by design and holds just ids, never the business's details. Portal logins that belonged only to this business are removed too.
 * Money already taken in Stripe is not touched (refund or cancel there first if needed). The team is asked to confirm by typing the name.
 */
export async function deleteBusiness(ctx: StaffCtx, customerId: string, typedName: string) {
  if (!can(ctx.role, "customer.write")) throw forbidden();
  const cu = await db.customer.findFirst({ where: { id: customerId, workspaceId: ctx.workspaceId }, select: { id: true, displayName: true } });
  if (!cu) throw notFound("Business not found.");
  if (typedName.trim().toLowerCase() !== cu.displayName.trim().toLowerCase()) throw new DomainError("validation", "The name you typed doesn't match, so nothing was deleted.");
  const active = await db.billingIntent.count({ where: { customerId, stripeSubscriptionId: { not: null }, status: { in: ["active", "past_due"] } } });
  if (active > 0) throw new DomainError("conflict", "This business has a monthly plan running in Stripe. Cancel it in Stripe first, then delete the business.");

  await db.$transaction(async (tx) => {
    const w = { workspaceId: ctx.workspaceId };
    const [projects, contracts, proposals, signing, memberships] = await Promise.all([
      tx.project.findMany({ where: { customerId, ...w }, select: { id: true } }),
      tx.contract.findMany({ where: { customerId, ...w }, select: { id: true } }),
      tx.proposal.findMany({ where: { customerId, ...w }, select: { id: true } }),
      tx.signingRequest.findMany({ where: { contract: { customerId } }, select: { id: true } }),
      tx.clientMembership.findMany({ where: { customerId }, select: { userId: true } }),
    ]);
    const projectIds = projects.map((p) => p.id), contractIds = contracts.map((c) => c.id), proposalIds = proposals.map((p) => p.id), signingIds = signing.map((s) => s.id);
    const versions = await tx.proposalVersion.findMany({ where: { proposalId: { in: proposalIds } }, select: { id: true } });
    const versionIds = versions.map((v) => v.id);

    await tx.attachment.deleteMany({ where: { customerId } });
    await tx.ticket.deleteMany({ where: { customerId, ...w } });          // comments go with them
    await tx.accessRequest.deleteMany({ where: { customerId } });
    await tx.note.deleteMany({ where: { OR: [{ customerId }, { projectId: { in: projectIds } }], ...w } });
    await tx.calendarEvent.deleteMany({ where: { OR: [{ customerId }, { projectId: { in: projectIds } }], ...w } });
    await tx.task.deleteMany({ where: { OR: [{ customerId }, { projectId: { in: projectIds } }], ...w } });
    await tx.projectUpdate.deleteMany({ where: { projectId: { in: projectIds } } });
    await tx.assetRequest.deleteMany({ where: { projectId: { in: projectIds } } });
    await tx.project.deleteMany({ where: { id: { in: projectIds } } });
    await tx.billingIntent.deleteMany({ where: { contractId: { in: contractIds } } });
    await tx.contractDocument.deleteMany({ where: { contractId: { in: contractIds } } });
    await tx.signatureRecord.deleteMany({ where: { signingRequestId: { in: signingIds } } });
    await tx.scopedLinkToken.deleteMany({ where: { entityId: { in: [...signingIds, ...proposalIds, ...versionIds] } } });
    await tx.signingRequest.deleteMany({ where: { id: { in: signingIds } } });
    await tx.contract.deleteMany({ where: { id: { in: contractIds } } });
    await tx.proposalAcceptance.deleteMany({ where: { versionId: { in: versionIds } } });
    await tx.proposalLine.deleteMany({ where: { versionId: { in: versionIds } } });
    await tx.proposalVersion.deleteMany({ where: { id: { in: versionIds } } });
    await tx.proposal.deleteMany({ where: { id: { in: proposalIds } } });
    await tx.opportunity.deleteMany({ where: { customerId, ...w } });
    await tx.invitation.deleteMany({ where: { customerId } });
    await tx.clientMembership.deleteMany({ where: { customerId } });
    await tx.contact.deleteMany({ where: { customerId, ...w } });
    await tx.customer.delete({ where: { id: customerId } });
    // A login that only ever belonged to this business goes too, so the email can be used again.
    for (const { userId } of memberships) {
      const other = await tx.clientMembership.count({ where: { userId } });
      const isStaff = await tx.staffMembership.count({ where: { userId } });
      if (!other && !isStaff) await tx.user.deleteMany({ where: { id: userId } });
    }
  }, { timeout: 30_000 });
  return cu.displayName;
}
