import { db } from "@/lib/db";
import { getClient } from "@/modules/identity/session";
import { audit } from "@/lib/audit";
import { sha256Bytes } from "@/lib/tokens";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await getClient();
  if (!c) return new Response("Unauthorised", { status: 401 });
  const { id } = await params;
  // Authorisation is the client's membership of the contract's customer, not just a valid file id.
  const d = await db.contractDocument.findFirst({ where: { contractId: id, kind: "final_pdf", contract: { customerId: { in: c.memberships.map((m) => m.customerId) } } }, include: { contract: true } });
  if (!d) return new Response("Not found", { status: 404 });
  if (sha256Bytes(d.bytes) !== d.sha256) return new Response("Integrity check failed", { status: 500 });
  await db.$transaction((tx) => audit(tx, { workspaceId: d.workspaceId, actor: { userId: c.userId, label: c.name }, action: "contract.pdf_downloaded_by_client", targetType: "contract", targetId: id, customerId: d.contract.customerId, visibility: "internal" }));
  return new Response(Buffer.from(d.bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${d.contract.reference}-signed.pdf"` } });
}
