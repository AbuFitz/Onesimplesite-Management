import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db, type Tx } from "@/lib/db";
import { audit, enqueue, nextReference } from "@/lib/audit";
import { DomainError, forbidden, notFound, stale } from "@/lib/errors";
import { newToken, sha256 } from "@/lib/tokens";
import { portalLink } from "@/lib/env";
import { can } from "@/modules/identity/permissions";
import type { StaffCtx } from "@/modules/identity/session";

export const ACCEPTANCE_TERMS_VERSION = "2026-10-v1";
export const ACCEPTANCE_TEXT =
  "I confirm I am authorised to accept this proposal for the business named above, and I accept this exact version, scope and price. This records my acceptance of the proposal; it is not by itself a signed contract.";

const lineInput = z.object({
  description: z.string().trim().min(1).max(300),
  quantity: z.number().int().positive().max(10000),
  unitMinor: z.number().int().min(0).max(100_000_000_00),
  recurring: z.boolean().default(false),
});
/** Filled in by hand for every deal. Pricing and payment timing vary, so nothing here is automatic. */
export const REQUIREMENT_FIELDS = [
  ["pages", "Pages and structure"], ["features", "Features and functionality"], ["integrations", "Integrations (forms, booking, payments, analytics)"],
  ["domainHosting", "Domain and hosting"], ["contentBy", "Who supplies content, images and logo"], ["timeline", "Timeline and launch date"],
  ["payment", "Payment schedule for this order (amounts and dates)"], ["notes", "Other requirements or exclusions"],
] as const;
const requirementsInput = z.object(Object.fromEntries(REQUIREMENT_FIELDS.map(([k]) => [k, z.string().trim().max(5000).optional()]))).partial();
export type Requirements = z.infer<typeof requirementsInput>;

export const draftInput = z.object({
  requirements: requirementsInput.optional(),
  title: z.string().trim().min(1).max(200),
  scope: z.string().trim().min(1).max(20000),
  terms: z.string().trim().max(20000).default(""),
  validUntil: z.coerce.date().optional(),
  recurringPeriod: z.enum(["month", "year"]).optional(),
  lines: z.array(lineInput).min(1).max(50),
});

function totals(lines: z.infer<typeof lineInput>[]) {
  let oneOff = 0, recurring = 0;
  for (const l of lines) (l.recurring ? (recurring += l.quantity * l.unitMinor) : (oneOff += l.quantity * l.unitMinor));
  return { oneOffMinor: oneOff, recurringMinor: recurring };
}

export async function createProposal(ctx: StaffCtx, customerId: string, opportunityId: string | null, raw: unknown) {
  if (!can(ctx.role, "proposal.write")) throw forbidden();
  const i = draftInput.parse(raw);
  return db.$transaction(async (tx) => {
    const c = await tx.customer.findFirst({ where: { id: customerId, workspaceId: ctx.workspaceId } });
    if (!c) throw notFound("Customer not found.");
    const reference = await nextReference(tx, ctx.workspaceId, "proposal", "P");
    const p = await tx.proposal.create({
      data: { workspaceId: ctx.workspaceId, customerId, opportunityId, reference, title: i.title, createdById: ctx.staffId },
    });
    await writeVersion(tx, ctx.workspaceId, p.id, 1, i);
    await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "proposal.created", targetType: "proposal", targetId: p.id, customerId });
    return p;
  });
}

async function writeVersion(tx: Tx, workspaceId: string, proposalId: string, number: number, i: z.infer<typeof draftInput>) {
  const t = totals(i.lines);
  return tx.proposalVersion.create({
    data: {
      workspaceId, proposalId, number, scope: i.scope, terms: i.terms, validUntil: i.validUntil ?? null,
      recurringPeriod: i.recurringPeriod ?? null, requirements: i.requirements ?? undefined, ...t,
      lines: { create: i.lines.map((l, idx) => ({ position: idx + 1, ...l })) },
    },
  });
}

