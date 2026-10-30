import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "./env";

export type Mail = { from: string; to: string; subject: string; text: string; html?: string; replyTo?: string; attachments?: { filename: string; content: Buffer }[] };

/**
 * Local sink by default: writes .mail-sink/<id>.json. Resend is used only when
 * RESEND_API_KEY is set; staging restricts recipients with MAIL_ALLOWLIST.
 */
export async function sendMail(m: Mail, idempotencyKey?: string) {
  const e = env();
  if (!e.RESEND_API_KEY) {
    const dir = path.join(process.cwd(), ".mail-sink");
    await mkdir(dir, { recursive: true });
    const id = randomUUID();
    const { attachments, ...rest } = m;
    for (const a of attachments ?? []) await writeFile(path.join(dir, `${id}-${a.filename}`), a.content);
    await writeFile(path.join(dir, `${id}.json`), JSON.stringify({ ...rest, attachments: attachments?.map((a) => ({ filename: a.filename, bytes: a.content.length })), idempotencyKey }, null, 2));
    return { id, transport: "sink" as const };
  }
  const allow = (e.MAIL_ALLOWLIST ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (e.APP_ENV !== "production" && !allow.includes(m.to.toLowerCase())) {
    throw new Error("Recipient not on MAIL_ALLOWLIST (non-production)");
  }
  const { Resend } = await import("resend");
  const r = await new Resend(e.RESEND_API_KEY).emails.send(
    { from: m.from, to: m.to, subject: m.subject, text: m.text, html: m.html, replyTo: m.replyTo, attachments: m.attachments },
    idempotencyKey ? { idempotencyKey } : undefined,
  );
  if (r.error) throw new Error(r.error.message);
  return { id: r.data!.id, transport: "resend" as const };
}
