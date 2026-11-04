"use server";
import { reportProblem } from "@/lib/problems";
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
  let email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const portal = await isPortalHost();
  // Staff can sign in with first.surname as well as their email. Customers always use email.
  if (!portal && !email.includes("@")) {
    const m = await db.staffMembership.findFirst({ where: { username: email, status: "active" }, select: { email: true } });
    email = m?.email ?? "";
  }
  const auth = portal ? portalAuth() : staffAuth();
  try {
    const remember = fd.get("remember") === "on";
    const r = (await auth.api.signInEmail({ body: { email, password, rememberMe: remember }, headers: await headers() })) as { twoFactorRedirect?: boolean };
    if (r?.twoFactorRedirect) return { mfa: true as const, error: undefined };
  } catch {
    return { error: portal ? "Email or password is incorrect." : "Username, email or password is incorrect." }; // same message for unknown user and bad password
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
  let name = String(fd.get("name") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  if (password.length < 12) return { error: "Use a password of at least 12 characters." };
  const inv = await db.invitation.findUnique({ where: { tokenHash: sha256(token) } });
  // Staff were named by whoever invited them, so they are not asked again.
  if (inv?.kind === "staff") name = (await db.staffMembership.findFirst({ where: { workspaceId: inv.workspaceId, email: inv.email }, select: { displayName: true } }))?.displayName ?? name;
  if (!name) return { error: "Enter your name." };
  if (!inv || inv.acceptedAt || inv.revokedAt || inv.expiresAt <= new Date()) return { error: "This invitation has expired or was already used. Ask for a new one." };
  // They already have a login (a team member testing, or a customer of another company): add this company to it. Their password is never changed here.
  if (inv.kind === "client" && inv.customerId && (await db.user.findFirst({ where: { email: { equals: inv.email, mode: "insensitive" } }, select: { id: true } }))) return addToExistingLogin(inv.id);
  const claimed = await db.invitation.updateMany({ where: { id: inv.id, acceptedAt: null }, data: { acceptedAt: new Date() } });
  if (claimed.count === 0) return { error: "This invitation was already used." };
  try {
    const res = await provisioningAuth().api.signUpEmail({ body: { email: inv.email, password, name } });
    if (inv.kind === "staff") {
      await db.staffMembership.updateMany({ where: { workspaceId: inv.workspaceId, email: inv.email }, data: { userId: res.user.id, status: "active" } });
    } else if (inv.customerId) {
      await db.clientMembership.upsert({
        where: { userId_customerId: { userId: res.user.id, customerId: inv.customerId } },
        create: { userId: res.user.id, customerId: inv.customerId, role: inv.clientRole ?? "member", billing: inv.clientBilling }, update: { revokedAt: null, role: inv.clientRole ?? "member", billing: inv.clientBilling },
      });
    }
  } catch (e) {
    await reportProblem({ workspaceId: inv.workspaceId, area: "invite_accept", error: e, customerId: inv.customerId, ref: inv.email });
    await db.invitation.update({ where: { id: inv.id }, data: { acceptedAt: null } });
    return { error: "We couldn't create your account just now. Please try again, or ask for a new invitation if it keeps happening." };
  }
  redirect("/login");
}

async function addToExistingLogin(invitationId: string): Promise<{ error?: string }> {
  const inv = await db.invitation.findUnique({ where: { id: invitationId } });
  if (!inv?.customerId || inv.acceptedAt || inv.revokedAt || inv.expiresAt <= new Date()) return { error: "This invitation has expired or was already used. Ask for a new one." };
  const user = await db.user.findFirst({ where: { email: { equals: inv.email, mode: "insensitive" } }, select: { id: true } });
  if (!user) return { error: "We couldn't find that login. Please try again." };
  await db.$transaction(async (tx) => {
    await tx.invitation.update({ where: { id: inv.id }, data: { acceptedAt: new Date() } });
    await tx.clientMembership.upsert({
      where: { userId_customerId: { userId: user.id, customerId: inv.customerId! } },
      create: { userId: user.id, customerId: inv.customerId!, role: inv.clientRole ?? "member", billing: inv.clientBilling }, update: { revokedAt: null, role: inv.clientRole ?? "member", billing: inv.clientBilling },
    });
  });
  redirect("/login?added=1");
}

/** For someone who already has a login: the invitation page's one button. */
export async function acceptExistingInvitation(fd: FormData) {
  const inv = await db.invitation.findUnique({ where: { tokenHash: sha256(String(fd.get("token") ?? "")) } });
  const r = inv ? await addToExistingLogin(inv.id) : { error: "This invitation has expired or was already used. Ask for a new one." };
  redirect(`/login?error=${encodeURIComponent(r.error ?? "")}`);
}

const hostAuth = async () => ((await isPortalHost()) ? portalAuth() : staffAuth());

/** Logged-in self-service: change own password; other sessions are signed out. */
export async function changePassword(_: unknown, fd: FormData): Promise<{ error?: string; done?: boolean }> {
  const currentPassword = String(fd.get("current") ?? "");
  const newPassword = String(fd.get("next") ?? "");
  if (newPassword.length < 12) return { error: "Use at least 12 characters." };
  if (newPassword !== String(fd.get("confirm") ?? "")) return { error: "The two new passwords don't match." };
  try {
    await (await hostAuth()).api.changePassword({ body: { currentPassword, newPassword, revokeOtherSessions: true }, headers: await headers() });
  } catch {
    return { error: "Your current password is incorrect." };
  }
  return { done: true };
}

/** Same response whether or not the address exists, so this can't be used to find accounts. */
export async function requestReset(_: unknown, fd: FormData): Promise<{ error?: string; sent?: boolean }> {
  if (process.env.APP_ENV === "production" && !process.env.RESEND_API_KEY) {
    return { error: "Email sending isn't connected yet, so we can't send reset links. Ask an owner to set you up with a new login." };
  }
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const origin = (await isPortalHost()) ? origins().portal : origins().manage;
  try {
    await (await hostAuth()).api.requestPasswordReset({ body: { email, redirectTo: `${origin}/reset-password` } });
  } catch { /* deliberately silent */ }
  return { sent: true };
}

export async function resetPassword(_: unknown, fd: FormData): Promise<{ error?: string; done?: boolean }> {
  const newPassword = String(fd.get("next") ?? "");
  if (newPassword.length < 12) return { error: "Use at least 12 characters." };
  if (newPassword !== String(fd.get("confirm") ?? "")) return { error: "The two passwords don't match." };
  try {
    await (await hostAuth()).api.resetPassword({ body: { newPassword, token: String(fd.get("token") ?? "") } });
  } catch {
    return { error: "This reset link has expired or was already used. Request a new one." };
  }
  return { done: true };
}
