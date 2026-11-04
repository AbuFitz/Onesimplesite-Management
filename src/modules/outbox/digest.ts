import { db } from "@/lib/db";
import { enqueue } from "@/lib/audit";

type Line = { text: string; link?: string };
const GROUP: Record<string, string> = { "email.ticket_notice": "Tickets", "email.ticket_team_reminder": "Waiting on us", "email.payment_notice": "Payments", "email.change_request_decision": "Needs a look", "email.access_request_notice": "Needs a look", "email.backup_reminder": "Reminders" };
const gh = (n: unknown) => String(n ?? "").trim();

/** One plain line for each held notice. */
function lineFor(topic: string, p: Record<string, unknown>): Line {
  const link = typeof p.link === "string" ? p.link : undefined;
  switch (topic) {
    case "email.ticket_notice": return { text: `${gh(p.person)} at ${gh(p.business)} ${p.isReply ? "replied on" : "raised"} “${gh(p.title)}” (${gh(p.ref)}${p.priority && p.priority !== "normal" ? `, ${gh(p.priority)}` : ""})`, link };
    case "email.payment_notice": return { text: `${({ paid: "Payment received", plan_started: "Plan started", failed: "Payment failed", cancelled: "Plan cancelled" } as Record<string, string>)[gh(p.event)] ?? "Payment"}: ${gh(p.business)}, ${gh(p.what)} ${gh(p.amount)}`, link };
    case "email.change_request_decision": return { text: `${gh(p.person)} at ${gh(p.business)} ${p.approved ? "approved" : "declined"} ${gh(p.price)} for “${gh(p.title)}”`, link };
    case "email.access_request_notice": return { text: `${gh(p.requester)} at ${gh(p.business)} asked to add ${gh(p.name)} to the portal`, link };
    case "email.ticket_team_reminder": { const items = (p.items as { business: string; title: string; hours: number; link: string }[] | undefined) ?? []; return { text: `${items.length} ${items.length === 1 ? "customer is" : "customers are"} waiting on us${items[0] ? `, longest: ${items[0].business} (${items[0].hours}h)` : ""}`, link: items[0]?.link }; }
    case "email.backup_reminder": return { text: `A backup is due (last: ${gh(p.lastBackup)})`, link };
    default: return { text: topic.replace("email.", "").replaceAll("_", " "), link };
  }
}

const londonHour = (d: Date) => Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Europe/London" }).format(d));
const londonDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(d);

/**
 * Bundles every held team notice into ONE email. At most one a day (from 7am), unless `force` is set from the Testing page.
 * Notices the team already dealt with are still listed, because they are cheap to skim and nothing is lost.
 */
export async function sendDailyDigest(workspaceId: string, o: { now?: Date; force?: boolean } = {}) {
  const now = o.now ?? new Date();
  if (!o.force) {
    if (londonHour(now) < 7) return { sent: 0, reason: "too early" as const };
    const already = await db.outbox.findFirst({ where: { workspaceId, topic: "email.daily_digest", createdAt: { gte: new Date(+now - 20 * 36e5) } }, select: { id: true } });
    if (already) return { sent: 0, reason: "already sent today" as const };
  }
  const rows = await db.outbox.findMany({ where: { workspaceId, status: "held" }, orderBy: { createdAt: "asc" }, take: 300 });
  if (!rows.length) return { sent: 0, reason: "nothing held" as const };
  const groups = new Map<string, Line[]>();
  for (const r of rows) { const g = GROUP[r.topic] ?? "Other"; groups.set(g, [...(groups.get(g) ?? []), lineFor(r.topic, r.payload as Record<string, unknown>)]); }
  const order = ["Needs a look", "Tickets", "Waiting on us", "Payments", "Reminders", "Other"];
  await db.$transaction(async (tx) => {
    await enqueue(tx, workspaceId, "email.daily_digest", `digest:${workspaceId}:${rows[0].id}`, { to: "internal", day: londonDay(now), total: rows.length, groups: order.filter((g) => groups.has(g)).map((title) => ({ title, lines: groups.get(title)!.slice(0, 25) })) });
    await tx.outbox.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { status: "done", processedAt: now } });
  });
  return { sent: 1, items: rows.length };
}
