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
  if (c.recurringMinor > 0) await tx.billingIntent.upsert({ where: { contractId_kind: { contractId, kind: "recurring_setup" } }, create: { workspaceId: c.workspaceId, customerId: c.customerId, contractId, kind: "recurring_setup", amountMinor: c.recurringMinor, currency: c.currency, trialMonths: promo?.freeMonths ?? 0, promoLabel: promo?.freeMonths ? promo.label : null }, update: {} });
  const oppId = c.proposalVersion?.proposal.opportunityId;
  if (oppId) await tx.opportunity.updateMany({ where: { id: oppId, stage: { not: "won" } }, data: { stage: "won", version: { increment: 1 } } });
  await tx.customer.updateMany({ where: { id: c.customerId, lifecycle: "prospect" }, data: { lifecycle: "active" } });
  await enqueue(tx, c.workspaceId, "notify.contract_completed", `contract.completed:${contractId}`, { contractId, projectId: project.id });
  return project;
}
