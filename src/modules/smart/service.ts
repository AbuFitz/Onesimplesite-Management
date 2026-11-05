import { db } from "@/lib/db";
import { can } from "@/modules/identity/permissions";
import { TEAM_WAIT_HOURS } from "@/modules/support/reminders";
import { STAGE_GUIDE } from "@/modules/projects/service";
import { PROBLEM_LABEL } from "@/lib/problems";
import { lastExport, isBackupDue } from "@/modules/export/service";
import type { StaffCtx } from "@/modules/identity/session";

export type Suggestion = { id: string; level: "urgent" | "high" | "normal" | "tip"; title: string; reason: string; action: { label: string; href: string } };
const WEIGHT = { urgent: 0, high: 1, normal: 2, tip: 3 } as const;
const H = 36e5, D = 864e5;
const gbp = (minor: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(minor / 100);
const ago = (ms: number) => (ms >= 2 * D ? `${Math.floor(ms / D)} days` : ms >= H ? `${Math.floor(ms / H)} hours` : `${Math.max(1, Math.floor(ms / 60000))} minutes`);
const nameMap = async (ids: string[]) => new Map((await db.customer.findMany({ where: { id: { in: ids } }, select: { id: true, displayName: true } })).map((c) => [c.id, c.displayName]));
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * What a sharp colleague would point out right now. Every suggestion says WHY it's showing and takes you straight to the fix.
 * Permission-aware, cheap to compute (small limited queries), and ids are stable so "Later" can hide one for the day.
 */
export async function suggestionsFor(ctx: StaffCtx, now = new Date()): Promise<Suggestion[]> {
  const w = ctx.workspaceId, out: Suggestion[] = [];
  const seeBiz = can(ctx.role, "customer.read"), seeProjects = can(ctx.role, "project.read_all") || can(ctx.role, "project.read_assigned");
  const q: Promise<void>[] = [];

  if (can(ctx.role, "settings.write")) {
    q.push((async () => {
      const rows = await db.auditEvent.findMany({ where: { workspaceId: w, action: { startsWith: "problem." }, createdAt: { gte: new Date(+now - D) } }, orderBy: { createdAt: "desc" }, take: 10, select: { id: true, action: true, createdAt: true } });
      if (rows.length) out.push({ id: `problems:${rows[0].id}`, level: "urgent", title: `${rows.length} ${plural(rows.length, "thing", "things")} went wrong in the last day`, reason: `Most recent: ${PROBLEM_LABEL[rows[0].action.replace("problem.", "")] ?? "something failed"} ${ago(+now - +rows[0].createdAt)} ago. It shows what failed and for whom.`, action: { label: "See what failed", href: "/testing#problems" } });
    })());
  }
  if (seeBiz) {
    q.push((async () => {
      const waiting = await db.ticket.findMany({ where: { workspaceId: w, status: { in: ["open", "customer_replied"] } }, include: { customer: { select: { displayName: true } } }, orderBy: { updatedAt: "asc" }, take: 30 });
      const late = waiting.map((t) => ({ t, ms: +now - +(t.lastCustomerAt ?? t.createdAt), limit: (TEAM_WAIT_HOURS[t.priority as keyof typeof TEAM_WAIT_HOURS] ?? 24) * H })).filter((x) => x.ms >= x.limit).sort((a, b) => b.ms / b.limit - a.ms / a.limit);
      if (late.length) { const top = late[0]; out.push({ id: `tk-wait:${top.t.id}`, level: top.t.priority === "urgent" || top.t.priority === "high" ? "urgent" : "high", title: late.length === 1 ? `${top.t.customer.displayName} is waiting for a reply` : `${late.length} customers are waiting for a reply`, reason: `“${top.t.title}” from ${top.t.customer.displayName} has waited ${ago(top.ms)}${late.length > 1 ? `, the longest of ${late.length}` : ""}.`, action: { label: "Open it", href: `/support/${top.t.id}` } }); }
    })());
    q.push((async () => {
      const rows = await db.billingIntent.findMany({ where: { workspaceId: w, status: "past_due" }, take: 3 });
      const names = await nameMap(rows.map((r) => r.customerId));
      for (const b of rows)
        out.push({ id: `pay-failed:${b.id}`, level: "urgent", title: `A payment failed for ${names.get(b.customerId) ?? "a customer"}`, reason: `Their ${gbp(b.amountMinor)} ${b.kind === "recurring_setup" ? "monthly plan payment" : "payment"} was declined. They've been emailed, but a quick call often sorts it.`, action: { label: "See the order", href: b.contractId ? `/contracts/${b.contractId}` : `/support/${b.ticketId}` } });
    })());
    q.push((async () => {
      const unsigned = await db.signingRequest.findMany({ where: { status: "pending", createdAt: { lt: new Date(+now - 3 * D) }, contract: { workspaceId: w, status: "awaiting_signature" } }, include: { contract: { select: { id: true, customer: { select: { displayName: true } } } } }, orderBy: { createdAt: "asc" }, take: 3 });
      for (const r of unsigned) out.push({ id: `sign:${r.contract.id}`, level: +now - +r.createdAt > 7 * D ? "high" : "normal", title: `${r.contract.customer.displayName} hasn't signed yet`, reason: `The agreement went out ${ago(+now - +r.createdAt)} ago. A nudge by phone or a fresh link usually does it.`, action: { label: "Open the agreement", href: `/contracts/${r.contract.id}` } });
    })());
    q.push((async () => {
      for (const t of await db.ticket.findMany({ where: { workspaceId: w, chargeStatus: "quoted", lastStaffAt: { lt: new Date(+now - 3 * D) } }, include: { customer: { select: { displayName: true } } }, take: 3 }))
        out.push({ id: `quote-wait:${t.id}`, level: "normal", title: `No answer yet on a price for ${t.customer.displayName}`, reason: `You sent ${gbp(t.priceMinor ?? 0)} for “${t.title}” ${ago(+now - +(t.lastStaffAt ?? now))} ago.`, action: { label: "Follow up", href: `/support/${t.id}` } });
    })());
    q.push((async () => {
      const reqs = await db.accessRequest.findMany({ where: { workspaceId: w, status: "pending" }, orderBy: { createdAt: "asc" }, take: 3 });
      if (reqs.length) out.push({ id: `access:${reqs[0].id}`, level: "high", title: `${reqs.length} ${plural(reqs.length, "person is", "people are")} waiting for portal access`, reason: `${reqs[0].requestedByName} asked for ${reqs[0].name} to be added. Check who they are, then approve or decline.`, action: { label: "Review", href: `/customers/${reqs[0].customerId}?tab=people` } });
    })());
    q.push((async () => {
      for (const p of await db.proposal.findMany({ where: { workspaceId: w, status: "draft", createdAt: { lt: new Date(+now - 3 * D) } }, include: { customer: { select: { displayName: true } } }, orderBy: { createdAt: "asc" }, take: 2 }))
        out.push({ id: `draft:${p.id}`, level: "normal", title: `The quote for ${p.customer.displayName} is still a draft`, reason: `It was started ${ago(+now - +p.createdAt)} ago and hasn't gone out. Finish the prices and send it while they're interested.`, action: { label: "Finish the quote", href: `/proposals/${p.id}` } });
    })());
    q.push((async () => {
      const open = await db.opportunity.findMany({ where: { workspaceId: w, stage: { in: ["new", "qualified", "proposal_sent", "contract_pending"] }, customer: { OR: [{ legalName: null }, { billingAddress: null }] } }, include: { customer: { select: { id: true, displayName: true, legalName: true, billingAddress: true } } }, take: 2 });
      for (const o of open) out.push({ id: `details:${o.customer.id}`, level: "normal", title: `${o.customer.displayName} needs company details`, reason: `We can't send their agreement without ${[!o.customer.legalName && "the legal name", !o.customer.billingAddress && "an address"].filter(Boolean).join(" and ")}.`, action: { label: "Add them", href: `/customers/${o.customer.id}/details` } });
    })());
    q.push((async () => {
      const rows = await db.billingIntent.findMany({ where: { workspaceId: w, status: "pending", NOT: { kind: "recurring_setup" }, OR: [{ kind: { not: "balance" }, contract: { status: "completed", completedAt: { lt: new Date(+now - 7 * D) } } }, { kind: "balance", requestedAt: { lt: new Date(+now - 3 * D) } }] }, take: 2 });   // a final payment only counts once we have asked for it
      const names = await nameMap(rows.map((r) => r.customerId));
      for (const b of rows)
        out.push({ id: `unpaid:${b.id}`, level: "normal", title: `${names.get(b.customerId) ?? "A customer"} hasn't paid the ${b.kind === "balance" ? "final payment" : "website fee"}`, reason: `${gbp(b.amountMinor)} has been due for ${b.kind === "balance" ? "a few days since we asked for it" : "over a week since they signed"}. If they're not using the portal, offer to take it over the phone or mark a bank payment.`, action: { label: "See the order", href: `/contracts/${b.contractId}` } });
    })());
  }

  if (seeProjects) {
    const where = can(ctx.role, "project.read_all") ? { workspaceId: w } : { workspaceId: w, ownerId: ctx.staffId };
    q.push((async () => {
      const due = await db.project.findMany({ where: { ...where, dueDate: { gte: new Date(+now - D), lt: new Date(+now + 8 * D) }, stage: { notIn: ["launched", "completed", "cancelled", "held"] } }, include: { customer: { select: { displayName: true } }, tasks: { where: { doneAt: null }, select: { id: true } } }, orderBy: { dueDate: "asc" }, take: 3 });
      for (const p of due) { const days = Math.ceil((+(p.dueDate as Date) - +now) / D); out.push({ id: `due:${p.id}`, level: days <= 3 ? "high" : "normal", title: days < 0 ? `“${p.name}” is overdue` : days === 0 ? `“${p.name}” is due today` : `“${p.name}” is due in ${days} ${plural(days, "day", "days")}`, reason: `It's still at ${STAGE_GUIDE[p.stage]?.label ?? p.stage} with ${p.tasks.length} ${plural(p.tasks.length, "task", "tasks")} open for ${p.customer.displayName}.`, action: { label: "Open the project", href: `/projects/${p.id}` } }); }
    })());
    q.push((async () => {
      for (const p of await db.project.findMany({ where: { ...where, stage: "awaiting_assets", updatedAt: { lt: new Date(+now - 7 * D) } }, include: { customer: { select: { displayName: true } } }, take: 2 }))
        out.push({ id: `assets:${p.id}`, level: "normal", title: `Still waiting on material from ${p.customer.displayName}`, reason: `“${p.name}” has been stuck for ${ago(+now - +p.updatedAt)}. Chase them, or move on with what you have.`, action: { label: "Open the project", href: `/projects/${p.id}` } });
    })());
    q.push((async () => {
      for (const p of await db.project.findMany({ where: { ...where, createdAt: { gt: new Date(+now - 3 * D) }, tasks: { none: {} }, stage: "planned" }, include: { customer: { select: { displayName: true } } }, take: 2 }))
        out.push({ id: `setup:${p.id}`, level: "tip", title: `${p.customer.displayName} signed. Set up the project`, reason: "Pick the project type and add the usual tasks so nothing gets missed.", action: { label: "Set it up", href: `/projects/${p.id}` } });
    })());
  }

  q.push((async () => {
    const soon = await db.calendarEvent.findFirst({ where: { workspaceId: w, status: "scheduled", startsAt: { gt: now, lt: new Date(+now + 60 * 60000) }, OR: [{ organiserId: ctx.staffId }, { attendees: { some: { staffId: ctx.staffId } } }] }, orderBy: { startsAt: "asc" } });
    if (soon) out.push({ id: `event:${soon.id}`, level: "high", title: `Coming up: ${soon.title}`, reason: `Starts in ${ago(+soon.startsAt - +now)}${soon.location ? ` · ${soon.location}` : ""}.`, action: { label: "Open calendar", href: "/calendar" } });
  })());
  if (can(ctx.role, "data.export")) q.push((async () => { if (isBackupDue(await lastExport(w))) out.push({ id: `backup:${now.toISOString().slice(0, 7)}`, level: "tip", title: "The weekly backup is due", reason: "A backup takes seconds and protects every customer record.", action: { label: "Download one", href: "/backup" } }); })());

  await Promise.all(q);
  return out.sort((a, b) => WEIGHT[a.level] - WEIGHT[b.level]).slice(0, 8);
}