/** Edit the current draft; stale browser/device sessions are rejected, never last-write-wins. */
export async function saveDraft(ctx: StaffCtx, proposalId: string, expectedVersion: number, raw: unknown) {
  if (!can(ctx.role, "proposal.write")) throw forbidden();
  const i = draftInput.parse(raw);
  return db.$transaction(async (tx) => {
    const p = await tx.proposal.findFirst({ where: { id: proposalId, workspaceId: ctx.workspaceId } });
    if (!p) throw notFound();
    if (p.status !== "draft") throw new DomainError("conflict", "Sent proposals are immutable. Create a new version instead.");
    const bump = await tx.proposal.updateMany({ where: { id: p.id, version: expectedVersion }, data: { title: i.title, version: { increment: 1 } } });
    if (bump.count === 0) throw stale();
    const t = totals(i.lines);
    const v = await tx.proposalVersion.findFirstOrThrow({ where: { proposalId, number: p.currentVersion } });
    await tx.proposalLine.deleteMany({ where: { versionId: v.id } });
    await tx.proposalVersion.update({
      where: { id: v.id },
      data: { scope: i.scope, terms: i.terms, validUntil: i.validUntil ?? null, recurringPeriod: i.recurringPeriod ?? null, requirements: i.requirements ?? undefined, ...t, lines: { create: i.lines.map((l, idx) => ({ position: idx + 1, ...l })) } },
    });
  });
}

/** sendProposal: freezes the version, issues a hashed expiring token, queues the e-mail via outbox. */
export async function sendProposal(ctx: StaffCtx, proposalId: string, recipientEmail: string) {
  if (!can(ctx.role, "proposal.send")) throw forbidden();
  const email = z.email().parse(recipientEmail);
  return db.$transaction(async (tx) => {
    const p = await tx.proposal.findFirst({ where: { id: proposalId, workspaceId: ctx.workspaceId }, include: { customer: true } });
    if (!p) throw notFound();
    if (p.status !== "draft") throw new DomainError("conflict", "Only a draft can be sent.");
    const v = await tx.proposalVersion.findFirstOrThrow({ where: { proposalId, number: p.currentVersion } });
    const expires = v.validUntil ?? new Date(Date.now() + 30 * 864e5);
    if (expires <= new Date()) throw new DomainError("validation", "Valid-until date must be in the future.");
    await tx.proposalVersion.update({ where: { id: v.id }, data: { sentAt: new Date(), sentToEmail: email, validUntil: expires } });
    await tx.proposal.update({ where: { id: p.id }, data: { status: "sent", version: { increment: 1 } } });
    if (p.opportunityId) await tx.opportunity.updateMany({ where: { id: p.opportunityId, workspaceId: ctx.workspaceId, stage: { in: ["new", "qualified"] } }, data: { stage: "proposal_sent", version: { increment: 1 } } });
    const { token, hash } = newToken();
    await tx.scopedLinkToken.create({ data: { workspaceId: ctx.workspaceId, purpose: "proposal_accept", entityId: v.id, tokenHash: hash, recipientEmail: email, expiresAt: expires } });
    await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "proposal.sent", targetType: "proposal_version", targetId: v.id, customerId: p.customerId, detail: { to: email, version: v.number } });
    await enqueue(tx, ctx.workspaceId, "email.proposal", `proposal.sent:${v.id}`, {
      to: email, ref: p.reference, title: p.title, version: v.number, link: portalLink(`/p/${token}`),
      validUntil: new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Europe/London" }).format(expires),
      oneOff: new Intl.NumberFormat("en-GB", { style: "currency", currency: v.currency }).format(v.oneOffMinor / 100),
      recurring: v.recurringMinor > 0 ? `${new Intl.NumberFormat("en-GB", { style: "currency", currency: v.currency }).format(v.recurringMinor / 100)} per ${v.recurringPeriod ?? "period"}` : undefined,
    });
    return { versionId: v.id, token }; // token returned once to the caller only for dev display; never stored raw
  });
}

