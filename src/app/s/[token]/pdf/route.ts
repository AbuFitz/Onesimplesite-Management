import { viewSigning, CONSENT_TEXT } from "@/modules/signing/service";
import { buildSignedPdf } from "@/modules/signing/pdf";
import { sha256 } from "@/lib/tokens";

/** A read-only copy of what is about to be signed, for people who want to read it on paper first. */
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await viewSigning(token);
  if (!r.ok) return new Response("This link isn't available.", { status: 404 });
  const now = new Date();
  const pdf = await buildSignedPdf({
    title: r.title, reference: r.reference, contentText: r.contentText, contentSha256: sha256(r.contentText), signerName: r.signerName, signerEmail: r.signerEmail, method: "typed",
    signedAtLondon: new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/London" }).format(r.sentAt), signedAtUtc: now.toISOString(), consentText: CONSENT_TEXT, consentVersion: "review", unsigned: true, preparedFor: r.business,
  });
  return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${r.reference}-review-copy.pdf"`, "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" } });
}
