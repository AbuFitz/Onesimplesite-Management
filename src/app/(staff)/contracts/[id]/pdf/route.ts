import { db } from "@/lib/db";
import { getStaff } from "@/modules/identity/session";
import { can } from "@/modules/identity/permissions";
import { audit } from "@/lib/audit";
import { sha256Bytes } from "@/lib/tokens";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getStaff();
  if (!ctx || !can(ctx.role, "customer.read")) return new Response("Unauthorised", { status: 401 });
  const { id } = await params;
  const d = await db.contractDocument.findFirst({ where: { contractId: id, workspaceId: ctx.workspaceId, kind: "final_pdf" }, include: { contract: true } });
  if (!d) return new Response("Not found", { status: 404 });
  if (sha256Bytes(d.bytes) !== d.sha256) return new Response("Integrity check failed", { status: 500 });
  await db.$transaction((tx) => audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "contract.pdf_downloaded", targetType: "contract", targetId: id, customerId: d.contract.customerId }));
  return new Response(Buffer.from(d.bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${d.contract.reference}-signed.pdf"` } });
}
