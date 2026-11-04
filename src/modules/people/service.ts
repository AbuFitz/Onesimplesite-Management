import { z } from "zod";
import { db } from "@/lib/db";
import { audit, enqueue } from "@/lib/audit";
import { DomainError, forbidden, notFound } from "@/lib/errors";
import { portalLink, manageLink, origins } from "@/lib/env";
import { portalAuth } from "@/lib/auth";
import { can } from "@/modules/identity/permissions";
import type { StaffCtx } from "@/modules/identity/session";
import type { ClientCtx } from "@/modules/portal/service";
import { memberCan, levelLabel, type AccessLevel } from "@/modules/portal/access";
import { twoStepStatus } from "@/modules/identity/security";
import { tidyPhone } from "@/lib/phone";
import { inviteClientContact } from "@/modules/crm/invite";

const LEVELS = ["admin", "member", "viewer"] as const;
const write = (ctx: StaffCtx) => { if (!can(ctx.role, "customer.write")) throw forbidden(); };
const read = (ctx: StaffCtx) => { if (!can(ctx.role, "customer.read")) throw forbidden(); };
const by = (ctx: StaffCtx) => ({ userId: ctx.userId, label: ctx.name });
const lc = (e?: string | null) => (e ?? "").trim().toLowerCase();

export type Access = "none" | "invited" | "active" | "revoked";
export type Person = {
  id: string; name: string; email: string | null; phone: string | null; position: string | null; isPrimary: boolean;
  access: Access; role: AccessLevel | null; billing: boolean; userId: string | null; lastSeen: Date | null; twoStep: { authenticator: boolean; passkeys: number } | null;
};

/** Everyone at a company, with where they are on portal access. */
export async function listPeople(ctx: StaffCtx, customerId: string): Promise<Person[]> {
  read(ctx);
  const contacts = await db.contact.findMany({ where: { customerId, workspaceId: ctx.workspaceId }, orderBy: [{ isPrimary: "desc" }, { name: "asc" }] });
  const emails = contacts.map((c) => lc(c.email)).filter(Boolean);
  const [users, invites] = await Promise.all([
    emails.length ? db.user.findMany({ where: { email: { in: emails } }, select: { id: true, email: true, sessions: { orderBy: { updatedAt: "desc" }, take: 1, select: { updatedAt: true } }, clientMemberships: { where: { customerId } } } }) : [],
    db.invitation.findMany({ where: { customerId, kind: "client", acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } } }),
  ]);
  const steps = await twoStepStatus(users.map((u) => u.id));
  return contacts.map((c) => {
    const e = lc(c.email);
    const u = users.find((x) => lc(x.email) === e);
    const m = u?.clientMemberships[0];
    const inv = invites.find((i) => lc(i.email) === e);
    const access: Access = m ? (m.revokedAt ? "revoked" : "active") : inv ? "invited" : "none";
    return { id: c.id, name: c.name, email: c.email, phone: c.phone, position: c.position, isPrimary: c.isPrimary, access, role: (m?.role ?? inv?.clientRole ?? null) as AccessLevel | null, billing: m ? m.billing : !!inv?.clientBilling, userId: u?.id ?? null, lastSeen: u?.sessions[0]?.updatedAt ?? null, twoStep: u ? steps.get(u.id) ?? null : null };
  });
}

const personInput = z.object({
  name: z.string().trim().min(2, "Enter their name.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(200),
  phone: z.string().trim().max(40).optional().transform((v, ctx) => { const t = tidyPhone(v); if (t === null) { ctx.addIssue({ code: "custom", message: "That phone number doesn't look right. Check the digits." }); return null; } return t || null; }),
  position: z.string().trim().max(80).optional().transform((v) => v || null),
});
const accessInput = z.object({ role: z.enum(LEVELS).default("member"), billing: z.coerce.boolean().default(false) });

async function contactOf(ctx: StaffCtx, id: string) {
  const c = await db.contact.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!c) throw notFound("That person wasn't found.");
  return c;
}

export async function addPerson(ctx: StaffCtx, customerId: string, raw: unknown) {
  write(ctx);
  const i = personInput.parse(raw);
  if (!(await db.customer.findFirst({ where: { id: customerId, workspaceId: ctx.workspaceId }, select: { id: true } }))) throw notFound("Company not found.");
  if (await db.contact.findFirst({ where: { customerId, email: { equals: i.email, mode: "insensitive" } }, select: { id: true } })) throw new DomainError("conflict", "Someone with that email is already on this company.");
  const first = (await db.contact.count({ where: { customerId } })) === 0;
  return db.$transaction(async (tx) => {
    const c = await tx.contact.create({ data: { workspaceId: ctx.workspaceId, customerId, name: i.name, email: i.email, phone: i.phone, position: i.position, isPrimary: first } });
    await audit(tx, { workspaceId: ctx.workspaceId, actor: by(ctx), action: "person.added", targetType: "contact", targetId: c.id, customerId });
    return c;
  });
}

