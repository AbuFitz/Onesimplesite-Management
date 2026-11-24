import { db } from "@/lib/db";
import { describe, type Group } from "@/modules/activity/describe";
import type { StaffCtx, getClient } from "@/modules/identity/session";
type ClientCtx = NonNullable<Awaited<ReturnType<typeof getClient>>>;

/**
 * What the bell shows. Nothing is stored for this: it is worked out from what already happened (activity, replies, payments),
 * so it can never get out of step with the real records. Which ones are "read" is remembered in the person's own browser.
 */
export type Notice = { id: string; at: string; title: string; sub?: string; href: string; kind: Group | "reply" | "referral"; tone?: "good" | "warn" | "bad" };
const DAYS = (n: number) => new Date(Date.now() - n * 864e5);
const STAFF_ACTIONS = ["contract.signed", "contract.declined", "billing.paid", "billing.paid_manually", "billing.plan_started", "billing.plan_past_due", "billing.plan_cancelled", "access.requested", "ticket.created", "company.registered", "referral.created", "referral.qualified"];

const hrefFor = (action: string, targetType: string, targetId: string, customerId: string | null, staff: boolean) => {
  if (action.startsWith("referral.")) return staff ? "/referrals" : "/referrals";
  if (staff) return action.startsWith("contract.") ? `/contracts/${targetId}` : action.startsWith("ticket.") ? `/support/${targetId}` : customerId ? `/customers/${customerId}` : "/";
  return action.startsWith("billing.") ? "/billing" : action.startsWith("contract.") ? "/documents" : action.startsWith("project.") ? `/projects/${targetId}` : action.startsWith("ticket.") ? `/help/${targetId}` : "/overview";
};

export async function staffNotices(ctx: StaffCtx): Promise<Notice[]> {
  const [events, replies] = await Promise.all([
    db.auditEvent.findMany({ where: { workspaceId: ctx.workspaceId, createdAt: { gte: DAYS(14) }, action: { in: STAFF_ACTIONS }, OR: [{ actorId: null }, { actorId: { not: ctx.userId } }] }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.ticket.findMany({ where: { workspaceId: ctx.workspaceId, status: { notIn: ["resolved", "closed"] }, lastCustomerAt: { gte: DAYS(14) } }, orderBy: { lastCustomerAt: "desc" }, take: 15, select: { id: true, title: true, lastCustomerAt: true, lastStaffAt: true, customer: { select: { displayName: true } } } }),
  ]);
  const ids = [...new Set(events.map((e) => e.customerId).filter((x): x is string => !!x))];
  const names = new Map((await db.customer.findMany({ where: { id: { in: ids } }, select: { id: true, displayName: true } })).map((c) => [c.id, c.displayName]));
  const out: Notice[] = events.map((e) => { const d = describe(e.action); return { id: `a:${e.id}`, at: e.createdAt.toISOString(), title: e.action.startsWith("referral.") ? (e.action === "referral.qualified" ? "A referral is complete" : "New referral") : d.text, sub: e.customerId ? names.get(e.customerId) : undefined, href: hrefFor(e.action, e.targetType, e.targetId, e.customerId, true), kind: e.action.startsWith("referral.") ? "referral" : d.group, tone: d.tone }; });
  for (const t of replies) if (t.lastCustomerAt && (!t.lastStaffAt || t.lastCustomerAt > t.lastStaffAt)) out.push({ id: `r:${t.id}:${+t.lastCustomerAt}`, at: t.lastCustomerAt.toISOString(), title: `${t.customer.displayName} replied`, sub: t.title, href: `/support/${t.id}`, kind: "reply", tone: "warn" });
  return out.sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 40);
}

export async function clientNotices(c: ClientCtx): Promise<Notice[]> {
  const customerIds = c.memberships.map((m) => m.customerId);
  const workspaceIds = [...new Set(c.memberships.map((m) => m.customer.workspaceId))];
  const [events, tickets, rewards] = await Promise.all([
    db.auditEvent.findMany({ where: { customerId: { in: customerIds }, visibility: "client", createdAt: { gte: DAYS(30) }, OR: [{ actorId: null }, { actorId: { not: c.userId } }] }, orderBy: { createdAt: "desc" }, take: 25 }),
    db.ticket.findMany({ where: { customerId: { in: customerIds }, status: { notIn: ["closed"] }, lastStaffAt: { gte: DAYS(14) } }, orderBy: { lastStaffAt: "desc" }, take: 10, select: { id: true, title: true, lastStaffAt: true, lastCustomerAt: true } }),
    db.rewardEntry.findMany({ where: { workspaceId: { in: workspaceIds }, payeeId: { in: customerIds }, kind: { in: ["earned", "paid"] }, createdAt: { gte: DAYS(60) } }, orderBy: { createdAt: "desc" }, take: 5 }).catch(() => []),
  ]);
  const out: Notice[] = events.map((e) => { const d = describe(e.action); return { id: `a:${e.id}`, at: e.createdAt.toISOString(), title: d.text, href: hrefFor(e.action, e.targetType, e.targetId, e.customerId, false), kind: d.group, tone: d.tone }; });
  for (const t of tickets) if (t.lastStaffAt && (!t.lastCustomerAt || t.lastStaffAt > t.lastCustomerAt)) out.push({ id: `r:${t.id}:${+t.lastStaffAt}`, at: t.lastStaffAt.toISOString(), title: "We replied", sub: t.title, href: `/help/${t.id}`, kind: "reply", tone: "good" });
  for (const r of rewards) out.push({ id: `w:${r.id}`, at: r.createdAt.toISOString(), title: r.kind === "paid" ? "Your referral reward was paid" : "You earned a referral reward", sub: `£${(Math.abs(r.amountMinor) / 100).toFixed(2)}`, href: "/referrals", kind: "referral", tone: "good" });
  return out.sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 40);
}
