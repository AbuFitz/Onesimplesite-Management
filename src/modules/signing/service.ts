import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db, type Tx } from "@/lib/db";
import { audit, enqueue } from "@/lib/audit";
import { DomainError, forbidden, notFound } from "@/lib/errors";
import { newToken, sha256, sha256Bytes } from "@/lib/tokens";
import { portalLink, manageLink } from "@/lib/env";
import { can } from "@/modules/identity/permissions";
import { runCompletionWorkflow } from "@/modules/contracts/service";
import type { StaffCtx } from "@/modules/identity/session";
import { buildSignedPdf } from "./pdf";

export const CONSENT_VERSION = "2026-10-v1";
export const CONSENT_TEXT =
  "I have read this agreement. I intend to sign it electronically by submitting this form, and I agree that my typed or drawn signature is my signature on it.";
const EXPIRY_DAYS = 14;

const money = (m: number, c: string) => new Intl.NumberFormat("en-GB", { style: "currency", currency: c }).format(m / 100);
const london = (d: Date) => new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/London" }).format(d);
const day = (d: Date) => new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Europe/London" }).format(d);

/** Canonical JSON (sorted keys) so evidence hashes can be re-computed from the stored record. */
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(v ?? null);
}

function composeText(c: { title: string; reference: string; scopeSnapshot: string; oneOffMinor: number; recurringMinor: number; currency: string }, customer: string) {
  return [
    `Agreement between OneSimpleSite and ${customer}`,
    "",
    "Scope and terms",
    c.scopeSnapshot,
    "",
    "Price",
    `One-off: ${money(c.oneOffMinor, c.currency)}`,
    ...(c.recurringMinor > 0 ? [`Recurring: ${money(c.recurringMinor, c.currency)}`] : []),
    "Amounts exclude VAT unless the terms above say otherwise.",
  ].join("\n");
}

const sendInput = z.object({ name: z.string().trim().min(1).max(200), email: z.email() });

/** Freezes the text, issues a hashed single-contract token, queues the signing email. Reissue voids the previous request. */
export async function sendForSigning(ctx: StaffCtx, contractId: string, raw: unknown) {
  if (!can(ctx.role, "contract.send")) throw forbidden();
  const i = sendInput.parse(raw);
  return db.$transaction(async (tx) => {
    const c = await tx.contract.findFirst({ where: { id: contractId, workspaceId: ctx.workspaceId }, include: { customer: true } });
    if (!c) throw notFound();
    if (!["draft", "awaiting_signature"].includes(c.status)) throw new DomainError("conflict", `A ${c.status} contract cannot be sent for signing.`);
    const prev = await tx.signingRequest.findMany({ where: { contractId, status: "pending" } });
    for (const p of prev) {
      await tx.signingRequest.update({ where: { id: p.id }, data: { status: "voided" } });
      await tx.scopedLinkToken.updateMany({ where: { workspaceId: ctx.workspaceId, purpose: "contract_sign", entityId: p.id, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    const contentText = composeText(c, c.customer.displayName);
    const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 864e5);
    const req = await tx.signingRequest.create({ data: { workspaceId: ctx.workspaceId, contractId, signerName: i.name, signerEmail: i.email, contentText, contentSha256: sha256(contentText), expiresAt, sentById: ctx.staffId } });
    const { token, hash } = newToken();
    await tx.scopedLinkToken.create({ data: { workspaceId: ctx.workspaceId, purpose: "contract_sign", entityId: req.id, tokenHash: hash, recipientEmail: i.email, expiresAt } });
    await tx.contract.update({ where: { id: contractId }, data: { status: "awaiting_signature", signingMode: "original_capture", version: { increment: 1 } } });
    await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: prev.length ? "contract.reissued" : "contract.sent_for_signature", targetType: "contract", targetId: contractId, customerId: c.customerId, detail: { to: i.email } });
    await enqueue(tx, ctx.workspaceId, "email.contract_request", `contract.request:${req.id}`, {
      to: i.email, signerName: i.name, title: c.title, ref: c.reference, business: c.customer.displayName, link: portalLink(`/s/${token}`), expires: day(expiresAt),
    });
    return { requestId: req.id, token };
  });
}

export async function voidSigning(ctx: StaffCtx, contractId: string) {
  if (!can(ctx.role, "contract.void")) throw forbidden();
  await db.$transaction(async (tx) => {
    const c = await tx.contract.findFirst({ where: { id: contractId, workspaceId: ctx.workspaceId } });
    if (!c) throw notFound();
    if (c.status !== "awaiting_signature") throw new DomainError("conflict", "Only a contract awaiting signature can be voided.");
    const reqs = await tx.signingRequest.findMany({ where: { contractId, status: "pending" } });
    for (const r of reqs) {
      await tx.signingRequest.update({ where: { id: r.id }, data: { status: "voided" } });
      await tx.scopedLinkToken.updateMany({ where: { entityId: r.id, purpose: "contract_sign", revokedAt: null }, data: { revokedAt: new Date() } });
    }
    await tx.contract.update({ where: { id: contractId }, data: { status: "voided", version: { increment: 1 } } });
    await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "contract.voided", targetType: "contract", targetId: contractId, customerId: c.customerId });
  });
}