export async function updatePerson(ctx: StaffCtx, contactId: string, raw: unknown) {
  write(ctx);
  const c = await contactOf(ctx, contactId);
  const i = personInput.parse(raw);
  if (lc(i.email) !== lc(c.email) && (await db.contact.findFirst({ where: { customerId: c.customerId, id: { not: c.id }, email: { equals: i.email, mode: "insensitive" } }, select: { id: true } }))) throw new DomainError("conflict", "Someone else on this company already has that email.");
  const access = (await listPeople(ctx, c.customerId)).find((p) => p.id === c.id)?.access;
  if (lc(i.email) !== lc(c.email) && (access === "active" || access === "revoked")) throw new DomainError("conflict", "They already have a portal login on the old email. Remove their access, then add them again with the new email.");
  await db.$transaction(async (tx) => {
    await tx.contact.update({ where: { id: c.id }, data: i });
    await audit(tx, { workspaceId: ctx.workspaceId, actor: by(ctx), action: "person.updated", targetType: "contact", targetId: c.id, customerId: c.customerId });
  });
}

/** Who we call first. Exactly one person per company. */
export async function setPrimaryContact(ctx: StaffCtx, contactId: string) {
  write(ctx);
  const c = await contactOf(ctx, contactId);
  await db.$transaction(async (tx) => {
    await tx.contact.updateMany({ where: { customerId: c.customerId, isPrimary: true }, data: { isPrimary: false } });
    await tx.contact.update({ where: { id: c.id }, data: { isPrimary: true } });
    await audit(tx, { workspaceId: ctx.workspaceId, actor: by(ctx), action: "person.made_main_contact", targetType: "contact", targetId: c.id, customerId: c.customerId });
  });
}

/** Sends (or re-sends) the portal invitation, with the access level chosen. */
export async function invitePerson(ctx: StaffCtx, contactId: string, raw: unknown) {
  write(ctx);
  const c = await contactOf(ctx, contactId);
  const a = accessInput.parse(raw);
  const me = (await listPeople(ctx, c.customerId)).find((p) => p.id === c.id);
  // Already has a login: put access back instead of sending a link that can't create a second account.
  if (me?.access === "revoked" || me?.access === "active") return setAccess(ctx, contactId, { ...a, restore: true });
  await inviteClientContact(ctx, c.customerId, c.id, { role: a.role, billing: a.role === "admin" ? true : a.billing });
}

/** Change what someone can do. Works for people who have signed up and for invitations still waiting. */
export async function setAccess(ctx: StaffCtx, contactId: string, raw: unknown) {
  write(ctx);
  const c = await contactOf(ctx, contactId);
  const a = accessInput.extend({ restore: z.boolean().optional() }).parse(raw);
  const billing = a.role === "admin" ? true : a.billing;
  const user = c.email ? await db.user.findFirst({ where: { email: { equals: c.email, mode: "insensitive" } }, select: { id: true } }) : null;
  await db.$transaction(async (tx) => {
    const m = user ? await tx.clientMembership.findUnique({ where: { userId_customerId: { userId: user.id, customerId: c.customerId } } }) : null;
    if (m) {
      if (m.revokedAt && !a.restore) throw new DomainError("conflict", "Their access was removed. Use “Give access again” to turn it back on.");
      await tx.clientMembership.update({ where: { id: m.id }, data: { role: a.role, billing, revokedAt: null } });
    } else {
      await tx.invitation.updateMany({ where: { customerId: c.customerId, kind: "client", email: { equals: c.email ?? "", mode: "insensitive" }, acceptedAt: null, revokedAt: null }, data: { clientRole: a.role, clientBilling: billing } });
    }
    await audit(tx, { workspaceId: ctx.workspaceId, actor: by(ctx), action: "person.access_changed", targetType: "contact", targetId: c.id, customerId: c.customerId, detail: { role: a.role, billing } });
  });
}

/** Emails them a link to choose a new password. Only for people who already have a login. */
export async function sendPasswordReset(ctx: StaffCtx, contactId: string) {
  write(ctx);
  const c = await contactOf(ctx, contactId);
  const me = (await listPeople(ctx, c.customerId)).find((p) => p.id === c.id);
  if (!c.email || me?.access !== "active") throw new DomainError("conflict", "They don't have a working portal login yet. Send an invitation instead.");
  await portalAuth().api.requestPasswordReset({ body: { email: c.email, redirectTo: `${origins().portal}/reset-password` } });
  await db.$transaction((tx) => audit(tx, { workspaceId: ctx.workspaceId, actor: by(ctx), action: "person.password_reset_sent", targetType: "contact", targetId: c.id, customerId: c.customerId }));
}

