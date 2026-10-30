import { requireStaff } from "@/modules/identity/session";
import { getTerms, getCompany } from "@/modules/settings/service";
import { sampleAgreement, CONSENT_TEXT, CONSENT_VERSION } from "@/modules/settings/sample";
import { buildSignedPdf } from "@/modules/signing/pdf";
import { sha256 } from "@/lib/tokens";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireStaff("settings.write");
  const { id } = await params;
  const t = await getTerms(ctx, id);
  if (!t) return new Response("Not found", { status: 404 });
  const text = sampleAgreement(await getCompany(ctx), { number: t.number, body: t.body });
  const when = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/London" }).format(new Date());
  const pdf = await buildSignedPdf({
    title: "Sample agreement", reference: "K-0000", contentText: text, contentSha256: sha256(text), signerName: "Sample Signer", signerEmail: "sample@example.com", method: "typed",
    signedAtLondon: when, signedAtUtc: new Date().toISOString(), consentText: CONSENT_TEXT, consentVersion: CONSENT_VERSION, draftWording: t.status !== "published",
  });
  return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="sample-agreement-v${t.number}.pdf"`, "Cache-Control": "private, no-store" } });
}
