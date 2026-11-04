import { z } from "zod";
import { db } from "@/lib/db";
import { audit, enqueue, nextRef } from "@/lib/audit";
import { DomainError, forbidden, notFound } from "@/lib/errors";
import { portalLink, manageLink } from "@/lib/env";
import { can } from "@/modules/identity/permissions";
import type { StaffCtx } from "@/modules/identity/session";
import type { ClientCtx } from "@/modules/portal/service";
import { personFrom } from "@/lib/sender-identities";
import { memberCan } from "@/modules/portal/access";
import { saveUploads, type Upload } from "@/modules/files/service";

import { TICKET_KINDS, URGENCY } from "./options";
export { TICKET_KINDS, URGENCY };

export const STATUSES = ["open", "in_progress", "waiting_customer", "customer_replied", "resolved", "closed"] as const;
export const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
const KIND_IDS = TICKET_KINDS.map((k) => k.id) as [string, ...string[]];

const createInput = z.object({
  kind: z.enum(KIND_IDS).default("issue"),
  title: z.string().trim().min(3, "Give it a short title.").max(140),
  body: z.string().trim().min(5, "Tell us a little more so we can help.").max(8000),
  urgency: z.enum(["urgent", "high", "normal", "low"]).default("normal"),
  projectId: z.string().uuid().optional().or(z.literal("")).transform((v) => v || undefined),
});

const MAX_PER_HOUR = 8;
const clean = (t: string) => t.replace(/\r\n?/g, "\n").trim();
const excerpt = (t: string, n = 280) => (t.length > n ? `${t.slice(0, n).trimEnd()}…` : t);

// ───────── People: every ticket belongs to a person at the company ─────────
/** The contact for a signed-in client, found by email. Created on the spot if the team never added them. */
async function contactFor(tx: Pick<typeof db, "contact">, workspaceId: string, customerId: string, name: string, email: string) {
  const found = await tx.contact.findFirst({ where: { workspaceId, customerId, email: { equals: email, mode: "insensitive" } } });
  return found ?? tx.contact.create({ data: { workspaceId, customerId, name: name || email, email: email.toLowerCase(), isPrimary: false } });
}

// ───────── Client side (the portal) ─────────
export async function clientCreateTicket(c: ClientCtx, customerId: string | undefined, raw: unknown, files: Upload[] = []) {
  const m = c.memberships.find((x) => x.customerId === (customerId ?? c.memberships[0]?.customerId));
  if (!m || !c.email) throw forbidden();
  if (!memberCan(m, "tickets")) throw new DomainError("forbidden", "Your access is view only. Ask the company owner to raise this, or to change your access.");
  const i = createInput.parse(raw);
  const urgency = URGENCY.find((u) => u.id === i.urgency)!;
  return db.$transaction(async (tx) => {
    const ws = m.customer.workspaceId;
    const person = await contactFor(tx, ws, m.customerId, c.name ?? "", c.email!);
    const recent = await tx.ticket.count({ where: { workspaceId: ws, contactId: person.id, source: "portal", createdAt: { gte: new Date(Date.now() - 3_600_000) } } });
    if (recent >= MAX_PER_HOUR) throw new DomainError("conflict", "You've raised a lot of tickets in the last hour. Please add to one you already have, or email support@onesimplesite.co.uk.");
    if (i.projectId && !(await tx.project.findFirst({ where: { id: i.projectId, customerId: m.customerId, workspaceId: ws }, select: { id: true } }))) throw new DomainError("validation", "Pick one of your own projects, or leave it blank.");
    const reference = await nextRef(tx, ws, "ticket");
    const t = await tx.ticket.create({ data: { workspaceId: ws, customerId: m.customerId, contactId: person.id, projectId: i.projectId, reference, kind: i.kind, title: i.title, body: clean(i.body), priority: urgency.priority, source: "portal", lastCustomerAt: new Date() } });
    await saveUploads(tx, { workspaceId: ws, customerId: m.customerId, ticketId: t.id, internal: false, by: "client", name: person.name }, files);
    await audit(tx, { workspaceId: ws, actor: { userId: c.userId, label: person.name }, action: "ticket.created", targetType: "ticket", targetId: t.id, customerId: m.customerId, detail: { source: "portal", priority: urgency.priority, files: files.length } });
    await enqueue(tx, ws, "email.ticket_received", `ticket.received:${t.id}`, { to: person.email, name: person.name, ref: reference, title: i.title, expect: urgency.expect, link: portalLink(`/help/${t.id}`) });
    await enqueue(tx, ws, "email.ticket_notice", `ticket.notice:${t.id}`, { to: "internal", ref: reference, title: i.title, business: m.customer.displayName, person: person.name, priority: urgency.priority, excerpt: excerpt(clean(i.body)), link: manageLink(`/support/${t.id}`) });
    return t;
  });
}

