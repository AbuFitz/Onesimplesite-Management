import { db } from "@/lib/db";
import { sendMail, mailConfigured, type Mail } from "@/lib/mail";
import { fmtFrom, SENDERS, type SenderKey } from "@/lib/sender-identities";
import { internalNoticeTo } from "@/lib/env";
import { buildReceiptPdf, companyForReceipt } from "@/modules/billing/receipt";
import { renderEmail, type EmailData, type TemplateName } from "@/emails/templates";

/**
 * Leases pending outbox rows (marked "sending" as they are claimed), performs the external effect
 * outside the claiming transaction, then marks done. A crash after provider acceptance
 * but before marking done causes a retry; the provider idempotency key (dedupeKey)
 * makes that retry safe with Resend. Failures back off via attempts and surface as "failed".
 */
export async function drainOutbox(limit = 20) {
  // Not configured yet: leave everything queued (no attempts consumed) rather than failing.
  if (!mailConfigured()) return { claimed: 0, done: 0, failed: 0, skipped: "mail not configured" as const };
  // A row that has been "sending" for ten minutes was lost with a crashed worker: put it back in the queue.
  await db.$executeRaw`UPDATE "Outbox" SET "status" = 'pending' WHERE "status" = 'sending' AND "processedAt" < now() - interval '10 minutes'`;
  // Claiming marks the row "sending" in the same statement, so two drains running at once can never both take it (that is what caused double emails).
  const claimed = await db.$queryRaw<{ id: string }[]>`
    UPDATE "Outbox" SET "status" = 'sending', "processedAt" = now(), "attempts" = "attempts" + 1
    WHERE "id" IN (SELECT "id" FROM "Outbox" WHERE "status" = 'pending' AND "attempts" < 5 ORDER BY "createdAt" LIMIT ${limit} FOR UPDATE SKIP LOCKED)
    RETURNING "id"`;
  let done = 0, failed = 0;
  for (const { id } of claimed) {
    const row = await db.outbox.findUniqueOrThrow({ where: { id } });
    try {
      await handle(row.topic, row.dedupeKey, row.payload as Record<string, unknown>);
      // Sign-in/signing links are single-use secrets: don't keep them once delivered.
      const clean = { ...(row.payload as Record<string, unknown>) }; delete clean.link;
      await db.outbox.update({ where: { id }, data: { status: "done", processedAt: new Date(), lastError: null, payload: clean as object } });
      done++;
    } catch (e) {
      failed++;
      await db.outbox.update({ where: { id }, data: { lastError: String(e).slice(0, 500), status: row.attempts >= 5 ? "failed" : "pending" } });
    }
  }
  return { claimed: claimed.length, done, failed };
}

