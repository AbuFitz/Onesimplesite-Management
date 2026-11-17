import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";

/**
 * DEV SITE ONLY. A serverless function cannot hand files back, so on the dev site every email the sink "sends" is also saved in
 * dev_tools.mail_sink (a table that exists only in the dev database, created by scripts/dev-prepare.mjs) so tests can read it back.
 * Never throws: a problem here must not stop an email being "sent".
 */
export async function captureDevMail(mail: Record<string, unknown>) {
  try {
    await db.$executeRaw`INSERT INTO dev_tools.mail_sink (id, mail) VALUES (${randomUUID()}::uuid, ${JSON.stringify(mail)}::jsonb)`;
  } catch (e) {
    console.warn("dev mail capture failed:", e instanceof Error ? e.message : e);
  }
}
