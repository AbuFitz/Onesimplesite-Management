import { z } from "zod";
import { checkAddress, printedAddress, hasAddress, normalisePostcode, parseAddress } from "@/lib/address";
import { db } from "@/lib/db";
import { audit, nextRef } from "@/lib/audit";
import { DomainError, forbidden, notFound, stale } from "@/lib/errors";
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
    const reference = await nextRef(tx, ctx.workspaceId, "customer");
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
    include: { contacts: true, opportunities: { orderBy: { createdAt: "desc" } }, proposals: { orderBy: { createdAt: "desc" } }, contracts: { include: { proposalVersion: { select: { proposalId: true } } } }, projects: true },
  });
}

/** What each company status means, in the team's words. */
export const LIFECYCLE = {
  prospect: { label: "Prospect", help: "Someone we're talking to. Not a customer yet.", kind: "warn" },
  active: { label: "Active", help: "A current customer.", kind: "good" },
  paused: { label: "On hold", help: "Customer, but work or billing is paused for now.", kind: "neutral" },
  former: { label: "Former", help: "Used to be a customer. Kept for the record.", kind: "neutral" },
} as const;
export type LifecycleKey = keyof typeof LIFECYCLE;
export const LIFECYCLE_KEYS = Object.keys(LIFECYCLE) as LifecycleKey[];

export type CompanyFilter = { search?: string; page?: number; mine?: boolean; status?: string; atRisk?: boolean; sort?: string };

const companyWhere = (ctx: StaffCtx, q: CompanyFilter, ignoreStatus = false) => ({
  workspaceId: ctx.workspaceId,
  ...(q.status === "archived" ? { archivedAt: { not: null } } : { archivedAt: null }),
  ...(!ignoreStatus && q.status && (LIFECYCLE_KEYS as string[]).includes(q.status) ? { lifecycle: q.status as LifecycleKey } : {}),
  ...(q.atRisk ? { atRisk: true } : {}),
  ...(q.mine ? { ownerId: ctx.staffId } : {}),
  ...(q.search ? { OR: [{ displayName: { contains: q.search, mode: "insensitive" as const } }, { reference: { contains: q.search, mode: "insensitive" as const } }, { contacts: { some: { OR: [{ email: { contains: q.search, mode: "insensitive" as const } }, { name: { contains: q.search, mode: "insensitive" as const } }] } } }] } : {}),
});

export async function listCustomers(ctx: StaffCtx, q: CompanyFilter) {
  if (!can(ctx.role, "customer.read")) throw forbidden();
  const take = 25, where = companyWhere(ctx, q);
  const orderBy = q.sort === "name" ? { displayName: "asc" as const } : q.sort === "recent" ? { updatedAt: "desc" as const } : { createdAt: "desc" as const };
  const [rows, total] = await Promise.all([
    db.customer.findMany({ where, orderBy, take, skip: ((q.page ?? 1) - 1) * take, include: { contacts: { where: { isPrimary: true }, take: 1 } } }),
    db.customer.count({ where }),
  ]);
  return { rows, total, pages: Math.max(1, Math.ceil(total / take)) };
}

/** How many companies are in each status, for the filter chips and the team's overview. Respects search and "mine", not the status chosen. */
export async function customerStatusCounts(ctx: StaffCtx, q: CompanyFilter = {}) {
  if (!can(ctx.role, "customer.read")) throw forbidden();
  const base = { ...q, status: undefined };
  const [live, archived, atRisk, ...by] = await Promise.all([
    db.customer.count({ where: companyWhere(ctx, base) }),
    db.customer.count({ where: companyWhere(ctx, { ...base, status: "archived" }) }),
    db.customer.count({ where: companyWhere(ctx, { ...base, atRisk: true }) }),
    ...LIFECYCLE_KEYS.map((k) => db.customer.count({ where: companyWhere(ctx, { ...base, status: k }) })),
  ]);
  return { all: live, archived, atRisk, ...Object.fromEntries(LIFECYCLE_KEYS.map((k, i) => [k, by[i]])) } as { all: number; archived: number; atRisk: number } & Record<LifecycleKey, number>;
}

