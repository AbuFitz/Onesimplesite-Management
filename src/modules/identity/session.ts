import { headers, cookies } from "next/headers";
import { after } from "next/server";
import { safeNext } from "@/lib/next-path";
import { redirect } from "next/navigation";
import { staffAuth, portalAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, type Cap } from "./permissions";
import { mustSetUpTwoStep, noteDevice } from "./security";

export type StaffCtx = NonNullable<Awaited<ReturnType<typeof getStaff>>>;

async function staffSession() {
  const h = await headers();
  const s = await staffAuth().api.getSession({ headers: h });
  if (!s) return null;
  const m = await db.staffMembership.findFirst({ where: { userId: s.user.id, status: "active" } });
  if (!m) return null; // deactivated or never a member: no staff access
  const ctx = { userId: s.user.id, staffId: m.id, workspaceId: m.workspaceId, role: m.role, name: m.displayName, email: m.email };
  const pending = await mustSetUpTwoStep(s.user.id, s.user.email, [{ workspaceId: m.workspaceId, staff: true }]);
  if (!pending) { const did = (await cookies()).get("oss_did")?.value, ua = h.get("user-agent") ?? ""; try { after(() => noteDevice({ userId: s.user.id, email: s.user.email, name: m.displayName }, s.session.createdAt, did, ua).catch(() => {})); } catch { /* outside a request */ } }
  return { ctx, pending };
}

/** The signed-in team member, or null. Someone who still has to set up two-step sign-in counts as not signed in everywhere except the setup page. */
export async function getStaff() {
  const r = await staffSession();
  return r && !r.pending ? r.ctx : null;
}
/** For the guided setup page only: a signed-in person who is still required to set up two-step sign-in. */
export async function getStaffNeedingSetup() { const r = await staffSession(); return r?.pending ? r.ctx : null; }

async function loginUrl() {
  const n = safeNext((await headers()).get("x-next-path"));
  return n && n !== "/" ? `/login?next=${encodeURIComponent(n)}` : "/login";
}

export async function requireStaff(cap?: Cap) {
  const c = await getStaff();
  if (!c) redirect((await getStaffNeedingSetup()) ? "/setup-security" : await loginUrl());
  if (cap && !can(c.role, cap)) redirect("/denied");
  return c;
}

async function clientSession() {
  const h = await headers();
  const s = await portalAuth().api.getSession({ headers: h });
  if (!s) return null;
  const ms = await db.clientMembership.findMany({ where: { userId: s.user.id, revokedAt: null }, include: { customer: true } });
  if (!ms.length) return null;
  const ctx = { userId: s.user.id, name: s.user.name, email: s.user.email, memberships: ms };
  const pending = await mustSetUpTwoStep(s.user.id, s.user.email, ms.map((m) => ({ workspaceId: m.customer.workspaceId, staff: false })));
  if (!pending) { const did = (await cookies()).get("oss_did")?.value, ua = h.get("user-agent") ?? ""; try { after(() => noteDevice({ userId: s.user.id, email: s.user.email, name: s.user.name }, s.session.createdAt, did, ua).catch(() => {})); } catch { /* outside a request */ } }
  return { ctx, pending };
}
export async function getClient() { const r = await clientSession(); return r && !r.pending ? r.ctx : null; }
export async function getClientNeedingSetup() { const r = await clientSession(); return r?.pending ? r.ctx : null; }

export async function requireClient() {
  const c = await getClient();
  if (!c) redirect((await getClientNeedingSetup()) ? "/setup-security" : await loginUrl());
  return c;
}
