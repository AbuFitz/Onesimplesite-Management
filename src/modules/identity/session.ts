import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { staffAuth, portalAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, type Cap } from "./permissions";

export type StaffCtx = NonNullable<Awaited<ReturnType<typeof getStaff>>>;

export async function getStaff() {
  const s = await staffAuth().api.getSession({ headers: await headers() });
  if (!s) return null;
  const m = await db.staffMembership.findFirst({ where: { userId: s.user.id, status: "active" } });
  if (!m) return null; // deactivated or never a member: no staff access
  return { userId: s.user.id, staffId: m.id, workspaceId: m.workspaceId, role: m.role, name: m.displayName, email: m.email };
}

export async function requireStaff(cap?: Cap) {
  const c = await getStaff();
  if (!c) redirect("/login");
  if (cap && !can(c.role, cap)) redirect("/denied");
  return c;
}

export async function getClient() {
  const s = await portalAuth().api.getSession({ headers: await headers() });
  if (!s) return null;
  const ms = await db.clientMembership.findMany({ where: { userId: s.user.id, revokedAt: null }, include: { customer: true } });
  if (!ms.length) return null;
  return { userId: s.user.id, name: s.user.name, memberships: ms };
}

export async function requireClient() {
  const c = await getClient();
  if (!c) redirect("/login");
  return c;
}
