import { db } from "@/lib/db";
import { getStaff } from "@/modules/identity/session";
import { can } from "@/modules/identity/permissions";
import { CONSENT_TEXT } from "@/modules/signing/service";
import { buildSignedPdf } from "@/modules/signing/pdf";
import { sha256 } from "@/lib/tokens";

/** A review copy of an agreement that is out for signature (the signed one has its own PDF). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getStaff();
  if (!ctx || !can(ctx.role, "customer.read")) return new Response("Unauthorised", { status: 401 });
  const { id } = await params;
  const k = await db.contract.findFirst({ where: { id, workspaceId: ctx.workspaceId }, include: { customer: { select: { displayName: true, legalName: true } }, signingRequests: { orderBy: { createdAt: "desc" }, take: 1 } } });
  const r = k?.signingRequests[0];
  if (!k || !r) return new Response("Not found", { status: 404 });
  const now = new Date();
  const pdf = await buildSignedPdf({
    title: k.title, reference: k.reference, contentText: r.contentText, contentSha256: sha256(r.contentText), signerName: r.signerName, signerEmail: r.signerEmail, method: "typed",
    signedAtLondon: new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/London" }).format(r.createdAt), signedAtUtc: now.toISOString(), consentText: CONSENT_TEXT, consentVersion: "review", unsigned: true, preparedFor: k.customer.legalName ?? k.customer.displayName,
  });
  return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${k.reference}-copy.pdf"`, "Cache-Control": "private, no-store" } });
}
