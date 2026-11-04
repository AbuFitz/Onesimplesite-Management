import { db } from "@/lib/db";
import { enqueue } from "@/lib/audit";
import { portalLink, manageLink } from "@/lib/env";

/** How long a customer can wait for a first or next reply before we nudge ourselves, by priority. */
export const TEAM_WAIT_HOURS = { urgent: 1, high: 4, normal: 24, low: 72 } as const;
/** Days after our reply with no answer: first nudge, final warning, then the ticket is marked sorted. */
export const CUSTOMER_DAYS = { first: 3, final: 7, close: 10 } as const;
const H = 3_600_000, D = 24 * H;

/**
 * Run often (cheap, safe to repeat). Every email has a dedupe key, so running it twice never emails twice.
 * - Team: one list of tickets a customer is waiting on us for, at most once a day.
 * - Customer: a nudge at 3 days, a final warning at 7, and at 10 days the ticket is marked sorted (they can reopen it by replying).
 */
/** Reads every row a page at a time, so a busy system never skips tickets past the first 500. */
async function pages<T extends { id: string }>(fetch: (cursor?: string) => Promise<T[]>): Promise<T[]> {
  const out: T[] = []; let cursor: string | undefined;
  for (;;) { const rows = await fetch(cursor); out.push(...rows); if (rows.length < 500) return out; cursor = rows[rows.length - 1].id; }
}
export async function runTicketReminders(now = new Date()) {
  let team = 0, nudged = 0, closed = 0;
  // --- Waiting on us
  const open = await pages((cursor) => db.ticket.findMany({
    where: { status: { in: ["open", "customer_replied"] }, category: { not: "onboarding" } },
    include: { customer: { select: { displayName: true } } }, orderBy: { id: "asc" }, take: 500, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  }));
  const byWorkspace = new Map<string, typeof open>();
  for (const t of open) {
    const since = t.lastCustomerAt ?? t.createdAt;
    const waitH = (+now - +since) / H;
    const limit = TEAM_WAIT_HOURS[t.priority as keyof typeof TEAM_WAIT_HOURS] ?? 24;
    const alreadyToday = t.teamRemindedAt && +now - +t.teamRemindedAt < D;
    if (waitH >= limit && !alreadyToday) byWorkspace.set(t.workspaceId, [...(byWorkspace.get(t.workspaceId) ?? []), t]);
  }
  const day = now.toISOString().slice(0, 10);
  for (const [ws, list] of byWorkspace) {
    list.sort((a, b) => +(a.lastCustomerAt ?? a.createdAt) - +(b.lastCustomerAt ?? b.createdAt));
    await db.$transaction(async (tx) => {
      await enqueue(tx, ws, "email.ticket_team_reminder", `ticket.team:${day}`, { to: "internal", items: list.slice(0, 15).map((t) => ({ ref: t.reference, business: t.customer.displayName, title: t.title, hours: Math.round((+now - +(t.lastCustomerAt ?? t.createdAt)) / H), link: manageLink(`/support/${t.id}`) })) });
      await tx.ticket.updateMany({ where: { id: { in: list.map((t) => t.id) } }, data: { teamRemindedAt: now } });
    });
    team += list.length;
  }
  // --- Waiting on the customer
  const waiting = await pages((cursor) => db.ticket.findMany({ where: { status: "waiting_customer", lastStaffAt: { not: null } }, include: { contact: { select: { name: true, email: true } } }, orderBy: { id: "asc" }, take: 500, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) }));
  for (const t of waiting) {
    const days = (+now - +t.lastStaffAt!) / D;
    const sent = t.remindedAt && +t.remindedAt > +t.lastStaffAt! ? (+t.remindedAt - +t.lastStaffAt!) / D : null;   // how many days in when we last nudged
    const link = portalLink(`/help/${t.id}`);
    const mail = (final: boolean) => t.contact?.email ? enqueue(db as never, t.workspaceId, "email.ticket_reminder", `ticket.remind:${t.id}:${final ? "final" : "first"}:${+t.lastStaffAt!}`, { to: t.contact.email, name: t.contact.name, ref: t.reference, title: t.title, days: Math.floor(days), final, link }) : Promise.resolve();
    if (days >= CUSTOMER_DAYS.close) {
      await db.$transaction(async (tx) => {
        await tx.ticket.update({ where: { id: t.id }, data: { status: "resolved", resolvedAt: now } });
        await tx.ticketComment.create({ data: { workspaceId: t.workspaceId, ticketId: t.id, authorKind: "staff", authorName: "OneSimpleSite", body: "We haven't heard back, so we've marked this as sorted. Reply any time and it comes straight back to us." } });
      });
      closed++;
    } else if (days >= CUSTOMER_DAYS.final && (sent === null || sent < CUSTOMER_DAYS.final)) {
      await mail(true); await db.ticket.update({ where: { id: t.id }, data: { remindedAt: now } }); nudged++;
    } else if (days >= CUSTOMER_DAYS.first && sent === null) {
      await mail(false); await db.ticket.update({ where: { id: t.id }, data: { remindedAt: now } }); nudged++;
    }
  }
  return { team, nudged, closed };
}

let last = 0;
/** Called when staff open the app so reminders don't depend only on the daily job. At most once every 10 minutes per server. */
export async function maybeRunReminders() {
  if (Date.now() - last < 10 * 60_000) return;
  last = Date.now();
  await runTicketReminders();
  const { sendDailyDigest } = await import("@/modules/outbox/digest");
  const { syncLegalDocs } = await import("@/modules/settings/sync-legal");
  for (const w of await db.workspace.findMany({ select: { id: true } })) { await sendDailyDigest(w.id); await syncLegalDocs(w.id).catch(() => undefined); }
  const { drainOutbox } = await import("@/modules/outbox/drain");
  await drainOutbox();
}