type Resolved = { ok: true; tokenId: string; requestId: string } | { ok: false; reason: "invalid" | "expired" | "revoked" | "signed" | "not_open" };
async function resolve(tx: Tx | typeof db, token: string): Promise<Resolved> {
  const t = await tx.scopedLinkToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!t || t.purpose !== "contract_sign") return { ok: false, reason: "invalid" };
  const r = await tx.signingRequest.findUnique({ where: { id: t.entityId } });
  if (!r) return { ok: false, reason: "invalid" };
  if (r.status === "signed") return { ok: false, reason: "signed" };
  if (t.revokedAt || r.status === "voided") return { ok: false, reason: "revoked" };
  if (r.status !== "pending") return { ok: false, reason: "not_open" };
  if (t.expiresAt <= new Date() || r.expiresAt <= new Date()) return { ok: false, reason: "expired" };
  return { ok: true, tokenId: t.id, requestId: r.id };
}

/** Only what the signer needs; no internal ids, notes or staff data. */
export async function viewSigning(token: string) {
  const s = await resolve(db, token);
  if (!s.ok) return s;
  const r = await db.signingRequest.findUniqueOrThrow({ where: { id: s.requestId }, include: { contract: { select: { title: true, reference: true, customer: { select: { displayName: true } } } } } });
  return { ok: true as const, signerName: r.signerName, signerEmail: r.signerEmail, contentText: r.contentText, title: r.contract.title, reference: r.contract.reference, business: r.contract.customer.displayName, expiresAt: r.expiresAt };
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
export const signInput = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(200),
  method: z.enum(["typed", "drawn"]),
  image: z.string().max(400_000).optional(),
  consent: z.literal(true, { error: "Please confirm you have read and agree to sign." }),
});

/**
 * Submit a signature. One signature per request (unique), one completion per contract.
 * Duplicate/concurrent submits converge on the same stored result. Server time only.
 */
