import { z } from "zod";
import { db } from "@/lib/db";
import { audit, nextReference } from "@/lib/audit";
import { DomainError, forbidden, stale } from "@/lib/errors";
import { can } from "@/modules/identity/permissions";
import type { StaffCtx } from "@/modules/identity/session";

export const createLeadInput = z.object({
  displayName: z.string().trim().min(1).max(200),
  contactName: z.string().trim().min(1).max(200),
  email: z.email().optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional(),
  source: z.string().trim().max(100).optional(),
  opportunityTitle: z.string().trim().max(200).optional(),
  note: z.string().trim().max(5000).optional(),
});

/** createLead: customer + primary contact + opportunity once, in one transaction. */
export async function createLead(ctx: StaffCtx, raw: unknown) {
  if (!can(ctx.role, "customer.write")) throw forbidden();
  const i = createLeadInput.parse(raw);
  return db.$transaction(async (tx) => {
    const reference = await nextReference(tx, ctx.workspaceId, "customer", "C");
    const customer = await tx.customer.create({
      data: { workspaceId: ctx.workspaceId, reference, displayName: i.displayName, source: i.source || null, ownerId: ctx.staffId, phone: i.phone || null },
    });
    await tx.contact.create({
      data: { workspaceId: ctx.workspaceId, customerId: customer.id, name: i.contactName, email: i.email || null, phone: i.phone || null, isPrimary: true },
    });
    const opp = await tx.opportunity.create({
      data: { workspaceId: ctx.workspaceId, customerId: customer.id, title: i.opportunityTitle || `Website for ${i.displayName}`, ownerId: ctx.staffId },
    });
    if (i.note) {
      await tx.note.create({
        data: { workspaceId: ctx.workspaceId, title: "First note", body: i.note, ownerId: ctx.staffId, customerId: customer.id, visibility: "team" },
      });
    }
    await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "lead.created", targetType: "customer", targetId: customer.id, customerId: customer.id });
    return { customerId: customer.id, opportunityId: opp.id, reference };
  });
}

/** Scoped read: every customer read filters on the caller's workspace. */
export async function getCustomer(ctx: StaffCtx, id: string) {
  if (!can(ctx.role, "customer.read")) throw forbidden();
  return db.customer.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: { contacts: true, opportunities: { orderBy: { createdAt: "desc" } }, proposals: { orderBy: { createdAt: "desc" } }, contracts: true, projects: true },
  });
}

export async function listCustomers(ctx: StaffCtx, q: { search?: string; page?: number; mine?: boolean }) {
  if (!can(ctx.role, "customer.read")) throw forbidden();
  const take = 25;
  const where = {
    workspaceId: ctx.workspaceId,
    archivedAt: null,
    ...(q.mine ? { ownerId: ctx.staffId } : {}),
    ...(q.search ? { OR: [{ displayName: { contains: q.search, mode: "insensitive" as const } }, { reference: { contains: q.search, mode: "insensitive" as const } }, { contacts: { some: { email: { contains: q.search, mode: "insensitive" as const } } } }] } : {}),
  };
  const [rows, total] = await Promise.all([
    db.customer.findMany({ where, orderBy: { createdAt: "desc" }, take, skip: ((q.page ?? 1) - 1) * take, include: { contacts: { where: { isPrimary: true }, take: 1 } } }),
    db.customer.count({ where }),
  ]);
  return { rows, total, pages: Math.max(1, Math.ceil(total / take)) };
}

export async function setOpportunityStage(ctx: StaffCtx, id: string, stage: "new" | "qualified" | "proposal_sent" | "contract_pending" | "won" | "lost", expectedVersion: number, lossReason?: string) {
  if (!can(ctx.role, "opportunity.write")) throw forbidden();
  return db.$transaction(async (tx) => {
    const r = await tx.opportunity.updateMany({
      where: { id, workspaceId: ctx.workspaceId, version: expectedVersion },
      data: { stage, lossReason: stage === "lost" ? (lossReason?.trim() || null) : null, version: { increment: 1 } },
    });
    if (r.count === 0) throw stale();
    await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "opportunity.stage", targetType: "opportunity", targetId: id, detail: { stage } });
  });
}

// ───────── Customer details: filled in by the team, required before an agreement can be sent ─────────
const detailsInput = z.object({
  kind: z.enum(["business", "individual"]).default("business"),
  legalName: z.string().trim().max(200).optional(),
  companyNumber: z.string().trim().max(40).optional(),
  vatNumber: z.string().trim().max(40).optional(),
  billingAddress: z.string().trim().max(500).optional(),
  website: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(40).optional(),
});

export async function updateCustomerDetails(ctx: StaffCtx, id: string, expectedVersion: number, raw: unknown) {
  if (!can(ctx.role, "customer.write")) throw forbidden();
  const i = detailsInput.parse(raw);
  await db.$transaction(async (tx) => {
    const r = await tx.customer.updateMany({
      where: { id, workspaceId: ctx.workspaceId, version: expectedVersion },
      data: { kind: i.kind, legalName: i.legalName || null, companyNumber: i.companyNumber || null, vatNumber: i.vatNumber || null, billingAddress: i.billingAddress || null, website: i.website || null, phone: i.phone || null, version: { increment: 1 } },
    });
    if (r.count === 0) throw stale();
    await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "customer.details_updated", targetType: "customer", targetId: id, customerId: id });
  });
}

/** What an agreement still needs from us about this customer. Sole traders use their own name; no company number needed. */
export function customerDetailsMissing(c: { legalName: string | null; billingAddress: string | null; kind: string }) {
  return [!c.legalName && (c.kind === "individual" ? "full name" : "legal company name"), !c.billingAddress && "address"].filter(Boolean) as string[];
}
