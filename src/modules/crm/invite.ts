import { db } from "@/lib/db";
import { audit, enqueue } from "@/lib/audit";
import { DomainError, forbidden, notFound } from "@/lib/errors";
import { newToken } from "@/lib/tokens";
import { portalLink } from "@/lib/env";
import { can } from "@/modules/identity/permissions";
import type { StaffCtx } from "@/modules/identity/session";

/** Explicit, audited portal invitation for one contact. Adding a contact never grants access by itself. */
export async function inviteClientContact(ctx: StaffCtx, customerId: string, contactId: string) {
  if (!can(ctx.role, "customer.write")) throw forbidden();
  await db.$transaction(async (tx) => {
    const c = await tx.contact.findFirst({ where: { id: contactId, customerId, workspaceId: ctx.workspaceId }, include: { customer: true } });
    if (!c) throw notFound("Contact not found.");
    if (!c.email) throw new DomainError("validation", "This contact has no email address.");
    await tx.invitation.updateMany({ where: { workspaceId: ctx.workspaceId, customerId, email: c.email, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
    const { token, hash } = newToken();
    const expiresAt = new Date(Date.now() + 7 * 864e5);
    const inv = await tx.invitation.create({ data: { workspaceId: ctx.workspaceId, kind: "client", email: c.email, tokenHash: hash, customerId, clientRole: "admin", expiresAt } });
    await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "client.invited", targetType: "contact", targetId: c.id, customerId });
    await enqueue(tx, ctx.workspaceId, "email.invitation", `invite:${inv.id}`, {
      to: c.email, businessName: c.customer.displayName, inviter: ctx.name, link: portalLink(`/invite/${token}`),
      expires: new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Europe/London" }).format(expiresAt),
    });
  });
}