export async function submitSignature(token: string, raw: unknown, ev: { ip?: string | null; userAgent?: string | null }) {
  const i = signInput.parse(raw);
  let image: Buffer | undefined;
  if (i.method === "drawn") {
    const m = i.image?.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
    image = m ? Buffer.from(m[1], "base64") : undefined;
    if (!image || image.length < 200 || image.length > 250_000 || !image.subarray(0, 4).equals(PNG_MAGIC)) throw new DomainError("validation", "Please draw your signature, or choose to type it.");
  }
  try {
    return await db.$transaction(async (tx) => {
      const s = await resolve(tx, token);
      if (!s.ok) throw new DomainError("expired_link", s.reason === "signed" ? "This agreement has already been signed." : `This link is no longer valid (${s.reason}).`);
      const req = await tx.signingRequest.findUniqueOrThrow({ where: { id: s.requestId }, include: { contract: { include: { customer: true } } } });
      const claimed = await tx.signingRequest.updateMany({ where: { id: req.id, status: "pending" }, data: { status: "signed" } });
      if (claimed.count === 0) throw new DomainError("conflict", "This agreement has already been signed.");
      const signedAt = new Date();
      const evidence = {
        contractReference: req.contract.reference, signingRequestId: req.id, contentSha256: req.contentSha256,
        signerName: i.name, signerEmail: req.signerEmail, method: i.method, consentText: CONSENT_TEXT, consentVersion: CONSENT_VERSION,
        signedAtUtc: signedAt.toISOString(), ipAddress: ev.ip ?? null, userAgent: ev.userAgent?.slice(0, 300) ?? null, tokenId: s.tokenId,
        note: "Electronic signature capture; identity is not verified beyond control of the emailed link.",
      };
      const pdf = await buildSignedPdf({
        title: req.contract.title, reference: req.contract.reference, contentText: req.contentText, contentSha256: req.contentSha256,
        signerName: i.name, signerEmail: req.signerEmail, method: i.method, signatureImage: image,
        signedAtLondon: london(signedAt), signedAtUtc: signedAt.toISOString(), consentText: CONSENT_TEXT, consentVersion: CONSENT_VERSION,
      });
      const fileSha = sha256Bytes(pdf);
      const rec = await tx.signatureRecord.create({
        data: { workspaceId: req.workspaceId, signingRequestId: req.id, signerName: i.name, method: i.method, signatureImage: image ? new Uint8Array(image) : undefined, consentText: CONSENT_TEXT, consentVersion: CONSENT_VERSION, ipAddress: ev.ip ?? null, userAgent: ev.userAgent?.slice(0, 300) ?? null, signedAt, evidence, evidenceSha256: sha256(canonical(evidence)) },
      });
      await tx.contractDocument.create({ data: { workspaceId: req.workspaceId, contractId: req.contractId, kind: "final_pdf", bytes: new Uint8Array(pdf), sha256: fileSha } });
      await tx.scopedLinkToken.update({ where: { id: s.tokenId }, data: { usedAt: signedAt } });
      const done = await tx.contract.updateMany({ where: { id: req.contractId, status: "awaiting_signature" }, data: { status: "completed", completedAt: signedAt, completionRecordedBy: `${i.name} (electronic signature capture)`, completionEvidence: `Signature record ${rec.id}; final PDF SHA-256 ${fileSha}`, version: { increment: 1 } } });
      if (done.count === 0) throw new DomainError("conflict", "This contract is no longer awaiting signature.");
      const project = await runCompletionWorkflow(tx, req.contractId);
      await audit(tx, { workspaceId: req.workspaceId, actor: null, action: "contract.signed", targetType: "contract", targetId: req.contractId, customerId: req.contract.customerId, detail: { signer: i.name, method: i.method, pdfSha256: fileSha } });
      const base = { title: req.contract.title, ref: req.contract.reference, signedAt: london(signedAt), fileSha };
      await enqueue(tx, req.workspaceId, "email.signing_confirmation", `signing.confirmation:${req.id}`, { to: req.signerEmail, signerName: i.name, ...base, contractId: req.contractId });
      await enqueue(tx, req.workspaceId, "email.signing_notice", `signing.notice:${req.id}`, { to: "internal", contractId: req.contractId, business: req.contract.customer.displayName, signerName: i.name, signerEmail: req.signerEmail, link: manageLink(`/contracts/${req.contractId}`), ...base });
      return { signatureId: rec.id, contractId: req.contractId, projectId: project.id, duplicate: false };
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const t = await db.scopedLinkToken.findUnique({ where: { tokenHash: sha256(token) } });
      const rec = t && (await db.signatureRecord.findUnique({ where: { signingRequestId: t.entityId } }));
      if (rec) return { signatureId: rec.id, contractId: "", projectId: "", duplicate: true };
    }
    throw e;
  }
}

export async function declineSigning(token: string, reason: string) {
  await db.$transaction(async (tx) => {
    const s = await resolve(tx, token);
    if (!s.ok) throw new DomainError("expired_link", "This link is no longer valid.");
    const r = await tx.signingRequest.update({ where: { id: s.requestId }, data: { status: "declined", declineReason: reason.slice(0, 1000) }, include: { contract: true } });
    await tx.scopedLinkToken.update({ where: { id: s.tokenId }, data: { revokedAt: new Date() } });
    await tx.contract.update({ where: { id: r.contractId }, data: { status: "declined", version: { increment: 1 } } });
    await audit(tx, { workspaceId: r.workspaceId, actor: null, action: "contract.declined", targetType: "contract", targetId: r.contractId, customerId: r.contract.customerId, detail: { reason: reason.slice(0, 200) } });
  });
}
