import { z } from "zod";
import { db } from "@/lib/db";
import { audit, enqueue } from "@/lib/audit";
import { DomainError, forbidden, notFound } from "@/lib/errors";
import { portalLink, manageLink } from "@/lib/env";
import { can } from "@/modules/identity/permissions";
import type { StaffCtx } from "@/modules/identity/session";
import type { ClientCtx } from "@/modules/portal/service";
import { memberCan } from "@/modules/portal/access";
import { money } from "@/modules/billing/service";

const by = (ctx: StaffCtx) => ({ userId: ctx.userId, label: ctx.name });

/**
 * Change requests: work outside what their plan covers. The team sets a price, the customer approves it in the portal,
 * and the approval becomes a payment on their Billing page. A price of nothing means "included in your plan".
 */
const quoteInput = z.object({ price: z.coerce.number().min(0, "The price can't be negative.").max(100000, "That's too high. Check the amount."), note: z.string().trim().max(1000).optional() });

export async function quoteChange(ctx: StaffCtx, ticketId: string, raw: unknown) {
  if (!can(ctx.role, "customer.write")) throw forbidden();
  const i = quoteInput.parse(raw);
  const t = await db.ticket.findFirst({ where: { id: ticketId, workspaceId: ctx.workspaceId }, include: { contact: true, customer: { select: { displayName: true } } } });
  if (!t) throw notFound();
  if (t.chargeStatus === "approved" || t.chargeStatus === "paid") throw new DomainError("conflict", "The customer has already approved this price.");
  const minor = Math.round(i.price * 100);
  await db.$transaction(async (tx) => {
    if (minor === 0) {
      await tx.ticket.update({ where: { id: t.id }, data: { category: "change_request", priceMinor: 0, chargeStatus: "none" } });
      await audit(tx, { workspaceId: ctx.workspaceId, actor: by(ctx), action: "ticket.change_included", targetType: "ticket", targetId: t.id, customerId: t.customerId });
      return;
    }
    await tx.ticket.update({ where: { id: t.id }, data: { category: "change_request", priceMinor: minor, chargeStatus: "quoted", status: "waiting_customer", lastStaffAt: new Date(), remindedAt: null } });
    await tx.ticketComment.create({ data: { workspaceId: ctx.workspaceId, ticketId: t.id, authorKind: "staff", authorName: ctx.name, authorStaffId: ctx.staffId, body: `Price for this change: ${money(minor)}.${i.note ? ` ${i.note}` : ""} Please approve it to get started.` } });
    await audit(tx, { workspaceId: ctx.workspaceId, actor: by(ctx), action: "ticket.change_quoted", targetType: "ticket", targetId: t.id, customerId: t.customerId, detail: { priceMinor: minor } });
    if (t.contact?.email) await enqueue(tx, ctx.workspaceId, "email.change_request_quote", `change.quote:${t.id}:${minor}:${Date.now()}`, { to: t.contact.email, name: t.contact.name, ref: t.reference, title: t.title, price: money(minor), note: i.note ?? "", link: portalLink(`/help/${t.id}`) });
  });
}

const scope = (c: ClientCtx, customerId: string) => c.memberships.find((m) => m.customerId === customerId);

/** The customer says yes. Needs someone allowed to spend (owner or billing access). Creates the payment. */
export async function clientApproveChange(c: ClientCtx, ticketId: string) {
  const t = await db.ticket.findFirst({ where: { id: ticketId, customerId: { in: c.memberships.map((m) => m.customerId) } }, include: { customer: { select: { displayName: true } } } });
  if (!t) throw notFound();
  const m = scope(c, t.customerId)!;
  if (!memberCan(m, "billing")) throw new DomainError("forbidden", "Only the business owner, or someone with billing access, can approve a cost.");
  if (t.chargeStatus !== "quoted" || !t.priceMinor) throw new DomainError("conflict", t.chargeStatus === "approved" || t.chargeStatus === "paid" ? "You've already approved this." : "There's nothing to approve on this ticket.");
  await db.$transaction(async (tx) => {
    const done = await tx.ticket.updateMany({ where: { id: t.id, chargeStatus: "quoted" }, data: { chargeStatus: "approved", approvedAt: new Date(), approvedByName: c.name ?? "Customer", status: "open", lastCustomerAt: new Date() } });
    if (done.count === 0) return; // someone else approved a moment ago
    await tx.billingIntent.create({ data: { workspaceId: t.workspaceId, customerId: t.customerId, ticketId: t.id, kind: "change", amountMinor: t.priceMinor!, description: t.title } });
    await tx.ticketComment.create({ data: { workspaceId: t.workspaceId, ticketId: t.id, authorKind: "client", authorName: c.name ?? "Customer", authorUserId: c.userId, body: `Approved the price of ${money(t.priceMinor!)}.` } });
    await audit(tx, { workspaceId: t.workspaceId, actor: { userId: c.userId, label: c.name ?? "Client" }, action: "ticket.change_approved", targetType: "ticket", targetId: t.id, customerId: t.customerId, detail: { priceMinor: t.priceMinor } });
    await enqueue(tx, t.workspaceId, "email.change_request_decision", `change.decision:${t.id}:approved`, { to: "internal", approved: true, business: t.customer.displayName, person: c.name ?? "Customer", ref: t.reference, title: t.title, price: money(t.priceMinor!), link: manageLink(`/support/${t.id}`) });
  });
}

export async function clientDeclineChange(c: ClientCtx, ticketId: string, reason?: string) {
  const t = await db.ticket.findFirst({ where: { id: ticketId, customerId: { in: c.memberships.map((m) => m.customerId) } }, include: { customer: { select: { displayName: true } } } });
  if (!t) throw notFound();
  if (!memberCan(scope(c, t.customerId)!, "billing")) throw new DomainError("forbidden", "Only the business owner, or someone with billing access, can answer a cost.");
  if (t.chargeStatus !== "quoted") throw new DomainError("conflict", "There's nothing to decline on this ticket.");
  const note = (reason ?? "").trim().slice(0, 500);
  await db.$transaction(async (tx) => {
    await tx.ticket.update({ where: { id: t.id }, data: { chargeStatus: "declined", status: "open", lastCustomerAt: new Date() } });
    await tx.ticketComment.create({ data: { workspaceId: t.workspaceId, ticketId: t.id, authorKind: "client", authorName: c.name ?? "Customer", authorUserId: c.userId, body: `Not going ahead at ${money(t.priceMinor ?? 0)}.${note ? ` ${note}` : ""}` } });
    await audit(tx, { workspaceId: t.workspaceId, actor: { userId: c.userId, label: c.name ?? "Client" }, action: "ticket.change_declined", targetType: "ticket", targetId: t.id, customerId: t.customerId });
    await enqueue(tx, t.workspaceId, "email.change_request_decision", `change.decision:${t.id}:declined:${Date.now()}`, { to: "internal", approved: false, business: t.customer.displayName, person: c.name ?? "Customer", ref: t.reference, title: t.title, price: money(t.priceMinor ?? 0), link: manageLink(`/support/${t.id}`) });
  });
}