/** Changes a company's status and the "at risk" flag. Recorded, so the team can see when and who. */
export async function setCustomerStatus(ctx: StaffCtx, id: string, lifecycle: string, atRisk: boolean) {
  if (!can(ctx.role, "customer.write")) throw forbidden();
  if (!(LIFECYCLE_KEYS as string[]).includes(lifecycle)) throw new DomainError("validation", "Pick a status.");
  await db.$transaction(async (tx) => {
    const c = await tx.customer.findFirst({ where: { id, workspaceId: ctx.workspaceId }, select: { lifecycle: true, atRisk: true } });
    if (!c) throw notFound("Company not found.");
    await tx.customer.update({ where: { id }, data: { lifecycle: lifecycle as LifecycleKey, atRisk, version: { increment: 1 } } });
    await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "customer.status_changed", targetType: "customer", targetId: id, customerId: id, detail: { from: c.lifecycle, to: lifecycle, atRisk } });
  });
}

/** Archiving hides a company from the everyday lists and pickers but keeps everything, and it still counts in the team's overview. It can be restored any time. */
export async function setCustomerArchived(ctx: StaffCtx, id: string, archived: boolean) {
  if (!can(ctx.role, "customer.archive")) throw forbidden();
  await db.$transaction(async (tx) => {
    const r = await tx.customer.updateMany({ where: { id, workspaceId: ctx.workspaceId, archivedAt: archived ? null : { not: null } }, data: { archivedAt: archived ? new Date() : null, version: { increment: 1 } } });
    if (r.count === 0) throw new DomainError("conflict", archived ? "This company is already archived." : "This company isn't archived.");
    await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: archived ? "customer.archived" : "customer.restored", targetType: "customer", targetId: id, customerId: id });
  });
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
  displayName: z.string().trim().min(1, "Enter the company name.").max(120).optional(),
  kind: z.enum(["business", "sole_trader", "individual"]).default("business"),
  legalName: z.string().trim().max(200).optional(),
  companyNumber: z.string().trim().max(40).optional(),
  vatNumber: z.string().trim().max(40).optional(),
  billingAddress: z.string().trim().max(500).optional(), // older callers: one box; split into parts below
  addressLine1: z.string().trim().max(120).optional(), addressLine2: z.string().trim().max(120).optional(), town: z.string().trim().max(80).optional(), postcode: z.string().trim().max(10).optional(),
  website: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(40).optional(),
});

export async function updateCustomerDetails(ctx: StaffCtx, id: string, expectedVersion: number, raw: unknown) {
  if (!can(ctx.role, "customer.write")) throw forbidden();
  const parsed = detailsInput.parse(raw);
  const legacy = !hasAddress(parsed) && !!parsed.billingAddress; // one-box address from older callers: keep it as typed
  const i = legacy ? { ...parsed, ...parseAddress(parsed.billingAddress, parsed.town) } : parsed;
  const bad = legacy ? null : checkAddress(i); if (bad) throw new DomainError("validation", bad);
  const postcode = i.postcode ? normalisePostcode(i.postcode) : null;
  const billingAddress = legacy ? parsed.billingAddress! : printedAddress({ ...i, postcode }) || null;
  await db.$transaction(async (tx) => {
    const r = await tx.customer.updateMany({
      where: { id, workspaceId: ctx.workspaceId, version: expectedVersion },
      data: { ...(i.displayName ? { displayName: i.displayName } : {}), kind: i.kind, legalName: i.legalName || null, companyNumber: i.companyNumber || null, vatNumber: i.vatNumber || null, billingAddress, addressLine1: i.addressLine1 || null, addressLine2: i.addressLine2 || null, town: i.town || null, postcode, website: i.website || null, phone: i.phone || null, version: { increment: 1 } },
    });
    if (r.count === 0) throw stale();
    await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "customer.details_updated", targetType: "customer", targetId: id, customerId: id });
  });
}

/** What an agreement still needs from us about this customer. Sole traders use their own name; no company number needed. */
export function customerDetailsMissing(c: { legalName: string | null; billingAddress: string | null; kind: string }) {
  return [!c.legalName && (c.kind === "individual" ? "full name" : "legal company name"), !c.billingAddress && "address"].filter(Boolean) as string[];
}