/** New version after sending: supersedes the old one and revokes its links; acceptance of the old version fails. */
export async function reviseProposal(ctx: StaffCtx, proposalId: string) {
  if (!can(ctx.role, "proposal.write")) throw forbidden();
  return db.$transaction(async (tx) => {
    const p = await tx.proposal.findFirst({ where: { id: proposalId, workspaceId: ctx.workspaceId } });
    if (!p) throw notFound();
    if (p.status !== "sent") throw new DomainError("conflict", "Only a sent, unaccepted proposal can be revised.");
    const old = await tx.proposalVersion.findFirstOrThrow({ where: { proposalId, number: p.currentVersion }, include: { lines: true } });
    await tx.proposalVersion.update({ where: { id: old.id }, data: { supersededAt: new Date() } });
    await tx.scopedLinkToken.updateMany({ where: { workspaceId: ctx.workspaceId, purpose: "proposal_accept", entityId: old.id, revokedAt: null }, data: { revokedAt: new Date() } });
    // An agreement already sent for this version is withdrawn: the customer's link stops working.
    const sentContract = await tx.contract.findFirst({ where: { proposalVersionId: old.id, status: "awaiting_signature" } });
    if (sentContract) {
      const reqs = await tx.signingRequest.findMany({ where: { contractId: sentContract.id, status: "pending" } });
      for (const r of reqs) {
        await tx.signingRequest.update({ where: { id: r.id }, data: { status: "voided" } });
        await tx.scopedLinkToken.updateMany({ where: { entityId: r.id, purpose: "contract_sign", revokedAt: null }, data: { revokedAt: new Date() } });
      }
      await tx.contract.update({ where: { id: sentContract.id }, data: { status: "voided", proposalVersionId: null, version: { increment: 1 } } });
    }
    await tx.proposalVersion.create({
      data: {
        workspaceId: ctx.workspaceId, proposalId, number: old.number + 1, scope: old.scope, terms: old.terms, currency: old.currency,
        oneOffMinor: old.oneOffMinor, recurringMinor: old.recurringMinor, recurringPeriod: old.recurringPeriod, requirements: old.requirements ?? undefined,
        lines: { create: old.lines.map((l) => ({ position: l.position, description: l.description, quantity: l.quantity, unitMinor: l.unitMinor, recurring: l.recurring })) },
      },
    });
    await tx.proposal.update({ where: { id: proposalId }, data: { status: "draft", currentVersion: old.number + 1, version: { increment: 1 } } });
    await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "proposal.revised", targetType: "proposal", targetId: proposalId, customerId: p.customerId, detail: { superseded: old.number } });
  });
}

// ───────── Public, token-scoped ─────────
type TokenState = { ok: true; tokenId: string; versionId: string } | { ok: false; reason: "invalid" | "expired" | "revoked" | "superseded" | "not_open" };

async function resolveToken(tx: Tx | typeof db, token: string): Promise<TokenState> {
  const t = await tx.scopedLinkToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!t || t.purpose !== "proposal_accept") return { ok: false, reason: "invalid" };
  if (t.revokedAt) return { ok: false, reason: "revoked" };
  if (t.expiresAt <= new Date()) return { ok: false, reason: "expired" };
  const v = await tx.proposalVersion.findUnique({ where: { id: t.entityId }, include: { proposal: true } });
  if (!v) return { ok: false, reason: "invalid" };
  if (v.supersededAt) return { ok: false, reason: "superseded" };
  if (v.proposal.status !== "sent" || v.proposal.currentVersion !== v.number) return { ok: false, reason: "not_open" };
  return { ok: true, tokenId: t.id, versionId: v.id };
}

/** Public view: only the fields a signer needs; no internal ids beyond the page itself. */
export async function viewProposalByToken(token: string) {
  const s = await resolveToken(db, token);
  if (!s.ok) return s;
  const v = await db.proposalVersion.findUniqueOrThrow({
    where: { id: s.versionId },
    include: { lines: { orderBy: { position: "asc" } }, proposal: { include: { customer: { select: { displayName: true } } } } },
  });
  return { ok: true as const, version: v };
}

