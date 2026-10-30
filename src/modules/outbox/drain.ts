import { db } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { fmtFrom, type SenderKey } from "@/lib/sender-identities";

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
  switch (topic) {
    case "email.proposal": {
      const link = String(p.link);
      await sendMail({
        from: fmtFrom((p.sender as SenderKey) ?? "general"), to: String(p.to),
        subject: `Proposal ${p.proposalRef}: ${p.title} (version ${p.version})`,
        text: `Hello,\n\nYour proposal "${p.title}" is ready to review.\n\nReview proposal: ${link}\n\nThe link is personal to you and expires. If it has stopped working, reply to this email and we will send a new one.\n\nOneSimpleSite`,
      }, key);
      return;
    }
    case "notify.proposal_accepted":
    case "notify.contract_completed":
      return; // in-app notifications are derived from records; nothing external to send yet
    default:
      throw new Error(`No handler for outbox topic ${topic}`);
  }
}
