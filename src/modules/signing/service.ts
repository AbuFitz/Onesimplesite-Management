import { promoFrom, monthsWords, discountWords } from "@/modules/billing/promo";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db, type Tx } from "@/lib/db";
import { audit, enqueue, nextRef } from "@/lib/audit";
import { DomainError, forbidden, notFound } from "@/lib/errors";
import { newToken, sha256, sha256Bytes } from "@/lib/tokens";
import { portalLink, manageLink } from "@/lib/env";
import { can } from "@/modules/identity/permissions";
import { runCompletionWorkflow } from "@/modules/contracts/service";
import type { StaffCtx } from "@/modules/identity/session";
import { buildSignedPdf } from "./pdf";
import { currentTerms, getCompany, companyMissing } from "@/modules/settings/service";
import { fillVars, emptyVars, labelFor } from "@/modules/settings/variables";
import { documentValues } from "@/modules/settings/plans";
import { customerDetailsMissing } from "@/modules/crm/service";
import { REQUIREMENT_FIELDS } from "@/modules/sales/service";
import { renumberTerms, normalizeNewlines } from "@/documents/parse";

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
  return { ok: true as const, signerName: r.signerName, signerEmail: r.signerEmail, contentText: r.contentText, title: r.contract.title, reference: r.contract.reference, business: r.contract.customer.displayName, expiresAt: r.expiresAt, sentAt: r.createdAt };
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
export const signInput = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(200),
  position: z.string().trim().max(120).optional().transform((v) => v || undefined),
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
        signerName: i.name, signerPosition: i.position ?? null, signerEmail: req.signerEmail, method: i.method, consentText: CONSENT_TEXT, consentVersion: CONSENT_VERSION,
        signedAtUtc: signedAt.toISOString(), ipAddress: ev.ip ?? null, userAgent: ev.userAgent?.slice(0, 300) ?? null, tokenId: s.tokenId,
        note: "Electronic signature capture; identity is not verified beyond control of the emailed link.",
      };
      const termsRow = req.termsVersionId ? await tx.termsVersion.findUnique({ where: { id: req.termsVersionId } }) : null;
      const pdf = await buildSignedPdf({
        draftWording: !!termsRow && termsRow.status !== "published" && termsRow.status !== "retired",
        title: req.contract.title, reference: req.contract.reference, contentText: req.contentText, contentSha256: req.contentSha256,
        signerName: i.name, signerPosition: i.position, signerEmail: req.signerEmail, method: i.method, signatureImage: image,
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
      // Signing the agreement is also the customer's acceptance of the proposal version it contains.
      if (req.contract.proposalVersionId) {
        const pv = await tx.proposalVersion.findUnique({ where: { id: req.contract.proposalVersionId }, include: { proposal: true } });
        if (pv && pv.proposal.status === "sent") {
          await tx.proposalAcceptance.create({ data: { workspaceId: req.workspaceId, versionId: pv.id, acceptedName: i.name, acceptedEmail: req.signerEmail, termsText: CONSENT_TEXT, termsVersion: CONSENT_VERSION, ipAddress: ev.ip ?? null, userAgent: ev.userAgent?.slice(0, 300) ?? null, acceptedAt: signedAt } }).catch(() => undefined);
          await tx.proposal.update({ where: { id: pv.proposalId }, data: { status: "accepted", acceptedVersionId: pv.id, version: { increment: 1 } } });
        }
      }
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


// ───────── One agreement: order summary + website requirements + price + our Terms & Conditions ─────────
type Doc = { number: number; body: string };
type ComposeIn = {
  reference: string; title: string; dateLabel: string; validUntilLabel: string; currency: string; oneOffMinor: number; recurringMinor: number; recurringPeriod: string | null;
  lines: { description: string; quantity: number; unitMinor: number; recurring: boolean }[];
  scope: string; requirements: Record<string, string | undefined>;
  provider: { legalName: string; companyNumber: string | null; registeredAddress: string; vatNumber: string | null };
  client: { legalName: string; kind: string; companyNumber: string | null; billingAddress: string; vatNumber: string | null };
  contact?: { name: string; email: string | null };
  issuedBy?: { name: string; position: string };
  /** The documents that make up the pack, as published. The SLA and hosting terms are included when the order has a care plan. */
  docs: { terms: Doc; sla?: Doc; hosting?: Doc };
  plan?: { name: string; monthlyMinor: number; revisionsPerMonth: number; backupFrequency: string | null; backupRetention: string | null };
  /** Terms for this customer only. They win over the Services Agreement where they differ. */
  special?: string;
  /** Values for the {{placeholders}} inside the documents. */
  vars: Record<string, string>;
};
const cell = (t: string) => t.replace(/\|/g, "/").replace(/\s*\n\s*/g, ", ").trim();
const lines_ = (t: string | undefined) => (t ?? "").split("\n").map((l) => l.trim().replace(/^[-•]\s*/, "")).filter(Boolean);
const joinNames = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/**
 * The agreement pack the customer reads and signs, in the structure of the OneSimpleSite quotation:
 * prepared by and for, the project, what is included, price, the service plan, then the full documents
 * (Services Agreement, SLA, Hosting and Care Plan Terms), and acceptance. One signature covers all of it.
 */
export function composeAgreement(c: ComposeIn) {
  const m = (n: number) => money(n, c.currency);
  const req = Object.fromEntries(Object.entries(c.requirements).map(([k, v]) => [k, v && normalizeNewlines(v)])) as Record<string, string | undefined>;
  const per = c.recurringPeriod ? `per ${c.recurringPeriod}` : "recurring";
  const included = [...lines_(req.features), ...lines_(req.integrations)];
  const notes = lines_(req.notes), pay = lines_(req.payment), specials = lines_(c.special);
  const promo = promoFrom(req, c.oneOffMinor);
  const payable = Math.max(0, c.oneOffMinor - (promo?.discountMinor ?? 0));
  const depositPct = Number(req.depositPercent) || 0;
  const deposit = depositPct > 0 && payable > 0 ? { pct: depositPct, now: Math.round((payable * depositPct) / 100), later: payable - Math.round((payable * depositPct) / 100) } : null;
  const row = (k: string, v: string | undefined) => (v?.trim() ? [`kv: ${k} | ${cell(v)}`] : []);
  let section = 0;
  // Headings are numbered by the document parser; the count is kept here so clauses carry the right number.
  const h = (title: string) => { section += 1; return `## ${title}`; };
  const clauses = (items: string[]) => items.map((x, i) => `${section}.${i + 1} ${x}`);

  const out: string[] = [
    `This order form sets out what ${c.provider.legalName} will do for ${c.client.legalName}, the fixed price, and how we will work together. Signing it makes it a binding agreement on the terms of the documents that follow.`,
    "",
    `party: Prepared by | ${c.provider.legalName} | ${[c.provider.companyNumber && `Registered in England and Wales, no. ${c.provider.companyNumber}`, `Registered office: ${cell(c.provider.registeredAddress)}`, `Email: ${c.vars.general_email || "hello@onesimplesite.co.uk"}`, c.provider.vatNumber && `VAT no. ${c.provider.vatNumber}`].filter(Boolean).join(" ; ")}`,
    `party: Prepared for | ${c.client.legalName} | ${[c.contact?.name, c.contact?.email && `Email: ${c.contact.email}`, c.client.companyNumber && `Company no. ${c.client.companyNumber}`, cell(c.client.billingAddress), c.client.vatNumber && `VAT no. ${c.client.vatNumber}`].filter(Boolean).join(" ; ")}`,
    "",
    `kv: Order number | ${c.reference}`, `kv: Date | ${c.dateLabel}`, `kv: Valid until | ${c.validUntilLabel}`,
    // The offer and the deposit are on the first page, so nobody has to hunt for what was agreed.
    ...(promo ? [`kv: Your offer | ${cell(`${promo.label}: ${[promo.discountMinor > 0 && c.oneOffMinor > 0 ? `${discountWords(promo, m)} the website fee, so ${m(payable)} to pay instead of ${m(c.oneOffMinor)}` : "", promo.freeMonths > 0 && c.recurringMinor > 0 ? (promo.endsAfter ? `the first ${monthsWords(promo.freeMonths)} of your care plan free, with no payment details needed, and then it simply ends unless you ask us to continue` : `the first ${monthsWords(promo.freeMonths)} of your monthly plan free`) : ""].filter(Boolean).join(", and ")}`)}`] : []),
    ...(deposit ? [`kv: Deposit when you sign | ${m(deposit.now)} (${deposit.pct}% of ${m(payable)}), then ${m(deposit.later)} before the website goes live`] : []),
    "", h("The project"),
    `kv: Project name | ${cell(c.title)}`, ...row("Summary", c.scope), ...row("Pages", req.pages), ...row("Domain and hosting", req.domainHosting), ...row("Content", req.contentBy), ...row("Timeline", req.timeline),
  ];
  if (included.length) out.push("", h("What is included"), ...included.map((x) => `- ${x}`));
  if (notes.length) out.push("", h("Not included, and other notes"), ...clauses(notes));
  out.push(
    "", h("Price"),
    "| Item | Description | Amount |",
    ...c.lines.map((l) => `| ${cell(l.description)}${l.quantity > 1 ? ` x ${l.quantity}` : ""} | ${l.recurring ? `Recurring, ${per}` : "One-off"} | ${m(l.quantity * l.unitMinor)}${l.recurring ? ` ${per}` : ""} |`),
    `| Total (one-off) |  | ${m(c.oneOffMinor)} |`,
    ...(promo?.discountMinor && c.oneOffMinor > 0 ? [`| ${cell(promo.label)}: ${promo.percent > 0 ? `${promo.percent}% ` : ""}discount on the website fee |  | -${m(promo.discountMinor)} |`, `| Website fee to pay |  | ${m(payable)} |`] : []),
    ...(c.recurringMinor > 0 ? [`| Total (recurring) |  | ${m(c.recurringMinor)} ${per} |`] : []),
    "",
    ...(deposit ? [`note: How the website fee is paid: a deposit of ${deposit.pct}% (${m(deposit.now)}) is due when you sign, and the final payment of ${m(deposit.later)} is due before the website goes live.`] : []),
    ...(promo?.freeMonths && c.recurringMinor > 0 ? [promo.endsAfter
      ? `note: ${promo.label}: the first ${monthsWords(promo.freeMonths)} of your care plan ${promo.freeMonths === 1 ? "is" : "are"} free. You do not need to give us a card, and nothing is charged. The plan then ends, with nothing to pay. If you would like us to carry on looking after your site at ${m(c.recurringMinor)} ${per}, just ask before it ends and we will set it up.`
      : `note: ${promo.label}: the first ${monthsWords(promo.freeMonths)} of your monthly plan ${promo.freeMonths === 1 ? "is" : "are"} free. You set the plan up with your card as normal, you are not charged during the free period, and the first payment of ${m(c.recurringMinor)} is taken ${monthsWords(promo.freeMonths)} after the day the plan starts. You can cancel under clause 14.1 of the Terms before then and pay nothing.`] : []),
    c.provider.vatNumber ? "note: Amounts exclude VAT, which is added at the current rate. Invoices are issued separately for the amounts and dates below." : `note: VAT is not charged because ${c.provider.legalName} is not VAT-registered. Invoices are issued separately for the amounts and dates below.`,
    ...clauses(pay),
  );
  if (c.plan) {
    out.push("", h("Your service plan"),
      `kv: Plan | ${cell(c.plan.name)}`, `kv: Monthly price | ${m(c.plan.monthlyMinor)} per month`, `kv: Website revisions | Up to ${c.plan.revisionsPerMonth} each calendar month`,
      ...row("Backups", c.plan.backupFrequency ? `${c.plan.backupFrequency}${c.plan.backupRetention ? `, kept for ${c.plan.backupRetention}` : ""}` : undefined),
      ...row("Hosting availability target", c.vars.availability_target), ...row("Support hours", c.vars.support_hours));
  }
  if (specials.length) out.push("", h("Special terms for this order"), "note: Where a special term below differs from our Services Agreement, the special term applies to this order.", ...clauses(specials));
  const names = ["our Services Agreement", ...(c.docs.sla ? ["our Service Level Agreement"] : []), ...(c.docs.hosting ? ["our Hosting and Care Plan Terms"] : [])];
  out.push("", h("The agreement documents"), `note: This order is made up of the order form above${c.plan ? ", your service plan" : ""}, ${joinNames(names)}. Together they form the agreement between us. They follow in full.`);
  const embed = (title: string, d: Doc) => out.push("", h(title), `note: ${title}, version ${d.number}.`, "", renumberTerms(d.body.trim()));
  embed("Services Agreement", c.docs.terms);
  if (c.docs.sla) embed("Service Level Agreement", c.docs.sla);
  if (c.docs.hosting) embed("Hosting and Care Plan Terms", c.docs.hosting);
  out.push(
    "", h("Accepting this order"),
    ...clauses(["To accept, sign below. Signing is your acceptance of this order and of every document in it."]),
    "",
    `sign: For ${c.provider.legalName.toUpperCase()}${c.issuedBy ? ` | ${c.issuedBy.name} | ${c.issuedBy.name} | ${c.issuedBy.position} | ${c.dateLabel}` : ""}`,
    `sign: Accepted by ${c.client.legalName.toUpperCase()}`,
  );
  return fillVars(out.join("\n"), c.vars);
}

/** Gathers everything an agreement is made from. Sending and the team's preview both use it, so what the team previews is what the customer gets. */
async function assemble(tx: Tx, ctx: StaffCtx, proposalId: string, signer: { name: string; email: string }) {
  const company = await getCompany(ctx);
  const p = await tx.proposal.findFirst({ where: { id: proposalId, workspaceId: ctx.workspaceId }, include: { customer: true } });
  if (!p) throw notFound();
  const blockers = [
    ...companyMissing(company).map((m) => `our ${m} (Settings)`),
    ...customerDetailsMissing(p.customer).map((m) => `the customer's ${m}`),
  ];
  const v = await tx.proposalVersion.findFirstOrThrow({ where: { proposalId, number: p.currentVersion }, include: { lines: { orderBy: { position: "asc" } } } });
  const reqs = (v.requirements ?? {}) as Record<string, string | undefined>;
  const plan = reqs.plan ? await tx.servicePlan.findFirst({ where: { id: reqs.plan, workspaceId: ctx.workspaceId } }) : null;
  // The pack: our Services Agreement always; the SLA and hosting terms when the order has a care plan. Published versions only.
  const draftOk = process.env.ALLOW_DRAFT_TERMS === "true";
  const pick = async (kind: "terms" | "sla" | "hosting") =>
    (await tx.termsVersion.findFirst({ where: { workspaceId: ctx.workspaceId, kind, status: "published" } })) ?? (draftOk ? await tx.termsVersion.findFirst({ where: { workspaceId: ctx.workspaceId, kind }, orderBy: { number: "desc" } }) : null);
  const [terms, sla, hosting] = await Promise.all([pick("terms"), plan ? pick("sla") : null, plan ? pick("hosting") : null]);
  const useDraft = [terms, sla, hosting].some((d) => d && d.status !== "published");
  if (!terms) blockers.push("a published Services Agreement (Settings, Legal documents)");
  if (plan && !sla) blockers.push("a published Service Level Agreement (Settings, Legal documents)");
  if (plan && !hosting) blockers.push("published Hosting and Care Plan Terms (Settings, Legal documents)");
  const vars = await documentValues(ctx.workspaceId, plan?.id);
  const unfilled = emptyVars([terms?.body, sla?.body, hosting?.body].filter(Boolean).join("\n"), vars).map(labelFor);
  if (unfilled.length) blockers.push(`these details (Settings, Plans and details): ${[...new Set(unfilled)].join(", ")}`);
  const position = (await tx.staffMembership.findUnique({ where: { id: ctx.staffId }, select: { jobTitle: true } }))?.jobTitle || "OneSimpleSite";
  const compose = (reference: string, validUntil: Date) => composeAgreement({
    reference, title: p.title, dateLabel: day(new Date()), validUntilLabel: day(v.validUntil ?? validUntil), currency: v.currency, oneOffMinor: v.oneOffMinor, recurringMinor: v.recurringMinor, recurringPeriod: v.recurringPeriod,
    lines: v.lines, scope: v.scope, requirements: (v.requirements ?? {}) as Record<string, string | undefined>,
    provider: { legalName: company.legalName ?? "[our company name]", companyNumber: company.companyNumber, registeredAddress: company.registeredAddress ?? "[our registered address]", vatNumber: company.vatNumber },
    client: { legalName: p.customer.legalName ?? p.customer.displayName ?? "[customer name]", kind: p.customer.kind, companyNumber: p.customer.companyNumber, billingAddress: p.customer.billingAddress ?? "[customer address]", vatNumber: p.customer.vatNumber },
    contact: { name: signer.name, email: signer.email },
    issuedBy: { name: ctx.name, position },
    docs: { terms: { number: terms!.number, body: terms!.body }, ...(sla ? { sla: { number: sla.number, body: sla.body } } : {}), ...(hosting ? { hosting: { number: hosting.number, body: hosting.body } } : {}) },
    plan: plan ? { name: plan.name, monthlyMinor: plan.monthlyMinor, revisionsPerMonth: plan.revisionsPerMonth, backupFrequency: plan.backupFrequency, backupRetention: plan.backupRetention } : undefined,
    special: v.terms || undefined, vars,
  });
  return { p, v, blockers, useDraft, terms, sla, hosting, plan, compose };
}

/**
 * Single customer step: freezes the proposal version, creates the contract and signing request in one
 * transaction, and emails ONE link. Signing it is the customer's acceptance, signature and consent to our Terms.
 */
export async function sendAgreement(ctx: StaffCtx, proposalId: string, raw: unknown) {
  if (!can(ctx.role, "proposal.send")) throw forbidden();
  const i = sendInput.parse(raw);
  return db.$transaction(async (tx) => {
    const { p, v, blockers, useDraft, terms, sla, hosting, plan, compose } = await assemble(tx, ctx, proposalId, i);
    void plan;
    if (p.status !== "draft") throw new DomainError("conflict", "Only a draft proposal can be sent. Revise it to create a new version.");
    if (blockers.length) throw new DomainError("validation", `Before sending, add: ${blockers.join("; ")}.`);
    const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 864e5);
    await tx.proposalVersion.update({ where: { id: v.id }, data: { sentAt: new Date(), sentToEmail: i.email, validUntil: v.validUntil ?? expiresAt } });
    await tx.proposal.update({ where: { id: p.id }, data: { status: "sent", version: { increment: 1 } } });
    if (p.opportunityId) await tx.opportunity.updateMany({ where: { id: p.opportunityId, workspaceId: ctx.workspaceId, stage: { in: ["new", "qualified"] } }, data: { stage: "contract_pending", version: { increment: 1 } } });
    // The order shares the quotation's number (OSS-QT-2026-047 becomes OSS-OF-2026-047). A revised quotation adds -R2, -R3...
    const base = /^OSS-QT-/.test(p.reference) ? p.reference.replace("OSS-QT-", "OSS-OF-") : await nextRef(tx, ctx.workspaceId, "order");
    const reference = p.currentVersion > 1 ? `${base}-R${p.currentVersion}` : base;
    const contentText = compose(reference, expiresAt);
    const contract = await tx.contract.create({
      data: { workspaceId: ctx.workspaceId, customerId: p.customerId, reference, title: p.title, status: "awaiting_signature", proposalVersionId: v.id, scopeSnapshot: `${v.scope}\n\n${v.terms}`.trim(), oneOffMinor: v.oneOffMinor, recurringMinor: v.recurringMinor, currency: v.currency, signingMode: "original_capture" },
    });
    const req = await tx.signingRequest.create({ data: { workspaceId: ctx.workspaceId, contractId: contract.id, signerName: i.name, signerEmail: i.email, contentText, contentSha256: sha256(contentText), expiresAt, sentById: ctx.staffId, termsVersionId: terms!.id } });
    const { token, hash } = newToken();
    await tx.scopedLinkToken.create({ data: { workspaceId: ctx.workspaceId, purpose: "contract_sign", entityId: req.id, tokenHash: hash, recipientEmail: i.email, expiresAt } });
    await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "agreement.sent", targetType: "contract", targetId: contract.id, customerId: p.customerId, detail: { to: i.email, termsVersion: terms!.number, documents: [{ kind: "terms", id: terms!.id, version: terms!.number }, ...(sla ? [{ kind: "sla", id: sla.id, version: sla.number }] : []), ...(hosting ? [{ kind: "hosting", id: hosting.id, version: hosting.number }] : [])], plan: plan?.key ?? null, draftWording: useDraft } });
    const alias = (await tx.staffMembership.findUnique({ where: { id: ctx.staffId }, select: { aliasEmail: true } }))?.aliasEmail;
    await enqueue(tx, ctx.workspaceId, "email.contract_request", `contract.request:${req.id}`, { ...(alias ? { replyTo: alias } : {}), to: i.email, signerName: i.name, title: p.title, ref: reference, business: p.customer.legalName ?? p.customer.displayName, link: portalLink(`/s/${token}`), expires: day(expiresAt) });
    return { contractId: contract.id, requestId: req.id, token, draftWording: useDraft };
  });
}