const clientScope = (c: ClientCtx) => ({ customerId: { in: c.memberships.map((m) => m.customerId) } });

export const clientTickets = (c: ClientCtx) =>
  db.ticket.findMany({ where: clientScope(c), orderBy: { updatedAt: "desc" }, take: 100, select: { id: true, reference: true, title: true, status: true, priority: true, kind: true, updatedAt: true, createdAt: true, contact: { select: { name: true, email: true } }, customer: { select: { displayName: true } } } });

/** A ticket and its public conversation. Internal notes never leave the building. */
export async function clientTicket(c: ClientCtx, id: string) {
  const t = await db.ticket.findFirst({ where: { id, ...clientScope(c) }, include: { project: { select: { name: true } }, contact: { select: { name: true } }, comments: { where: { internal: false }, orderBy: { createdAt: "asc" }, select: { id: true, authorKind: true, authorName: true, authorStaffId: true, authorUserId: true, body: true, createdAt: true } } } });
  return t;
}

export async function clientReply(c: ClientCtx, id: string, body: unknown, files: Upload[] = []) {
  const text = z.string().trim().min(1, "Write a message first.").max(8000).parse(body);
  const t = await db.ticket.findFirst({ where: { id, ...clientScope(c) }, include: { customer: { select: { displayName: true } }, contact: { select: { name: true } } } });
  if (!t) throw notFound();
  if (!c.memberships.some((m) => m.customerId === t.customerId && memberCan(m, "tickets"))) throw new DomainError("forbidden", "Your access is view only, so you can't reply.");
  if (t.status === "closed") throw new DomainError("conflict", "This ticket is closed. Please raise a new one.");
  const name = c.name || t.contact?.name || "Customer";
  await db.$transaction(async (tx) => {
    const cm = await tx.ticketComment.create({ data: { workspaceId: t.workspaceId, ticketId: t.id, authorKind: "client", authorName: name, authorUserId: c.userId, body: clean(text) } });
    await saveUploads(tx, { workspaceId: t.workspaceId, customerId: t.customerId, ticketId: t.id, commentId: cm.id, internal: false, by: "client", name }, files);
    // A reply brings a resolved or waiting ticket back to the team.
    await tx.ticket.update({ where: { id: t.id }, data: { status: "customer_replied", resolvedAt: null, lastCustomerAt: new Date() } });
    await enqueue(tx, t.workspaceId, "email.ticket_notice", `ticket.reply:${t.id}:${Date.now()}`, { to: "internal", ref: t.reference, title: t.title, business: t.customer.displayName, person: name, priority: t.priority, excerpt: excerpt(clean(text)), link: manageLink(`/support/${t.id}`), isReply: true });
  });
}

export async function clientResolve(c: ClientCtx, id: string) {
  const t = await db.ticket.findFirst({ where: { id, ...clientScope(c) }, select: { id: true, status: true } });
  if (!t) throw notFound();
  if (t.status === "closed") return;
  await db.ticket.update({ where: { id }, data: { status: "resolved", resolvedAt: new Date() } });
}

// ───────── Team side ─────────
const need = (ctx: StaffCtx) => { if (!can(ctx.role, "customer.read")) throw forbidden(); };

