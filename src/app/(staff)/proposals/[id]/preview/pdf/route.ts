import { getStaff } from "@/modules/identity/session";
import { can } from "@/modules/identity/permissions";
import { previewAgreement, CONSENT_TEXT } from "@/modules/signing/service";
import { buildSignedPdf } from "@/modules/signing/pdf";
import { sha256 } from "@/lib/tokens";

/** The same review copy the customer can download, for the team to check before sending. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getStaff();
  if (!ctx || !can(ctx.role, "customer.read")) return new Response("Unauthorised", { status: 401 });
  const { id } = await params;
  const r = await previewAgreement(ctx, id).catch(() => null);
  if (!r) return new Response("Not found", { status: 404 });
  const now = new Date();
  const pdf = await buildSignedPdf({
    title: r.title, reference: r.reference, contentText: r.contentText, contentSha256: sha256(r.contentText), signerName: r.signerName, signerEmail: r.signerEmail, method: "typed",
    signedAtLondon: new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/London" }).format(now), signedAtUtc: now.toISOString(), consentText: CONSENT_TEXT, consentVersion: "review", unsigned: true, draftWording: r.draftWording, preparedFor: r.business,
  });
  return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${r.reference}-preview.pdf"`, "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" } });
}
