import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { DomainError } from "@/lib/errors";
import type { ClientCtx } from "@/modules/portal/service";
import { clientCan } from "@/modules/portal/access";
import { saveUploads, type Upload } from "@/modules/files/service";

const FORBIDDEN = /\b(password|passcode|passwd|api[ _-]?key|secret)\b\s*[:=]/i;
const text = z.string().trim().max(5000);

/**
 * The customer sends material straight into their project: answers a "what we need" item with
 * text and/or files, or just sends something extra. No ticket. The owner gets a to-do on Today.
 */
export async function clientSendToProject(c: ClientCtx, projectId: string, assetId: string | null, raw: { text?: unknown; files: Upload[] }) {
  const p = await db.project.findFirst({ where: { id: projectId, customerId: { in: c.memberships.map((m) => m.customerId) } }, select: { id: true, name: true, workspaceId: true, customerId: true, ownerId: true } });
  if (!p || !clientCan(c, p.customerId, "tickets")) throw new DomainError("not_found", "We couldn't find that project.");
  const body = text.parse(raw.text ?? "");
  if (!body && !raw.files.length) throw new DomainError("validation", "Add a few words or choose a file to send.");
  if (FORBIDDEN.test(body)) throw new DomainError("validation", "Please don't send passwords or keys here. Tell us you have them and we'll arrange a safe way.");
  const asset = assetId ? await db.assetRequest.findFirst({ where: { id: assetId, projectId: p.id } }) : null;
  if (assetId && !asset) throw new DomainError("not_found", "We couldn't find that request.");
  const who = c.name || c.email || "Your customer";
  const label = asset?.label ?? "Extra material";
  await db.$transaction(async (tx) => {
    if (raw.files.length) await saveUploads(tx, { workspaceId: p.workspaceId, customerId: p.customerId, projectId: p.id, folder: `From you · ${label}`.slice(0, 60), internal: false, by: "client", name: who }, raw.files);
    if (asset) await tx.assetRequest.update({ where: { id: asset.id }, data: { receivedAt: new Date(), respondedAt: new Date(), response: body ? [asset.response, body].filter(Boolean).join("\n\n") : asset.response } });
    const owner = p.ownerId ?? (await tx.staffMembership.findFirst({ where: { workspaceId: p.workspaceId, status: "active" }, select: { id: true }, orderBy: { createdAt: "asc" } }))?.id ?? null;
    await tx.task.create({ data: { workspaceId: p.workspaceId, projectId: p.id, customerId: p.customerId, title: `${who} sent: ${label}${raw.files.length ? ` (${raw.files.length} file${raw.files.length > 1 ? "s" : ""})` : ""}${!asset && body ? ` — ${body.slice(0, 80)}` : ""}`, assigneeId: owner } });
    await audit(tx, { workspaceId: p.workspaceId, actor: { userId: c.userId, label: who }, action: "project.client_sent", targetType: "project", targetId: p.id, customerId: p.customerId, detail: { label, files: raw.files.length, text: !!body } });
  });
}
