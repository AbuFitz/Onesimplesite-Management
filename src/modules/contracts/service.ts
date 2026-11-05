import { z } from "zod";
import { db } from "@/lib/db";
import { audit, enqueue, nextRef } from "@/lib/audit";
import { DomainError, forbidden, notFound } from "@/lib/errors";
import { can } from "@/modules/identity/permissions";
import type { StaffCtx } from "@/modules/identity/session";

/** Contract moves to awaiting_signature only after staff have sent it via the agreed signing route. */
export async function markContractSent(ctx: StaffCtx, contractId: string) {
  if (!can(ctx.role, "contract.send")) throw forbidden();
  return db.$transaction(async (tx) => {
    const r = await tx.contract.updateMany({ where: { id: contractId, workspaceId: ctx.workspaceId, status: "draft" }, data: { status: "awaiting_signature", version: { increment: 1 } } });
    if (r.count === 0) throw new DomainError("conflict", "Only a draft contract can be sent.");
    const c = await tx.contract.findFirstOrThrow({ where: { id: contractId } });
    await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "contract.sent", targetType: "contract", targetId: contractId, customerId: c.customerId });
  });
}

export const completionInput = z.object({
  evidence: z.string().trim().min(10, "Describe the evidence (e.g. where the signed PDF is held).").max(2000),
});

/**
 * Manual completion record (signing mode manual_record). Wording stays factual:
 * "completion recorded by <staff>". This does not claim cryptographic verification.
 * Exactly-once: status transition is a conditional update; project and billing intents
 * are unique-keyed on the contract; replay returns the existing result.
 */
export async function recordContractCompletion(ctx: StaffCtx, contractId: string, raw: unknown) {
  if (!can(ctx.role, "contract.record_completion")) throw forbidden();
  const { evidence } = completionInput.parse(raw);
  return db.$transaction(async (tx) => {
    const c = await tx.contract.findFirst({ where: { id: contractId, workspaceId: ctx.workspaceId } });
    if (!c) throw notFound();
    if (["declined", "expired", "voided"].includes(c.status)) throw new DomainError("conflict", `Contract is ${c.status}.`);
    if (c.status !== "completed") {
      await tx.contract.update({ where: { id: c.id }, data: { status: "completed", completedAt: new Date(), completionRecordedBy: ctx.name, completionEvidence: evidence, version: { increment: 1 } } });
      await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "contract.completion_recorded", targetType: "contract", targetId: c.id, customerId: c.customerId, detail: { mode: c.signingMode } });
    }
    const project = await runCompletionWorkflow(tx, c.id);
    return { projectId: project.id };
  });
}

import { promoFrom } from "@/modules/billing/promo";
import { money } from "@/modules/billing/service";
import { portalLink } from "@/lib/env";
import { PROJECT_TYPES } from "@/modules/projects/service";

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

const workTypeOf = (t?: string) => (t && PROJECT_TYPES[t] ? t : "new_site");

