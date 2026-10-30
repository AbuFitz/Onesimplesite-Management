import { z } from "zod";
import { verifyPassword } from "better-auth/crypto";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { DomainError } from "@/lib/errors";
import type { StaffCtx } from "./session";

const profileInput = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(120),
  jobTitle: z.string().trim().max(120).optional().transform((v) => v || null),
  phone: z.string().trim().max(40).optional().transform((v) => v || null),
  signature: z.string().max(1500).optional().transform((v) => v?.replace(/\r\n?/g, "\n").trim() || null),
});

/** The two things every team member is asked to set up. Phone is optional. */
export const profileMissing = (p: { jobTitle: string | null; signature: string | null }) => [!p.jobTitle && "job title", !p.signature && "email signature"].filter(Boolean) as string[];

export function suggestedSignature(p: { name: string; jobTitle?: string | null; phone?: string | null }) {
  return ["Kind regards,", p.name, p.jobTitle, "OneSimpleSite", p.phone, "onesimplesite.co.uk"].filter(Boolean).join("\n");
}

export async function updateProfile(ctx: StaffCtx, raw: unknown) {
  const i = profileInput.parse(raw);
  await db.$transaction(async (tx) => {
    await tx.staffMembership.update({ where: { id: ctx.staffId }, data: { displayName: i.name, jobTitle: i.jobTitle, phone: i.phone, signature: i.signature } });
    await tx.user.update({ where: { id: ctx.userId }, data: { name: i.name } });
    await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: i.name }, action: "staff.profile_updated", targetType: "staff", targetId: ctx.staffId });
  });
}

/** Changing the login email needs the current password. The username stays as it is. */
export async function changeOwnEmail(ctx: StaffCtx, rawEmail: string, password: string) {
  const email = z.email("Enter a valid email address.").parse(rawEmail.trim().toLowerCase());
  if (email === ctx.email) throw new DomainError("validation", "That is already your email.");
  const acct = await db.account.findFirst({ where: { userId: ctx.userId, providerId: "credential" }, select: { password: true } });
  if (!acct?.password || !(await verifyPassword({ hash: acct.password, password }))) throw new DomainError("forbidden", "Your password is incorrect.");
  const taken = (await db.user.findUnique({ where: { email }, select: { id: true } })) || (await db.staffMembership.findFirst({ where: { workspaceId: ctx.workspaceId, email }, select: { id: true } }));
  if (taken) throw new DomainError("conflict", "That email is already used by someone else.");
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: ctx.userId }, data: { email } });
    await tx.staffMembership.update({ where: { id: ctx.staffId }, data: { email } });
    await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "staff.email_changed", targetType: "staff", targetId: ctx.staffId, detail: { from: ctx.email, to: email } });
  });
}

export const getMyProfile = (ctx: StaffCtx) =>
  db.staffMembership.findUniqueOrThrow({ where: { id: ctx.staffId }, select: { displayName: true, email: true, username: true, jobTitle: true, phone: true, signature: true, role: true } });