/** What the customer will receive, built from the saved draft. Read-only: nothing is frozen, created or emailed. */
export async function previewAgreement(ctx: StaffCtx, proposalId: string, signer?: { name: string; email: string }) {
  if (!can(ctx.role, "customer.read")) throw forbidden();
  return db.$transaction(async (tx) => {
    const primary = await tx.contact.findFirst({ where: { customer: { proposals: { some: { id: proposalId } } }, workspaceId: ctx.workspaceId }, orderBy: { isPrimary: "desc" }, select: { name: true, email: true } });
    const a = await assemble(tx, ctx, proposalId, signer ?? { name: primary?.name ?? "The customer", email: primary?.email ?? "" });
    const expires = new Date(Date.now() + EXPIRY_DAYS * 864e5);
    const reference = /^OSS-QT-/.test(a.p.reference) ? a.p.reference.replace("OSS-QT-", "OSS-OF-") : a.p.reference;
    return { title: a.p.title, reference: a.p.currentVersion > 1 ? `${reference}-R${a.p.currentVersion}` : reference, business: a.p.customer.legalName ?? a.p.customer.displayName, contentText: a.compose(reference, expires), blockers: a.blockers, draftWording: a.useDraft, status: a.p.status, signerName: signer?.name ?? primary?.name ?? "The customer", signerEmail: signer?.email ?? primary?.email ?? "" };
  });
}