/** Ends their access now: signs them out everywhere and cancels any invitation. Their record and tickets stay. */
export async function revokeAccess(ctx: StaffCtx, contactId: string) {
  write(ctx);
  const c = await contactOf(ctx, contactId);
  await db.$transaction(async (tx) => {
    await endAccess(tx, c.customerId, c.email);
    await audit(tx, { workspaceId: ctx.workspaceId, actor: by(ctx), action: "person.access_removed", targetType: "contact", targetId: c.id, customerId: c.customerId });
  });
}

/** They've left the business: remove their access and delete them from the list. Tickets they raised stay, with no name against them. */
export async function removePerson(ctx: StaffCtx, contactId: string) {
  write(ctx);
  const c = await contactOf(ctx, contactId);
  await db.$transaction(async (tx) => {
    await endAccess(tx, c.customerId, c.email);
    await tx.contact.delete({ where: { id: c.id } });
    if (c.isPrimary) { const next = await tx.contact.findFirst({ where: { customerId: c.customerId }, orderBy: { createdAt: "asc" }, select: { id: true } }); if (next) await tx.contact.update({ where: { id: next.id }, data: { isPrimary: true } }); }
    await audit(tx, { workspaceId: ctx.workspaceId, actor: by(ctx), action: "person.removed", targetType: "contact", targetId: c.id, customerId: c.customerId });
  });
}

async function endAccess(tx: Parameters<Parameters<typeof db.$transaction>[0]>[0], customerId: string, email: string | null) {
  if (!email) return;
  await tx.invitation.updateMany({ where: { customerId, kind: "client", email: { equals: email, mode: "insensitive" }, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
  const u = await tx.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });
  if (!u) return;
  await tx.clientMembership.updateMany({ where: { userId: u.id, customerId }, data: { revokedAt: new Date() } });
  // Signed out everywhere right now if this was their only company.
  if (!(await tx.clientMembership.count({ where: { userId: u.id, revokedAt: null } })) && !(await tx.staffMembership.count({ where: { userId: u.id } }))) await tx.session.deleteMany({ where: { userId: u.id } });
}

// ───────── Requests from the client portal ─────────
const requestInput = personInput.extend({
  role: z.enum(LEVELS).default("member"),
  billing: z.coerce.boolean().default(false),
  reason: z.string().trim().max(500).optional().transform((v) => v || null),
});

/** The portal list: who has access to this company, for owners only. */
export async function clientPeople(c: ClientCtx, customerId: string) {
  if (!c.memberships.some((m) => m.customerId === customerId && memberCan(m, "people"))) throw forbidden();
  const [contacts, members, pending] = await Promise.all([
    db.contact.findMany({ where: { customerId }, orderBy: [{ isPrimary: "desc" }, { name: "asc" }], select: { id: true, name: true, email: true, position: true } }),
    db.clientMembership.findMany({ where: { customerId, revokedAt: null }, include: { user: { select: { email: true } } } }),
    db.accessRequest.findMany({ where: { customerId, status: "pending" }, orderBy: { createdAt: "desc" } }),
  ]);
  return { people: contacts.map((p) => { const m = members.find((x) => lc(x.user.email) === lc(p.email)); return { ...p, userId: m?.userId ?? null, level: m ? levelLabel(m.role) : null, billing: !!m?.billing || m?.role === "admin" }; }), pending };
}

export async function clientRequestAccess(c: ClientCtx, customerId: string, raw: unknown) {
  const m = c.memberships.find((x) => x.customerId === customerId);
  if (!m || !memberCan(m, "people")) throw forbidden("Only the company owner can ask for someone to be added.");
  const i = requestInput.parse(raw);
  if (await db.contact.findFirst({ where: { customerId, email: { equals: i.email, mode: "insensitive" } }, select: { id: true } })) throw new DomainError("conflict", "That person is already on your company. Ask us if they can't sign in.");
  if (await db.accessRequest.findFirst({ where: { customerId, status: "pending", email: { equals: i.email, mode: "insensitive" } }, select: { id: true } })) throw new DomainError("conflict", "You've already asked for that person. We'll be in touch soon.");
  if ((await db.accessRequest.count({ where: { customerId, status: "pending" } })) >= 10) throw new DomainError("conflict", "You have several requests waiting. We'll deal with those first.");
  const ws = m.customer.workspaceId;
  const r = await db.$transaction(async (tx) => {
    const r = await tx.accessRequest.create({ data: { workspaceId: ws, customerId, requestedByUserId: c.userId, requestedByName: c.name ?? "A colleague", requestedByEmail: c.email ?? "", name: i.name, email: i.email, phone: i.phone, position: i.position, role: i.role, billing: i.role === "admin" ? true : i.billing, reason: i.reason } });
    await audit(tx, { workspaceId: ws, actor: { userId: c.userId, label: c.name ?? "Client" }, action: "access.requested", targetType: "access_request", targetId: r.id, customerId, detail: { role: i.role } });
    await enqueue(tx, ws, "email.access_request_notice", `access.request:${r.id}`, { to: "internal", business: m.customer.displayName, requester: c.name ?? "A colleague", name: i.name, email: i.email, level: levelLabel(i.role), billing: r.billing, reason: i.reason ?? "", link: manageLink(`/customers/${customerId}?tab=people`) });
    return r;
  });
  return r;
}

export const pendingRequests = (ctx: StaffCtx, customerId?: string) => { read(ctx); return db.accessRequest.findMany({ where: { workspaceId: ctx.workspaceId, status: "pending", ...(customerId ? { customerId } : {}) }, orderBy: { createdAt: "asc" } }); };

/** Approve: add the person (or reuse them) and send their invitation at the level asked for, or one the team changes. */
export async function approveRequest(ctx: StaffCtx, id: string, raw?: unknown) {
  write(ctx);
  const r = await db.accessRequest.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!r) throw notFound();
  if (r.status !== "pending") throw new DomainError("conflict", "This request has already been answered.");
  const a = accessInput.parse(raw ?? { role: r.role, billing: r.billing });
  let contact = await db.contact.findFirst({ where: { customerId: r.customerId, email: { equals: r.email, mode: "insensitive" } } });
  if (!contact) contact = await addPerson(ctx, r.customerId, { name: r.name, email: r.email, phone: r.phone ?? undefined, position: r.position ?? undefined });
  await invitePerson(ctx, contact.id, a);
  const cu = await db.customer.findUniqueOrThrow({ where: { id: r.customerId }, select: { displayName: true } });
  await db.$transaction(async (tx) => {
    await tx.accessRequest.update({ where: { id }, data: { status: "approved", decidedByName: ctx.name, decidedAt: new Date(), role: a.role, billing: a.role === "admin" ? true : a.billing } });
    await audit(tx, { workspaceId: ctx.workspaceId, actor: by(ctx), action: "access.approved", targetType: "access_request", targetId: id, customerId: r.customerId });
    if (r.requestedByEmail) await enqueue(tx, ctx.workspaceId, "email.access_request_decision", `access.decision:${id}`, { to: r.requestedByEmail, name: r.requestedByName, business: cu.displayName, person: r.name, approved: true, note: "", link: portalLink("/people") });
  });
}

