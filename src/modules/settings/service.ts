import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { DomainError, forbidden, notFound } from "@/lib/errors";
import { can } from "@/modules/identity/permissions";
import { hasPlaceholders, placeholderCount, normalizeNewlines } from "@/documents/parse";
import { LEGAL, LEGAL_KINDS, type LegalKind } from "./legal-docs";
import { starterBody } from "./legal-starters";
import { SERVICES_AGREEMENT } from "./legal-text";
import { unknownVars } from "./variables";
import type { StaffCtx } from "@/modules/identity/session";

const need = (ctx: StaffCtx) => { if (!can(ctx.role, "settings.write")) throw forbidden(); };

// ───────── Our company details (the "Provider" party on every agreement) ─────────
const companyInput = z.object({
  legalName: z.string().trim().max(200).optional(),
  companyNumber: z.string().trim().max(40).optional(),
  registeredAddress: z.string().trim().max(500).optional(),
  vatNumber: z.string().trim().max(40).optional(),
});

export async function getCompany(ctx: StaffCtx) {
  return db.workspace.findUniqueOrThrow({ where: { id: ctx.workspaceId }, select: { legalName: true, companyNumber: true, registeredAddress: true, vatNumber: true } });
}

export async function updateCompany(ctx: StaffCtx, raw: unknown) {
  need(ctx);
  const i = companyInput.parse(raw);
  await db.$transaction(async (tx) => {
    await tx.workspace.update({ where: { id: ctx.workspaceId }, data: { legalName: i.legalName || null, companyNumber: i.companyNumber || null, registeredAddress: i.registeredAddress || null, vatNumber: i.vatNumber || null } });
    await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "settings.company_updated", targetType: "workspace", targetId: ctx.workspaceId });
  });
}

/** Everything an agreement needs about us. Empty fields block sending: nothing is ever invented. */
export const companyMissing = (c: { legalName: string | null; registeredAddress: string | null }) =>
  [!c.legalName && "legal company name", !c.registeredAddress && "registered address"].filter(Boolean) as string[];

// ───────── Terms and Conditions: versioned, publishable, immutable once published ─────────
export const STARTER_TERMS = SERVICES_AGREEMENT;

export const listTerms = (ctx: StaffCtx, kind: LegalKind = "terms") => db.termsVersion.findMany({ where: { workspaceId: ctx.workspaceId, kind }, orderBy: { number: "desc" } });

/** Creates the placeholder starter draft the first time a document is opened, so the editor is never empty. */
export async function ensureStarter(ctx: StaffCtx, kind: LegalKind) {
  if (await db.termsVersion.count({ where: { workspaceId: ctx.workspaceId, kind } })) return;
  const body = starterBody(kind, await getCompany(ctx));
  await db.termsVersion.create({ data: { workspaceId: ctx.workspaceId, kind, number: 1, title: LEGAL[kind].label, body } }).catch(() => undefined);
}
export const ensureStarterTerms = (ctx: StaffCtx) => ensureStarter(ctx, "terms");

export async function getTerms(ctx: StaffCtx, id: string) {
  return db.termsVersion.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
}

/** Overview for the Legal documents page: what is published, what is still a draft. */
export async function legalOverview(ctx: StaffCtx) {
  for (const k of LEGAL_KINDS) await ensureStarter(ctx, k);
  const rows = await db.termsVersion.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { number: "desc" }, select: { id: true, kind: true, number: true, status: true, body: true, publishedAt: true, updatedAt: true } });
  return LEGAL_KINDS.map((kind) => {
    const mine = rows.filter((r) => r.kind === kind);
    const published = mine.find((r) => r.status === "published");
    const latest = mine[0];
    return { kind, published, latest, todo: latest?.status === "draft" ? placeholderCount(latest.body) : 0 };
  });
}

export const currentTerms = (workspaceId: string, kind: LegalKind = "terms") => db.termsVersion.findFirst({ where: { workspaceId, kind, status: "published" } });

const termsInput = z.object({ title: z.string().trim().min(1).max(200).default("Services Agreement"), body: z.string().trim().min(1, "The document can't be empty.").max(200_000) });

/** Saves a draft. Editing a published version never changes it: a new draft (next number) is created instead. */
export async function saveTermsDraft(ctx: StaffCtx, id: string | null, raw: unknown, kind: LegalKind = "terms") {
  need(ctx);
  const parsed = termsInput.parse(raw);
  const i = { ...parsed, body: normalizeNewlines(parsed.body) };
  return db.$transaction(async (tx) => {
    const existing = id ? await tx.termsVersion.findFirst({ where: { id, workspaceId: ctx.workspaceId } }) : null;
    if (id && !existing) throw notFound();
    const k = (existing?.kind as LegalKind | undefined) ?? kind;
    if (existing && existing.status === "draft") {
      const t = await tx.termsVersion.update({ where: { id: existing.id }, data: { title: i.title, body: i.body } });
      await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "terms.draft_saved", targetType: "terms", targetId: t.id, detail: { kind: k, number: t.number } });
      return t;
    }
    const max = await tx.termsVersion.aggregate({ where: { workspaceId: ctx.workspaceId, kind: k }, _max: { number: true } });
    const t = await tx.termsVersion.create({ data: { workspaceId: ctx.workspaceId, kind: k, number: (max._max.number ?? 0) + 1, title: i.title, body: i.body } });
    await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "terms.draft_created", targetType: "terms", targetId: t.id, detail: { kind: k, number: t.number, basedOn: existing?.number } });
    return t;
  });
}

/** Publishing is the team's sign-off. It is refused while any [TBC: ...] placeholder remains. Only the same document is retired. */
export async function publishTerms(ctx: StaffCtx, id: string) {
  need(ctx);
  return db.$transaction(async (tx) => {
    const t = await tx.termsVersion.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
    if (!t) throw notFound();
    if (t.status !== "draft") throw new DomainError("conflict", "Only a draft can be published.");
    const bad = unknownVars(t.body);
    if (bad.length) throw new DomainError("validation", `These values are not recognised: ${bad.map((b) => `{{${b}}}`).join(", ")}. Check the spelling.`);
    if (hasPlaceholders(t.body)) throw new DomainError("validation", `${placeholderCount(t.body)} placeholder(s) marked [TBC: ...] still need real wording before this can be published.`);
    await tx.termsVersion.updateMany({ where: { workspaceId: ctx.workspaceId, kind: t.kind, status: "published" }, data: { status: "retired" } });
    const p = await tx.termsVersion.update({ where: { id: t.id }, data: { status: "published", publishedAt: new Date(), publishedBy: ctx.name } });
    await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "terms.published", targetType: "terms", targetId: p.id, detail: { kind: t.kind, number: p.number } });
    return p;
  });
}
