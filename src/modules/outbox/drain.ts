import { db } from "@/lib/db";
import { sendMail, type Mail } from "@/lib/mail";
import { fmtFrom, SENDERS, type SenderKey } from "@/lib/sender-identities";
import { internalNoticeTo } from "@/lib/env";
import { renderEmail, type EmailData, type TemplateName } from "@/emails/templates";

/**
 * Leases pending outbox rows (FOR UPDATE SKIP LOCKED), performs the external effect
 * outside the claiming transaction, then marks done. A crash after provider acceptance
 * but before marking done causes a retry; the provider idempotency key (dedupeKey)
 * makes that retry safe with Resend. Failures back off via attempts and surface as "failed".
 */
export async function drainOutbox(limit = 20) {
  const claimed = await db.$queryRaw<{ id: string }[]>`
    UPDATE "Outbox" SET "attempts" = "attempts" + 1
    WHERE "id" IN (SELECT "id" FROM "Outbox" WHERE "status" = 'pending' AND "attempts" < 5 ORDER BY "createdAt" LIMIT ${limit} FOR UPDATE SKIP LOCKED)
    RETURNING "id"`;
  let done = 0, failed = 0;
  for (const { id } of claimed) {
    const row = await db.outbox.findUniqueOrThrow({ where: { id } });
    try {
      await handle(row.topic, row.dedupeKey, row.payload as Record<string, unknown>);
      await db.outbox.update({ where: { id }, data: { status: "done", processedAt: new Date(), lastError: null } });
      done++;
    } catch (e) {
      failed++;
      await db.outbox.update({ where: { id }, data: { lastError: String(e).slice(0, 500), status: row.attempts >= 5 ? "failed" : "pending" } });
    }
  }
  return { claimed: claimed.length, done, failed };
}

async function handle(topic: string, key: string, p: Record<string, unknown>) {
  const send = async <K extends TemplateName>(name: K, data: EmailData[K], from: SenderKey, to: string, extra?: Partial<Mail>) => {
    const r = await renderEmail(name, data);
    await sendMail({ from: fmtFrom(from), to, subject: r.subject, html: r.html, text: r.text, replyTo: SENDERS.general.address, ...extra }, key);
  };
  const finalPdf = async () => {
    const d = await db.contractDocument.findUnique({ where: { contractId_kind: { contractId: String(p.contractId), kind: "final_pdf" } } });
    return d ? [{ filename: `${String(p.ref)}-signed.pdf`, content: Buffer.from(d.bytes) }] : undefined;
  };
  switch (topic) {
    case "email.proposal": return send("proposal", p as EmailData["proposal"], "general", String(p.to));
    case "email.contract_request": return send("contract_request", p as EmailData["contract_request"], "contracts", String(p.to));
    case "email.invitation": return send("invitation", p as EmailData["invitation"], "general", String(p.to));
    case "email.signing_confirmation": {
      const attachments = await finalPdf();
      return send("signing_confirmation", { ...(p as EmailData["signing_confirmation"]), hasAttachment: !!attachments }, "contracts", String(p.to), { attachments });
    }
    case "email.signing_notice": {
      const attachments = await finalPdf();
      return send("signing_notice", p as EmailData["signing_notice"], "contracts", internalNoticeTo(), { attachments });
    }
    case "notify.proposal_accepted":
    case "notify.contract_completed":
      return; // in-app: derived from records
    default:
      throw new Error(`No handler for outbox topic ${topic}`);
  }
}