/** Idempotent: unique(Project.contractId), unique(BillingIntent.contractId, kind), unique outbox key. */
export async function runCompletionWorkflow(tx: Tx, contractId: string) {
  const c = await tx.contract.findUniqueOrThrow({ where: { id: contractId }, include: { proposalVersion: { include: { proposal: true } } } });
  let project = await tx.project.findUnique({ where: { contractId } });
  if (!project) {
    const reference = await nextRef(tx, c.workspaceId, "project");
    project = await tx.project.create({
      data: { workspaceId: c.workspaceId, customerId: c.customerId, contractId, reference, name: c.title, scopeSnapshot: c.scopeSnapshot, stage: "planned", workType: workTypeOf((c.proposalVersion?.requirements as { projectType?: string } | null)?.projectType) },
    });
  }
  // An offer on the order (a discount on the website fee, free months on the plan) is applied here, once, so what they pay matches what they signed.
  const promo = promoFrom((c.proposalVersion?.requirements ?? {}) as Record<string, string | undefined>, c.oneOffMinor);
  const oneOff = Math.max(0, c.oneOffMinor - (promo?.discountMinor ?? 0));
  const depPct = Number((c.proposalVersion?.requirements as { depositPercent?: string } | null)?.depositPercent) || 0;
  const base = { workspaceId: c.workspaceId, customerId: c.customerId, contractId, currency: c.currency };
  if (oneOff > 0 && depPct > 0) {
    const dep = Math.round((oneOff * depPct) / 100);
    await tx.billingIntent.upsert({ where: { contractId_kind: { contractId, kind: "deposit" } }, create: { ...base, kind: "deposit", amountMinor: dep, description: `Website deposit (${depPct}%)`, ...(promo?.discountMinor ? { promoLabel: promo.label } : {}) }, update: {} });
    await tx.billingIntent.upsert({ where: { contractId_kind: { contractId, kind: "balance" } }, create: { ...base, kind: "balance", amountMinor: oneOff - dep, description: "Website final payment" }, update: {} });
  } else if (oneOff > 0) await tx.billingIntent.upsert({ where: { contractId_kind: { contractId, kind: "one_off" } }, create: { workspaceId: c.workspaceId, customerId: c.customerId, contractId, kind: "one_off", amountMinor: oneOff, currency: c.currency, ...(promo?.discountMinor ? { promoLabel: promo.label, description: `Website (${promo.label}: ${promo.percent > 0 ? `${promo.percent}%` : `£${(promo.discountMinor / 100).toFixed(2)}`} off)` } : {}) }, update: {} });
  if (c.recurringMinor > 0 && promo?.endsAfter) {
    // Free months that simply end: no card, no Stripe plan. It waits for the site to go live, then the free period starts counting and the team gets a reminder a week before it ends.
    const had = await tx.billingIntent.findUnique({ where: { contractId_kind: { contractId, kind: "recurring_setup" } }, select: { id: true } });
    if (!had) await tx.billingIntent.create({ data: { ...base, kind: "recurring_setup", amountMinor: c.recurringMinor, status: "pending", paidVia: "free", trialMonths: promo.freeMonths, promoLabel: promo.label, description: `Care plan (free for ${promo.freeMonths} month${promo.freeMonths === 1 ? "" : "s"}, then ends)` } });
  } else if (c.recurringMinor > 0) await tx.billingIntent.upsert({ where: { contractId_kind: { contractId, kind: "recurring_setup" } }, create: { workspaceId: c.workspaceId, customerId: c.customerId, contractId, kind: "recurring_setup", amountMinor: c.recurringMinor, currency: c.currency, trialMonths: promo?.freeMonths ?? 0, promoLabel: promo?.freeMonths ? promo.label : null }, update: {} });
  // The customer is told straight away that their deposit (or website fee) is ready, and where to pay it.
  const payNow = await tx.billingIntent.findFirst({ where: { contractId, kind: { in: ["deposit", "one_off"] }, status: "pending" } });
  if (payNow) {
    const signer = await tx.signingRequest.findFirst({ where: { contractId, status: "signed" }, orderBy: { createdAt: "desc" }, select: { signerName: true, signerEmail: true } });
    const primary = signer ? null : await tx.contact.findFirst({ where: { customerId: c.customerId, email: { not: null } }, orderBy: { isPrimary: "desc" }, select: { name: true, email: true } });
    const to = signer?.signerEmail ?? primary?.email;
    if (to) await enqueue(tx, c.workspaceId, "email.payment_ready", `pay.ready:${contractId}`, { to, name: signer?.signerName ?? primary?.name ?? "there", ref: c.reference, what: payNow.kind === "deposit" ? "deposit" : "website fee", amount: money(payNow.amountMinor, c.currency), link: portalLink("/billing") });
  }
  const oppId = c.proposalVersion?.proposal.opportunityId;
  if (oppId) await tx.opportunity.updateMany({ where: { id: oppId, stage: { not: "won" } }, data: { stage: "won", version: { increment: 1 } } });
  await tx.customer.updateMany({ where: { id: c.customerId, lifecycle: "prospect" }, data: { lifecycle: "active" } });
  await enqueue(tx, c.workspaceId, "notify.contract_completed", `contract.completed:${contractId}`, { contractId, projectId: project.id });
  return project;
}

/** Calls off a signed order: unpaid charges and any free care period are cancelled, the deal is marked lost and the project is cancelled. The signed copy and anything already paid stay on record (refunds are done in Stripe). */
export async function cancelOrder(ctx: StaffCtx, contractId: string, reason: string) {
  if (!can(ctx.role, "contract.void")) throw forbidden();
  const why = reason.trim();
  if (why.length < 3) throw new DomainError("validation", "Say why it is being cancelled, so there is a record.");
  return db.$transaction(async (tx) => {
    const c = await tx.contract.findFirst({ where: { id: contractId, workspaceId: ctx.workspaceId }, include: { proposalVersion: { include: { proposal: true } }, billingIntents: true, project: true } });
    if (!c) throw notFound();
    if (c.status !== "completed") throw new DomainError("conflict", "Only a signed order can be cancelled this way. An agreement that has not been signed can be withdrawn instead.");
    if (c.cancelledAt) throw new DomainError("conflict", "This order is already cancelled.");
    if (c.project && ["launched", "completed"].includes(c.project.stage)) throw new DomainError("conflict", "The website is already live, so this isn't a cancellation. Close the care plan instead.");
    if (c.billingIntents.some((b) => b.kind === "recurring_setup" && b.paidVia !== "free" && ["active", "past_due"].includes(b.status))) throw new DomainError("conflict", "A monthly plan is running. Cancel the monthly plan first, then cancel the order.");
    const open = c.billingIntents.filter((b) => b.status === "pending" || (b.paidVia === "free" && b.status === "active"));
    for (const b of open) await tx.billingIntent.update({ where: { id: b.id }, data: { status: "cancelled" } });
    const paid = c.billingIntents.filter((b) => b.status === "paid").reduce((n, b) => n + b.amountMinor, 0);
    await tx.contract.update({ where: { id: c.id }, data: { cancelledAt: new Date(), cancelReason: why, version: { increment: 1 } } });
    if (c.project && !["completed", "cancelled"].includes(c.project.stage)) await tx.project.update({ where: { id: c.project.id }, data: { stage: "cancelled", version: { increment: 1 } } });
    const oppId = c.proposalVersion?.proposal.opportunityId;
    if (oppId) await tx.opportunity.updateMany({ where: { id: oppId, workspaceId: ctx.workspaceId }, data: { stage: "lost", version: { increment: 1 } } });
    await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "contract.cancelled", targetType: "contract", targetId: c.id, customerId: c.customerId, detail: { reason: why, chargesCancelled: open.length, paidMinor: paid } });
    return { chargesCancelled: open.length, paidMinor: paid };
  });
}
