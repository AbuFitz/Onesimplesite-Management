import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { DomainError, forbidden, notFound } from "@/lib/errors";
import { newToken } from "@/lib/tokens";
import { manageLink } from "@/lib/env";
import { can } from "./permissions";
import type { StaffCtx } from "./session";

const ROLES = ["owner", "client_director", "delivery", "sales", "support", "finance"] as const;
const inviteInput = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(120),
  email: z.email("Enter a valid email address.").transform((s) => s.toLowerCase()),
  role: z.enum(ROLES),
});

const guard = (ctx: StaffCtx) => { if (!can(ctx.role, "staff.manage")) throw forbidden(); };

export async function listTeam(ctx: StaffCtx) {
  guard(ctx);
  return db.staffMembership.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: [{ status: "asc" }, { displayName: "asc" }] });
}

async function issueInvite(tx: Parameters<Parameters<typeof db.$transaction>[0]>[0], ctx: StaffCtx, email: string, role: (typeof ROLES)[number]) {
  await tx.invitation.updateMany({ where: { workspaceId: ctx.workspaceId, kind: "staff", email, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
  const { token, hash } = newToken();
  await tx.invitation.create({ data: { workspaceId: ctx.workspaceId, kind: "staff", email, tokenHash: hash, staffRole: role, expiresAt: new Date(Date.now() + 7 * 864e5) } });
  return manageLink(`/invite/${token}`);
}

/** Invite (or re-issue the link for a pending member). The link is returned once and only its hash is stored. */
export async function inviteStaff(ctx: StaffCtx, raw: unknown) {
  guard(ctx);
  const i = inviteInput.parse(raw);
  return db.$transaction(async (tx) => {
    const existing = await tx.staffMembership.findUnique({ where: { workspaceId_email: { workspaceId: ctx.workspaceId, email: i.email } } });
    if (existing && existing.status === "active") throw new DomainError("conflict", "That person already has an active login.");
    if (existing) await tx.staffMembership.update({ where: { id: existing.id }, data: { displayName: i.name, role: i.role, status: "pending", deactivatedAt: null } });
    else await tx.staffMembership.create({ data: { workspaceId: ctx.workspaceId, email: i.email, displayName: i.name, role: i.role, status: "pending" } });
    const link = await issueInvite(tx, ctx, i.email, i.role);
    await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: existing ? "staff.reinvited" : "staff.invited", targetType: "staff", targetId: i.email, detail: { role: i.role } });
    return { link, email: i.email, name: i.name };
  });
}

async function activeOwners(tx: Parameters<Parameters<typeof db.$transaction>[0]>[0], workspaceId: string) {
  return tx.staffMembership.count({ where: { workspaceId, role: "owner", status: "active" } });
}

export async function changeRole(ctx: StaffCtx, staffId: string, role: string) {
  guard(ctx);
  const r = z.enum(ROLES).parse(role);
  await db.$transaction(async (tx) => {
    const m = await tx.staffMembership.findFirst({ where: { id: staffId, workspaceId: ctx.workspaceId } });
    if (!m) throw notFound();
    if (m.id === ctx.staffId) throw new DomainError("validation", "You can't change your own role. Ask another owner.");
    if (m.role === "owner" && r !== "owner" && m.status === "active" && (await activeOwners(tx, ctx.workspaceId)) <= 1) throw new DomainError("validation", "There must always be at least one active owner.");
    await tx.staffMembership.update({ where: { id: m.id }, data: { role: r } });
    await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "staff.role_changed", targetType: "staff", targetId: m.email, detail: { from: m.role, to: r } });
  });
}

/** Deactivating ends every session immediately; history stays attributed. */
export async function setActive(ctx: StaffCtx, staffId: string, active: boolean) {
  guard(ctx);
  await db.$transaction(async (tx) => {
    const m = await tx.staffMembership.findFirst({ where: { id: staffId, workspaceId: ctx.workspaceId } });
    if (!m) throw notFound();
    if (m.id === ctx.staffId) throw new DomainError("validation", "You can't deactivate yourself.");
    if (!active) {
      if (m.role === "owner" && m.status === "active" && (await activeOwners(tx, ctx.workspaceId)) <= 1) throw new DomainError("validation", "There must always be at least one active owner.");
      await tx.staffMembership.update({ where: { id: m.id }, data: { status: "deactivated", deactivatedAt: new Date() } });
      if (m.userId) await tx.session.deleteMany({ where: { userId: m.userId } });
    } else {
      await tx.staffMembership.update({ where: { id: m.id }, data: { status: m.userId ? "active" : "pending", deactivatedAt: null } });
    }
    await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: active ? "staff.reactivated" : "staff.deactivated", targetType: "staff", targetId: m.email });
  });
}