export async function declineRequest(ctx: StaffCtx, id: string, reason?: string) {
  write(ctx);
  const r = await db.accessRequest.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!r) throw notFound();
  if (r.status !== "pending") throw new DomainError("conflict", "This request has already been answered.");
  const note = (reason ?? "").trim().slice(0, 300);
  const cu = await db.customer.findUniqueOrThrow({ where: { id: r.customerId }, select: { displayName: true } });
  await db.$transaction(async (tx) => {
    await tx.accessRequest.update({ where: { id }, data: { status: "declined", decidedByName: ctx.name, decidedAt: new Date(), declineReason: note || null } });
    await audit(tx, { workspaceId: ctx.workspaceId, actor: by(ctx), action: "access.declined", targetType: "access_request", targetId: id, customerId: r.customerId });
    if (r.requestedByEmail) await enqueue(tx, ctx.workspaceId, "email.access_request_decision", `access.decision:${id}`, { to: r.requestedByEmail, name: r.requestedByName, business: cu.displayName, person: r.name, approved: false, note, link: portalLink("/people") });
  });
}


const meInput = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(120),
  phone: personInput.shape.phone,
  position: z.string().trim().max(80).optional().transform((v) => v || null),
});
/** A customer updates their own name, phone and position. Their email is their login, so it changes through us. */
export async function updateMyDetails(c: ClientCtx, raw: unknown) {
  const i = meInput.parse(raw);
  const email = c.email ? lc(c.email) : "";
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: c.userId }, data: { name: i.name } });
    if (email) await tx.contact.updateMany({ where: { customerId: { in: c.memberships.map((m) => m.customerId) }, email: { equals: email, mode: "insensitive" } }, data: { name: i.name, phone: i.phone, position: i.position } });
  });
}
