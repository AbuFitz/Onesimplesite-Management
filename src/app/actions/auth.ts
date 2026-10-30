"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { staffAuth, portalAuth, provisioningAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/tokens";
import { origins } from "@/lib/env";

async function isPortalHost() {
  const h = (await headers()).get("host");
  return h === new URL(origins().portal).host;
}

export async function signOutStaff() {
  await staffAuth().api.signOut({ headers: await headers() });
  redirect("/login");
}
export async function signOutPortal() {
  await portalAuth().api.signOut({ headers: await headers() });
  redirect("/login");
}

export async function login(_: unknown, fd: FormData) {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const portal = await isPortalHost();
  const auth = portal ? portalAuth() : staffAuth();
  try {
    const r = (await auth.api.signInEmail({ body: { email, password }, headers: await headers() })) as { twoFactorRedirect?: boolean };
    if (r?.twoFactorRedirect) return { mfa: true as const, error: undefined };
  } catch {
    return { error: "Email or password is incorrect." }; // same message for unknown user and bad password
  }
  redirect(portal ? "/overview" : "/");
}

export async function verifyMfa(_: unknown, fd: FormData) {
  try {
    await staffAuth().api.verifyTOTP({ body: { code: String(fd.get("code") ?? "") }, headers: await headers() });
  } catch {
    return { error: "That code did not work." };
  }
  redirect("/");
}

/** Accept an invitation: validates hashed single-use token, creates the user, links membership. */
export async function acceptInvitation(_: unknown, fd: FormData) {
  const token = String(fd.get("token") ?? "");
  const name = String(fd.get("name") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  if (!name || password.length < 12) return { error: "Enter your name and a password of at least 12 characters." };
  const inv = await db.invitation.findUnique({ where: { tokenHash: sha256(token) } });
  if (!inv || inv.acceptedAt || inv.revokedAt || inv.expiresAt <= new Date()) return { error: "This invitation has expired or was already used. Ask for a new one." };
  const claimed = await db.invitation.updateMany({ where: { id: inv.id, acceptedAt: null }, data: { acceptedAt: new Date() } });
  if (claimed.count === 0) return { error: "This invitation was already used." };
  try {
    const res = await provisioningAuth().api.signUpEmail({ body: { email: inv.email, password, name } });
    if (inv.kind === "staff") {
      await db.staffMembership.updateMany({ where: { workspaceId: inv.workspaceId, email: inv.email }, data: { userId: res.user.id, status: "active" } });
    } else if (inv.customerId) {
      await db.clientMembership.upsert({
        where: { userId_customerId: { userId: res.user.id, customerId: inv.customerId } },
        create: { userId: res.user.id, customerId: inv.customerId, role: inv.clientRole ?? "member" }, update: { revokedAt: null },
      });
    }
  } catch {
    await db.invitation.update({ where: { id: inv.id }, data: { acceptedAt: null } });
    return { error: "Could not create the account. If you already have one, sign in instead." };
  }
  redirect("/login");
}
