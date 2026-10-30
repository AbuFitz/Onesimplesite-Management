import { db } from "@/lib/db";
import { enqueue } from "@/lib/audit";
import { manageLink } from "@/lib/env";
import { drainOutbox } from "@/modules/outbox/drain";
import { lastExport, isBackupDue } from "@/modules/export/service";

export const dynamic = "force-dynamic";

/** Daily job (Vercel cron): retries unsent emails and sends the weekly backup reminder when one is overdue. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorised", { status: 401 });

  for (const w of await db.workspace.findMany({ select: { id: true } })) {
    const last = await lastExport(w.id);
    if (isBackupDue(last)) {
      const now = new Date();
      const week = `${now.getUTCFullYear()}-${Math.floor((+now - +new Date(Date.UTC(now.getUTCFullYear(), 0, 1))) / (7 * 864e5))}`;
      await db.$transaction((tx) => enqueue(tx, w.id, "email.backup_reminder", `backup.reminder:${week}`, {
        to: "internal", link: manageLink("/backup"),
        lastBackup: last ? new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Europe/London" }).format(last.createdAt) : "never taken",
      }));
    }
  }
  return Response.json(await drainOutbox(100));
}
