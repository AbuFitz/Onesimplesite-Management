import { db } from "@/lib/db";
import { DomainError, forbidden, notFound } from "@/lib/errors";
import { can } from "@/modules/identity/permissions";
import type { StaffCtx } from "@/modules/identity/session";

/**
 * Deletes a company and everything under it: people, tickets and files, orders and signed agreements, projects, payments records,
 * notes and calendar entries. The only thing left is the tamper-proof security log, which cannot be edited by design and holds just ids, never the company's details. Portal logins that belonged only to this company are removed too.
 * Money already taken in Stripe is not touched (refund or cancel there first if needed). The team is asked to confirm by typing the name.
 */
export async function deleteBusiness(ctx: StaffCtx, customerId: string, typedName: string) {
  if (!can(ctx.role, "customer.write")) throw forbidden();
  const cu = await db.customer.findFirst({ where: { id: customerId, workspaceId: ctx.workspaceId }, select: { id: true, displayName: true } });
  if (!cu) throw notFound("Company not found.");
  if (typedName.trim().toLowerCase() !== cu.displayName.trim().toLowerCase()) throw new DomainError("validation", "The name you typed doesn't match, so nothing was deleted.");
  const active = await db.billingIntent.count({ where: { customerId, stripeSubscriptionId: { not: null }, status: { in: ["active", "past_due"] } } });
  if (active > 0) throw new DomainError("conflict", "This company has a monthly plan running in Stripe. Cancel it in Stripe first, then delete the company.");

  await db.$transaction(async (tx) => {
    const memberships = await tx.clientMembership.findMany({ where: { customerId }, select: { userId: true } });
    // The database does the erasure in one go (signed agreements and signatures are protected from everything else), see migration erase_company.
    await tx.$executeRaw`SELECT oss_erase_company(${ctx.workspaceId}::uuid, ${customerId}::uuid)`;
    // A login that only ever belonged to this company goes too, so the email can be used again.
    for (const { userId } of memberships) {
      const other = await tx.clientMembership.count({ where: { userId } });
      const isStaff = await tx.staffMembership.count({ where: { userId } });
      if (!other && !isStaff) await tx.user.deleteMany({ where: { id: userId } });
    }
  }, { timeout: 30_000 });
  return cu.displayName;
}