const staffCreate = z.object({
  customerId: z.string().uuid("Pick the account."),
  contactId: z.string().uuid().optional().or(z.literal("")).transform((v) => v || undefined),
  kind: z.enum(KIND_IDS).default("issue"),
  category: z.enum(["support", "change_request"]).default("support"),
  title: z.string().trim().min(3, "Give it a short title.").max(140),
  body: z.string().trim().min(3, "Say what it is about.").max(8000),
  priority: z.enum(PRIORITIES).default("normal"),
  projectId: z.string().uuid().optional().or(z.literal("")).transform((v) => v || undefined),
  assigneeId: z.string().uuid().optional().or(z.literal("")).transform((v) => v || undefined),
});

/** A ticket the team raises for a customer, for whoever got in touch. */
export async function staffCreateTicket(ctx: StaffCtx, raw: unknown) {
  need(ctx);
  const i = staffCreate.parse(raw);
  return db.$transaction(async (tx) => {
    const customer = await tx.customer.findFirst({ where: { id: i.customerId, workspaceId: ctx.workspaceId }, select: { id: true } });
    if (!customer) throw notFound("Account not found.");
    const person = i.contactId ? await tx.contact.findFirst({ where: { id: i.contactId, customerId: customer.id, workspaceId: ctx.workspaceId } }) : null;
    if (i.contactId && !person) throw new DomainError("validation", "That person isn't on this account.");
    if (i.projectId && !(await tx.project.findFirst({ where: { id: i.projectId, customerId: customer.id }, select: { id: true } }))) throw new DomainError("validation", "That project isn't on this account.");
    const assignee = i.assigneeId ? await tx.staffMembership.findFirst({ where: { id: i.assigneeId, workspaceId: ctx.workspaceId, status: "active" }, select: { id: true } }) : null;
    const reference = await nextRef(tx, ctx.workspaceId, "ticket");
    const t = await tx.ticket.create({ data: { workspaceId: ctx.workspaceId, customerId: customer.id, contactId: person?.id, projectId: i.projectId, reference, kind: i.kind, category: i.category, title: i.title, body: clean(i.body), priority: i.priority, source: "staff", lastStaffAt: new Date(), assigneeId: assignee?.id ?? ctx.staffId } });
    await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "ticket.created", targetType: "ticket", targetId: t.id, customerId: customer.id, detail: { source: "staff" } });
    return t;
  });
}

export type SupportFilter = "open" | "waiting" | "resolved" | "all" | "mine";
export async function listSupportTickets(ctx: StaffCtx, o: { filter?: SupportFilter; q?: string } = {}) {
  need(ctx);
  const f = o.filter ?? "open";
  const status = f === "open" ? { in: ["open", "in_progress", "customer_replied"] } : f === "waiting" ? { in: ["waiting_customer"] } : f === "resolved" ? { in: ["resolved", "closed"] } : undefined;
  const q = o.q?.trim();
  return db.ticket.findMany({
    where: { workspaceId: ctx.workspaceId, ...(status ? { status } : {}), ...(f === "mine" ? { assigneeId: ctx.staffId, status: { in: ["open", "in_progress", "customer_replied", "waiting_customer"] } } : {}), ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { reference: { contains: q, mode: "insensitive" } }, { customer: { displayName: { contains: q, mode: "insensitive" } } }] } : {}) },
    include: { customer: { select: { displayName: true } }, contact: { select: { name: true, position: true } } },
    orderBy: [{ updatedAt: "desc" }], take: 100,
  });
}

export async function getSupportTicket(ctx: StaffCtx, id: string) {
  need(ctx);
  const t = await db.ticket.findFirst({ where: { id, workspaceId: ctx.workspaceId }, include: { customer: { select: { id: true, displayName: true } }, contact: true, project: { select: { id: true, name: true } }, comments: { orderBy: { createdAt: "asc" } } } });
  if (!t) return null;
  const assignee = t.assigneeId ? await db.staffMembership.findUnique({ where: { id: t.assigneeId }, select: { id: true, displayName: true } }) : null;
  return { ...t, assignee };
}

const replyInput = z.object({ body: z.string().trim().min(1, "Write a reply first.").max(8000), internal: z.boolean().default(false), filesInternal: z.boolean().default(false) });

