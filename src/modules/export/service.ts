import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { forbidden } from "@/lib/errors";
import { can } from "@/modules/identity/permissions";
import type { StaffCtx } from "@/modules/identity/session";

/**
 * Business-data backup for one workspace. Deliberately EXCLUDES logins, password hashes, sessions,
 * one-time link tokens and the email queue: this file is for safekeeping your business records,
 * not for re-creating accounts. Treat the file as confidential: it contains customer data and signed contracts.
 */
export async function buildBackup(ctx: StaffCtx) {
  if (!can(ctx.role, "data.export")) throw forbidden();
  const w = ctx.workspaceId;
  const where = { workspaceId: w };
  const [workspace, staff, customers, contacts, opportunities, proposals, proposalVersions, acceptances, contracts, signingRequests, signatures, documents, projects, tasks, updates, assets, billing, events, notes, noteRevisions, terms, audits] = await Promise.all([
    db.workspace.findUnique({ where: { id: w } }),
    db.staffMembership.findMany({ where, select: { id: true, email: true, displayName: true, role: true, status: true, createdAt: true } }),
    db.customer.findMany({ where }), db.contact.findMany({ where }), db.opportunity.findMany({ where }),
    db.proposal.findMany({ where }),
    db.proposalVersion.findMany({ where, include: { lines: true } }),
    db.proposalAcceptance.findMany({ where }),
    db.contract.findMany({ where }),
    db.signingRequest.findMany({ where }),
    db.signatureRecord.findMany({ where }),
    db.contractDocument.findMany({ where }),
    db.project.findMany({ where }), db.task.findMany({ where }), db.projectUpdate.findMany({ where }), db.assetRequest.findMany({ where }),
    db.billingIntent.findMany({ where }),
    db.calendarEvent.findMany({ where, include: { attendees: true } }),
    db.note.findMany({ where }),
    db.noteRevision.findMany({ where: { note: { workspaceId: w } } }),
    db.termsVersion.findMany({ where }),
    db.auditEvent.findMany({ where }),
  ]);
  const b64 = (u: Uint8Array | null) => (u ? Buffer.from(u).toString("base64") : null);
  const data = {
    format: "onesimplesite-backup/1",
    exportedAt: new Date().toISOString(),
    exportedBy: ctx.email,
    note: "Business data only. Excludes logins, passwords, sessions and one-time link tokens. Binary fields (signed PDFs, signature images) are base64.",
    workspace, team: staff, customers, contacts, opportunities, proposals, proposalVersions, proposalAcceptances: acceptances,
    contracts, signingRequests, signatureRecords: signatures.map((s) => ({ ...s, signatureImage: b64(s.signatureImage) })),
    contractDocuments: documents.map((d) => ({ ...d, bytes: b64(d.bytes) })),
    projects, tasks, projectUpdates: updates, assetRequests: assets, billingIntents: billing, calendarEvents: events,
    notes, noteRevisions, termsVersions: terms, auditEvents: audits,
  };
  const counts = Object.fromEntries(Object.entries(data).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k, (v as unknown[]).length]));
  await db.$transaction((tx) => audit(tx, { workspaceId: w, actor: { userId: ctx.userId, label: ctx.name }, action: "data.exported", targetType: "workspace", targetId: w, detail: { counts } }));
  return { data, counts };
}

export async function lastExport(workspaceId: string) {
  return db.auditEvent.findFirst({ where: { workspaceId, action: "data.exported" }, orderBy: { createdAt: "desc" }, select: { createdAt: true, actorLabel: true } });
}

export const BACKUP_DUE_DAYS = 7;
export const isBackupDue = (last: { createdAt: Date } | null) => !last || Date.now() - last.createdAt.getTime() > BACKUP_DUE_DAYS * 864e5;