async function handle(topic: string, key: string, p: Record<string, unknown>) {
  // A person who triggered the email can be the reply address (replies go to them, the sender stays the function address).
  const replyOverride = typeof p.replyTo === "string" ? p.replyTo : undefined;
  const fromOverride = typeof p.fromPerson === "string" ? p.fromPerson : undefined;
  const send = async <K extends TemplateName>(name: K, data: EmailData[K], from: SenderKey, to: string, extra?: Partial<Mail>) => {
    const r = await renderEmail(name, data);
    await sendMail({ from: fromOverride ?? fmtFrom(from), to, subject: r.subject, html: r.html, text: r.text, replyTo: replyOverride ?? SENDERS[from].replyTo, ...extra }, key);
  };
  const receiptPdf = async (id: unknown) => {
    if (typeof id !== "string") return undefined;
    const r = await db.receipt.findUnique({ where: { id } });
    if (!r) return undefined;
    const cu = await db.customer.findUnique({ where: { id: r.customerId }, select: { displayName: true, billingAddress: true } });
    return [{ filename: `${r.ref}.pdf`, content: await buildReceiptPdf(r, { business: cu?.displayName ?? "", billingAddress: cu?.billingAddress ?? null }, await companyForReceipt(r.workspaceId)) }];
  };
  const finalPdf = async () => {
    const d = await db.contractDocument.findUnique({ where: { contractId_kind: { contractId: String(p.contractId), kind: "final_pdf" } } });
    return d ? [{ filename: `${String(p.ref)}-signed.pdf`, content: Buffer.from(d.bytes) }] : undefined;
  };
  switch (topic) {
    case "email.proposal": return send("proposal", p as EmailData["proposal"], "legal", String(p.to));
    case "email.contract_request": return send("contract_request", p as EmailData["contract_request"], "legal", String(p.to));
    case "email.backup_reminder": return send("backup_reminder", p as EmailData["backup_reminder"], "noreply", internalNoticeTo());
    case "email.staff_invitation": return send("staff_invitation", p as EmailData["staff_invitation"], "noreply", String(p.to));
    case "email.invitation": return send("invitation", p as EmailData["invitation"], "noreply", String(p.to));
    case "email.payment_received": return send("payment_received", p as EmailData["payment_received"], "support", String(p.to), { attachments: await receiptPdf(p.receiptId) });
    case "email.plan_started": return send("plan_started", p as EmailData["plan_started"], "support", String(p.to), { attachments: await receiptPdf(p.receiptId) });
    case "email.payment_failed": return send("payment_failed", p as EmailData["payment_failed"], "support", String(p.to));
    case "email.payment_notice": return send("payment_notice", p as EmailData["payment_notice"], "noreply", internalNoticeTo());
    case "email.access_request_notice": return send("access_request_notice", p as EmailData["access_request_notice"], "noreply", internalNoticeTo());
    case "email.access_request_decision": return send("access_request_decision", p as EmailData["access_request_decision"], "support", String(p.to));
    case "email.change_request_quote": return send("change_request_quote", p as EmailData["change_request_quote"], "support", String(p.to));
    case "email.change_request_decision": return send("change_request_decision", p as EmailData["change_request_decision"], "noreply", internalNoticeTo());
    case "email.ticket_resolved": return send("ticket_resolved", p as EmailData["ticket_resolved"], "support", String(p.to));
    case "email.ticket_reminder": return send("ticket_reminder", p as EmailData["ticket_reminder"], "support", String(p.to));
    case "email.ticket_team_reminder": return send("ticket_team_reminder", p as EmailData["ticket_team_reminder"], "noreply", internalNoticeTo());
    case "email.daily_digest": return send("daily_digest", p as EmailData["daily_digest"], "noreply", internalNoticeTo());
    case "email.ticket_received": return send("ticket_received", p as EmailData["ticket_received"], "support", String(p.to));
    case "email.ticket_notice": return send("ticket_notice", p as EmailData["ticket_notice"], "noreply", internalNoticeTo());
    case "email.ticket_reply": return send("ticket_reply", p as EmailData["ticket_reply"], "support", String(p.to));
    case "email.signing_confirmation": {
      const attachments = await finalPdf();
      return send("signing_confirmation", { ...(p as EmailData["signing_confirmation"]), hasAttachment: !!attachments }, "legal", String(p.to), { attachments });
    }
    case "email.signing_notice": {
      const attachments = await finalPdf();
      return send("signing_notice", p as EmailData["signing_notice"], "noreply", internalNoticeTo(), { attachments });
    }
    case "notify.proposal_accepted":
    case "notify.contract_completed":
      return; // in-app: derived from records
    default:
      throw new Error(`No handler for outbox topic ${topic}`);
  }
}

/** For the Team page: what is waiting, and what has failed. */
export async function queueStatus(workspaceId: string) {
  const [pending, failed, recent] = await Promise.all([
    db.outbox.count({ where: { workspaceId, status: "pending", topic: { startsWith: "email." } } }),
    db.outbox.count({ where: { workspaceId, status: "failed" } }),
    db.outbox.findMany({ where: { workspaceId, topic: { startsWith: "email." }, OR: [{ status: "failed" }, { lastError: { not: null } }] }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, topic: true, status: true, lastError: true, attempts: true } }),
  ]);
  return { pending, failed, recent, configured: mailConfigured() };
}

export async function retryFailed(workspaceId: string) {
  await db.outbox.updateMany({ where: { workspaceId, status: "failed" }, data: { status: "pending", attempts: 0, lastError: null } });
}
