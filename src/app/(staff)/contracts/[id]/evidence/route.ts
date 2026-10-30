import { db } from "@/lib/db";
import { getStaff } from "@/modules/identity/session";
import { can } from "@/modules/identity/permissions";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getStaff();
  if (!ctx || !can(ctx.role, "customer.read")) return new Response("Unauthorised", { status: 401 });
  const { id } = await params;
  const r = await db.signingRequest.findFirst({ where: { contractId: id, workspaceId: ctx.workspaceId, status: "signed" }, include: { signature: true, contract: { include: { documents: { select: { sha256: true } } } } } });
  if (!r?.signature) return new Response("Not found", { status: 404 });
  const body = { contract: r.contract.reference, finalPdfSha256: r.contract.documents[0]?.sha256, evidence: r.signature.evidence, evidenceSha256: r.signature.evidenceSha256, hashNote: "evidenceSha256 = SHA-256 of the evidence object serialised with sorted keys. Hashes do not prove identity or prevent a database administrator rewriting history." };
  return new Response(JSON.stringify(body, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="${r.contract.reference}-evidence.json"` } });
}
