import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { hasPlaceholders, normalizeNewlines } from "@/documents/parse";
import { LEGAL, LEGAL_KINDS } from "./legal-docs";
import { starterBody } from "./legal-starters";
import { LEGAL_SET_VERSION } from "./legal-text";

/**
 * Publishes the current set of customer legal documents (the wording in legal-text.ts and legal-starters.ts) without anyone pressing a button.
 * It runs once per version of the set per workspace: after that it leaves the documents alone, so a team member's own edits are never overwritten
 * until the wording in code moves to a newer version. Nothing is published while a [TBC: ...] marker is still in a document.
 */
export async function syncLegalDocs(workspaceId: string, by = "Auto-publish") {
  const w = await db.workspace.findUnique({ where: { id: workspaceId }, select: { settings: true, legalName: true, companyNumber: true, registeredAddress: true } });
  if (!w) return { published: [] as string[], skipped: "no workspace" };
  const settings = (w.settings ?? {}) as Record<string, unknown>;
  if (settings.legalSync === LEGAL_SET_VERSION) return { published: [] as string[], skipped: "up to date" };
  const facts = { legalName: w.legalName, companyNumber: w.companyNumber, registeredAddress: w.registeredAddress };
  const published: string[] = [], waiting: string[] = [];
  for (const kind of LEGAL_KINDS) {
    const body = normalizeNewlines(starterBody(kind, facts)).trim();
    if (!body || hasPlaceholders(body)) { waiting.push(kind); continue; }
    const live = await db.termsVersion.findFirst({ where: { workspaceId, kind, status: "published" } });
    if (live && normalizeNewlines(live.body).trim() === body) continue;
    try {
      await db.$transaction(async (tx) => {
        const last = await tx.termsVersion.findFirst({ where: { workspaceId, kind }, orderBy: { number: "desc" }, select: { number: true } });
        await tx.termsVersion.updateMany({ where: { workspaceId, kind, status: "published" }, data: { status: "retired" } });
        const t = await tx.termsVersion.create({ data: { workspaceId, kind, number: (last?.number ?? 0) + 1, title: LEGAL[kind].label, body, status: "published", publishedAt: new Date(), publishedBy: `${by} (version ${LEGAL_SET_VERSION})` } });
        await audit(tx, { workspaceId, actor: null, action: "terms.published", targetType: "terms", targetId: t.id, detail: { kind, number: t.number, auto: true, set: LEGAL_SET_VERSION } });
      });
      published.push(kind);
    } catch { waiting.push(kind); /* someone else published at the same moment: next run will see it */ }
  }
  if (!waiting.length) await db.workspace.update({ where: { id: workspaceId }, data: { settings: { ...settings, legalSync: LEGAL_SET_VERSION } as never } });
  return { published, waiting };
}
