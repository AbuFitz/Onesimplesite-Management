import { db } from "@/lib/db";
import { audit, enqueue } from "@/lib/audit";
import { manageLink, portalLink } from "@/lib/env";
import { can } from "@/modules/identity/permissions";
import { forbidden } from "@/lib/errors";
import type { StaffCtx } from "@/modules/identity/session";

export type Audience = "team" | "customers" | "everyone";
/** One notice per rollout. Re-sending is safe: each person has one queue entry per key, so nobody gets it twice. */
export const ROLLOUT_KEY = "rollout-2026-11";

type Person = { email: string; name: string; audience: "team" | "customer" };

/** Everyone who can sign in today: active team members, and customers whose portal access has not been removed. */
export async function announcementRecipients(ctx: StaffCtx, audience: Audience): Promise<Person[]> {
  if (!can(ctx.role, "settings.write")) throw forbidden();
  const out = new Map<string, Person>();
  if (audience !== "customers") {
    const staff = await db.staffMembership.findMany({ where: { workspaceId: ctx.workspaceId, status: "active", deactivatedAt: null }, select: { email: true, displayName: true } });
    for (const s of staff) out.set(s.email.toLowerCase(), { email: s.email, name: s.displayName.split(" ")[0] || s.displayName, audience: "team" });
  }
  if (audience !== "team") {
    const users = await db.user.findMany({ where: { clientMemberships: { some: { revokedAt: null, customer: { workspaceId: ctx.workspaceId, archivedAt: null } } } }, select: { email: true, name: true } });
    for (const u of users) if (!out.has(u.email.toLowerCase())) out.set(u.email.toLowerCase(), { email: u.email, name: u.name.split(" ")[0] || u.name, audience: "customer" });
  }
  return [...out.values()];
}

export async function queueAnnouncement(ctx: StaffCtx, audience: Audience) {
  const people = await announcementRecipients(ctx, audience);
  for (const p of people) {
    await enqueue(db as never, ctx.workspaceId, "email.announcement", `announce:${ROLLOUT_KEY}:${p.email.toLowerCase()}`, { to: p.email, name: p.name, audience: p.audience, link: p.audience === "team" ? manageLink("/login") : portalLink("/login") });
  }
  await audit(db as never, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "announcement.queued", targetType: "workspace", targetId: ctx.workspaceId, detail: { audience, count: people.length, key: ROLLOUT_KEY } });
  return people.length;
}
