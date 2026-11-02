import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { internalNoticeTo } from "@/lib/env";
import { mailConfigured, sendMail } from "@/lib/mail";
import { fmtFrom } from "@/lib/sender-identities";
import { can } from "@/modules/identity/permissions";
import { forbidden } from "@/lib/errors";
import type { StaffCtx } from "@/modules/identity/session";
import { sha256 } from "@/lib/tokens";
import { buildSignedPdf } from "@/modules/signing/pdf";
import { sampleAgreement } from "./sample";
import { getCompany, STARTER_TERMS } from "./service";
import { EMAILS, sampleEmail } from "./email-samples";
import type { TemplateName } from "@/emails/templates";

export type TestResult = { id: string; label: string; ok: boolean; detail: string };

/**
 * Sends the real templates to our own inbox only. The recipient is fixed in code (never taken from the request),
 * every subject starts with [TEST], and one email carries a sample signed PDF so attachments are checked too.
 */
export async function sendTestEmails(ctx: StaffCtx, only?: TemplateName): Promise<TestResult[]> {
  if (!can(ctx.role, "settings.write")) throw forbidden();
  if (!mailConfigured()) return [{ id: "all", label: "Email", ok: false, detail: "Email isn't connected yet. Add RESEND_API_KEY in Vercel first." }];
  const to = internalNoticeTo();
  const run = `${Date.now()}`;
  const results: TestResult[] = [];
  for (const e of EMAILS.filter((x) => !only || x.id === only)) {
    try {
      const r = await sampleEmail(e.id);
      let attachments: { filename: string; content: Buffer }[] | undefined;
      if (e.id === "signing_confirmation" || e.id === "signing_notice") {
        const company = await getCompany(ctx);
        const text = sampleAgreement(company, { number: 1, body: STARTER_TERMS.replace(/\[TBC:[^\]]*\]/g, "Standard wording applies.") });
        const pdf = await buildSignedPdf({
          title: "Website for Sample Café", reference: "OSS-OF-2026-047", contentText: text, contentSha256: sha256(text), signerName: "Alex Sample", signerPosition: "Director", signerEmail: "alex@example.com",
          method: "typed", signedAtLondon: "2 November 2026 at 14:05", signedAtUtc: new Date().toISOString(), consentText: "I agree.", consentVersion: "sample", preparedFor: "Sample Café Ltd", draftWording: true,
        });
        attachments = [{ filename: "OSS-OF-2026-047-sample-signed.pdf", content: pdf }];
      }
      await sendMail({ from: fmtFrom(e.sender), to, subject: `[TEST] ${r.subject}`, html: r.html, text: r.text, attachments }, `test:${run}:${e.id}`);
      results.push({ id: e.id, label: e.label, ok: true, detail: attachments ? "Sent, with a sample PDF attached" : "Sent" });
    } catch (err) {
      results.push({ id: e.id, label: e.label, ok: false, detail: String(err instanceof Error ? err.message : err).slice(0, 200) });
    }
  }
  await db.$transaction((tx) => audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "email.test_sent", targetType: "email", targetId: only ?? "all", detail: { to, sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length } }));
  return results;
}