export const acceptInput = z.object({ name: z.string().trim().min(1).max(200), consent: z.literal(true) });

/**
 * acceptProposal: idempotent and race-safe. Unique(ProposalAcceptance.versionId)
 * and unique(Contract.proposalVersionId) make duplicate/concurrent calls converge on one result.
 * The IP is stored only if the caller passes a value derived from a trusted proxy header.
 */
export async function acceptProposal(token: string, raw: unknown, evidence: { ip?: string | null; userAgent?: string | null }) {
  const i = acceptInput.parse(raw);
  try {
    return await db.$transaction(async (tx) => {
      const s = await resolveToken(tx, token);
      if (!s.ok) throw new DomainError("expired_link", `This link is no longer valid (${s.reason}).`);
      const tokenRow = await tx.scopedLinkToken.findUniqueOrThrow({ where: { id: s.tokenId } });
      const v = await tx.proposalVersion.findUniqueOrThrow({ where: { id: s.versionId }, include: { proposal: true } });
      const acc = await tx.proposalAcceptance.create({
        data: { workspaceId: v.workspaceId, versionId: v.id, acceptedName: i.name, acceptedEmail: tokenRow.recipientEmail, termsText: ACCEPTANCE_TEXT, termsVersion: ACCEPTANCE_TERMS_VERSION, ipAddress: evidence.ip ?? null, userAgent: evidence.userAgent?.slice(0, 300) ?? null },
      });
      await tx.scopedLinkToken.update({ where: { id: tokenRow.id }, data: { usedAt: new Date() } });
      await tx.proposal.update({ where: { id: v.proposalId }, data: { status: "accepted", acceptedVersionId: v.id, version: { increment: 1 } } });
      if (v.proposal.opportunityId) await tx.opportunity.updateMany({ where: { id: v.proposal.opportunityId, stage: { in: ["new", "qualified", "proposal_sent"] } }, data: { stage: "contract_pending", version: { increment: 1 } } });
      const contract = await generateContractFromVersion(tx, v.id);
      await audit(tx, { workspaceId: v.workspaceId, actor: null, action: "proposal.accepted", targetType: "proposal_version", targetId: v.id, customerId: v.proposal.customerId, detail: { by: i.name, email: tokenRow.recipientEmail } });
      await enqueue(tx, v.workspaceId, "notify.proposal_accepted", `proposal.accepted:${v.id}`, { proposalId: v.proposalId, contractId: contract.id });
      return { acceptanceId: acc.id, contractId: contract.id, duplicate: false };
    });
  } catch (e) {
    // Concurrent/duplicate acceptance: the unique constraint rolled our tx back; the winner already committed.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const t = await db.scopedLinkToken.findUnique({ where: { tokenHash: sha256(token) } });
      if (t) {
        const acc = await db.proposalAcceptance.findUnique({ where: { versionId: t.entityId } });
        const c = await db.contract.findUnique({ where: { proposalVersionId: t.entityId } });
        if (acc && c) return { acceptanceId: acc.id, contractId: c.id, duplicate: true };
      }
    }
    throw e;
  }
}

/** Conversion is keyed by proposalVersionId (unique): never more than one contract per accepted version. */
async function generateContractFromVersion(tx: Tx, versionId: string) {
  const v = await tx.proposalVersion.findUniqueOrThrow({ where: { id: versionId }, include: { proposal: true } });
  const existing = await tx.contract.findUnique({ where: { proposalVersionId: versionId } });
  if (existing) return existing;
  const reference = await nextReference(tx, v.workspaceId, "contract", "K");
  return tx.contract.create({
    data: {
      workspaceId: v.workspaceId, customerId: v.proposal.customerId, reference, title: v.proposal.title,
      proposalVersionId: v.id, scopeSnapshot: `${v.scope}\n\n${v.terms}`.trim(), oneOffMinor: v.oneOffMinor,
      recurringMinor: v.recurringMinor, currency: v.currency,
    },
  });
}
