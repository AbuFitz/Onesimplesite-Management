import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { DomainError, forbidden } from "@/lib/errors";
import { can } from "./permissions";
import type { StaffCtx } from "./session";

/**
 * One-time sign-in codes for new devices, rolled out in stages so nobody is locked out by surprise:
 *   off      nobody is asked for a code (the default)
 *   testers  only the email addresses listed below
 *   team     everyone on the team
 *   everyone team and customers
 * Anyone with an authenticator app set up always uses that instead. Passkeys are separate and always optional.
 */
export const CODE_MODES = ["off", "testers", "team", "everyone"] as const;
export type CodeMode = (typeof CODE_MODES)[number];
export type SecuritySettings = { codes: CodeMode; testers: string[] };

export const securityFrom = (settings: unknown): SecuritySettings => {
  const s = (settings as { security?: Partial<SecuritySettings> } | null)?.security ?? {};
  return { codes: (CODE_MODES as readonly string[]).includes(String(s.codes)) ? (s.codes as CodeMode) : "off", testers: Array.isArray(s.testers) ? s.testers.map((e) => String(e).toLowerCase()) : [] };
};

/** Should this person be asked for an emailed code on a device we haven't verified? */
export async function needsEmailCode(email: string): Promise<boolean> {
  const e = email.trim().toLowerCase();
  const user = await db.user.findFirst({ where: { email: { equals: e, mode: "insensitive" } }, select: { id: true, twoFactors: { where: { verified: true }, select: { id: true }, take: 1 }, staffMemberships: { where: { status: "active" }, select: { workspaceId: true } }, clientMemberships: { where: { revokedAt: null }, select: { customer: { select: { workspaceId: true } } } } } });
  if (!user || user.twoFactors.length) return false; // unknown, or they use their authenticator app
  const rows = [...user.staffMemberships.map((m) => ({ ws: m.workspaceId, staff: true })), ...user.clientMemberships.map((m) => ({ ws: m.customer.workspaceId, staff: false }))];
  if (!rows.length) return false;
  const ws = await db.workspace.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.ws))] } }, select: { id: true, settings: true } });
  return rows.some((r) => {
    const sec = securityFrom(ws.find((w) => w.id === r.ws)?.settings);
    return sec.codes === "everyone" || (sec.codes === "team" && r.staff) || (sec.codes === "testers" && sec.testers.includes(e));
  });
}

/** Called just before a password sign-in: makes the account's "needs a code" flag match the current setting. People with an authenticator app are left alone. */
export async function syncCodeRequirement(email: string): Promise<boolean> {
  const need = await needsEmailCode(email);
  const u = await db.user.findFirst({ where: { email: { equals: email.trim(), mode: "insensitive" } }, select: { id: true, twoFactorEnabled: true, twoFactors: { where: { verified: true }, select: { id: true }, take: 1 } } });
  if (u && !u.twoFactors.length && u.twoFactorEnabled !== need) await db.user.update({ where: { id: u.id }, data: { twoFactorEnabled: need } });
  return need;
}

const tidyList = (raw: string) => [...new Set(raw.split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x)))].slice(0, 50);

export async function saveSecuritySettings(ctx: StaffCtx, raw: { codes: unknown; testers: unknown }) {
  if (!can(ctx.role, "settings.write")) throw forbidden();
  const codes = String(raw.codes) as CodeMode;
  if (!(CODE_MODES as readonly string[]).includes(codes)) throw new DomainError("validation", "Choose when sign-in codes are used.");
  const testers = tidyList(String(raw.testers ?? ""));
  if (codes === "testers" && !testers.length) throw new DomainError("validation", "Add at least one email address to test with.");
  await db.$transaction(async (tx) => {
    const cur = ((await tx.workspace.findUniqueOrThrow({ where: { id: ctx.workspaceId }, select: { settings: true } })).settings ?? {}) as Record<string, unknown>;
    await tx.workspace.update({ where: { id: ctx.workspaceId }, data: { settings: { ...cur, security: { codes, testers } } as never } });
    await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "settings.security_updated", targetType: "workspace", targetId: ctx.workspaceId, detail: { codes, testers: testers.length } });
  });
}