/** Reply as the person at the keyboard. Customers see "Abukar at OneSimpleSite" from abukar@, never a login address. */
export async function staffReply(ctx: StaffCtx, id: string, raw: unknown, files: Upload[] = []) {
  need(ctx);
  const i = replyInput.parse(raw);
  const t = await db.ticket.findFirst({ where: { id, workspaceId: ctx.workspaceId }, include: { contact: true } });
  if (!t) throw notFound();
  const me = await db.staffMembership.findUniqueOrThrow({ where: { id: ctx.staffId }, select: { displayName: true, aliasEmail: true } });
  await db.$transaction(async (tx) => {
    const cm = await tx.ticketComment.create({ data: { workspaceId: ctx.workspaceId, ticketId: t.id, authorKind: "staff", authorName: me.displayName, authorStaffId: ctx.staffId, body: clean(i.body), internal: i.internal } });
    await saveUploads(tx, { workspaceId: ctx.workspaceId, customerId: t.customerId, ticketId: t.id, commentId: cm.id, internal: i.internal || i.filesInternal, by: "staff", name: me.displayName }, files);
    if (i.internal) { await tx.ticket.update({ where: { id: t.id }, data: { updatedAt: new Date() } }); return; }
    await tx.ticket.update({ where: { id: t.id }, data: { status: t.status === "resolved" || t.status === "closed" ? t.status : "waiting_customer", assigneeId: t.assigneeId ?? ctx.staffId, lastStaffAt: new Date() } });
    if (t.contact?.email) {
      await enqueue(tx, ctx.workspaceId, "email.ticket_reply", `ticket.reply:${t.id}:${Date.now()}`, {
        to: t.contact.email, name: t.contact.name, staffName: me.displayName, ref: t.reference, title: t.title, message: clean(i.body), link: portalLink(`/help/${t.id}`),
        fromPerson: personFrom(me.displayName, me.aliasEmail), ...(me.aliasEmail ? { replyTo: me.aliasEmail } : {}),
      });
    }
  });
  return { emailed: !i.internal && !!t.contact?.email };
}

const updateInput = z.object({ status: z.enum(STATUSES).optional(), priority: z.enum(PRIORITIES).optional(), assigneeId: z.string().uuid().nullable().optional() });
export async function updateSupportTicket(ctx: StaffCtx, id: string, raw: unknown) {
  need(ctx);
  const i = updateInput.parse(raw);
  const t = await db.ticket.findFirst({ where: { id, workspaceId: ctx.workspaceId }, select: { id: true } });
  if (!t) throw notFound();
  if (i.assigneeId && !(await db.staffMembership.findFirst({ where: { id: i.assigneeId, workspaceId: ctx.workspaceId, status: "active" }, select: { id: true } }))) throw new DomainError("validation", "Pick someone on the team.");
  const before = await db.ticket.findUniqueOrThrow({ where: { id }, include: { contact: { select: { name: true, email: true } } } });
  await db.$transaction(async (tx) => {
    if (i.status === "resolved" && before.status !== "resolved" && before.contact?.email) await enqueue(tx, ctx.workspaceId, "email.ticket_resolved", `ticket.resolved:${id}:${Date.now()}`, { to: before.contact.email, name: before.contact.name, ref: before.reference, title: before.title, link: portalLink(`/help/${id}`) });
    await tx.ticket.update({ where: { id }, data: { ...(i.status ? { status: i.status, resolvedAt: i.status === "resolved" || i.status === "closed" ? new Date() : null } : {}), ...(i.priority ? { priority: i.priority } : {}), ...(i.assigneeId !== undefined ? { assigneeId: i.assigneeId } : {}) } });
    await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "ticket.updated", targetType: "ticket", targetId: id, detail: i });
  });
}

export async function supportCounts(workspaceId: string) {
  const [open, waiting] = await Promise.all([
    db.ticket.count({ where: { workspaceId, status: { in: ["open", "in_progress", "customer_replied"] } } }),
    db.ticket.count({ where: { workspaceId, status: "waiting_customer" } }),
  ]);
  return { open, waiting };
}
