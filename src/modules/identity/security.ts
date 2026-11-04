import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { DomainError, forbidden, notFound } from "@/lib/errors";
import { can } from "./permissions";
import type { StaffCtx } from "./session";

/**
 * Two-step sign-in with an authenticator app, rolled out in stages so nobody is locked out by surprise:
 *   off      nobody is required to (the default)
 *   testers  only the email addresses listed in settings
 *   team     everyone on the team
 *   everyone team and customers
 * Someone who is required to, and hasn't set it up, is taken to a short guided setup straight after their password.
 * Passkeys are an optional extra that skips typing a code. Support can reset anyone's two-step sign-in.
 */
export const CODE_MODES = ["off", "testers", "team", "everyone"] as const;
export type CodeMode = (typeof CODE_MODES)[number];
export type SecuritySettings = { codes: CodeMode; testers: string[] };

export const securityFrom = (settings: unknown): SecuritySettings => {
  const s = (settings as { security?: Partial<SecuritySettings> } | null)?.security ?? {};
  return { codes: (CODE_MODES as readonly string[]).includes(String(s.codes)) ? (s.codes as CodeMode) : "off", testers: Array.isArray(s.testers) ? s.testers.map((e) => String(e).toLowerCase()) : [] };
};

// The setting is read on almost every request, so it is remembered for a few seconds instead of asked from the database each time.
const cache = new Map<string, { at: number; sec: SecuritySettings }>();
export const forgetSecurityCache = () => cache.clear();
async function securityOf(workspaceIds: string[]): Promise<SecuritySettings[]> {
  const now = Date.now(), miss = workspaceIds.filter((id) => !(cache.get(id) && now - cache.get(id)!.at < 5_000));
  if (miss.length) for (const w of await db.workspace.findMany({ where: { id: { in: miss } }, select: { id: true, settings: true } })) cache.set(w.id, { at: now, sec: securityFrom(w.settings) });
  return workspaceIds.map((id) => cache.get(id)?.sec ?? securityFrom(null));
}

/** Is this person required to use two-step sign-in under the current setting? */
export async function twoStepRequired(email: string, areas: { workspaceId: string; staff: boolean }[]): Promise<boolean> {
  if (!areas.length) return false;
  const e = email.trim().toLowerCase();
  const secs = await securityOf([...new Set(areas.map((a) => a.workspaceId))]);
  const by = new Map([...new Set(areas.map((a) => a.workspaceId))].map((id, i) => [id, secs[i]]));
  return areas.some((a) => { const sec = by.get(a.workspaceId)!; return sec.codes === "everyone" || (sec.codes === "team" && a.staff) || (sec.codes === "testers" && sec.testers.includes(e)); });
}
export const hasAuthenticator = async (userId: string) => (await db.twoFactor.count({ where: { userId, verified: true } })) > 0;

/** True when they must set up two-step sign-in before using the app. One cheap lookup, and none at all while the setting is off. */
export async function mustSetUpTwoStep(userId: string, email: string, areas: { workspaceId: string; staff: boolean }[]) {
  return (await twoStepRequired(email, areas)) && !(await hasAuthenticator(userId));
}

const tidyList = (raw: string) => [...new Set(raw.split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x)))].slice(0, 50);

export async function saveSecuritySettings(ctx: StaffCtx, raw: { codes: unknown; testers: unknown }) {
  if (!can(ctx.role, "settings.write")) throw forbidden();
  const codes = String(raw.codes) as CodeMode;
  if (!(CODE_MODES as readonly string[]).includes(codes)) throw new DomainError("validation", "Choose when sign-in codes are used.");
  const testers = tidyList(String(raw.testers ?? ""));
  if (codes === "testers" && !testers.length) throw new DomainError("validation", "Add at least one email address to test with.");
  forgetSecurityCache();
  await db.$transaction(async (tx) => {
    const cur = ((await tx.workspace.findUniqueOrThrow({ where: { id: ctx.workspaceId }, select: { settings: true } })).settings ?? {}) as Record<string, unknown>;
    await tx.workspace.update({ where: { id: ctx.workspaceId }, data: { settings: { ...cur, security: { codes, testers } } as never } });
    await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "settings.security_updated", targetType: "workspace", targetId: ctx.workspaceId, detail: { codes, testers: testers.length } });
  });
}


/* ───────── Support: reset someone's two-step sign-in ───────── */
const label = (ua: string) => {
  const b = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "a browser";
  const o = /iPhone|iPad/.test(ua) ? "iPhone or iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "a Mac" : /Linux/.test(ua) ? "Linux" : "a device";
  return `${b} on ${o}`;
};
export const deviceLabel = label;

async function sendSecurityNotice(to: string, name: string, headline: string, detail: string) {
  try {
    const { renderEmail } = await import("@/emails/templates");
    const { sendMail } = await import("@/lib/mail");
    const { fmtFrom } = await import("@/lib/sender-identities");
    const when = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/London" }).format(new Date());
    const r = await renderEmail("security_notice", { to, name, headline, detail, when });
    await sendMail({ from: fmtFrom("noreply"), to, subject: r.subject, html: r.html, text: r.text });
  } catch { /* a notice must never block the thing it is about */ }
}

/**
 * Notes the browser a signed-in person is using. If it is one we have not seen before (and they have signed in elsewhere before), they get a "new sign-in" email.
 * Only looks at sessions created in the last 10 minutes, so ordinary page loads cost nothing.
 */
export async function noteDevice(u: { userId: string; email: string; name: string }, sessionCreatedAt: Date, cookieId: string | undefined, userAgent: string) {
  if (!cookieId || Date.now() - +sessionCreatedAt > 10 * 60_000) return;
  const { createHash } = await import("node:crypto");
  const deviceHash = createHash("sha256").update(cookieId).digest("hex");
  const seen = await db.knownDevice.findUnique({ where: { userId_deviceHash: { userId: u.userId, deviceHash } }, select: { id: true } });
  if (seen) return;
  const others = await db.knownDevice.count({ where: { userId: u.userId } });
  await db.knownDevice.upsert({ where: { userId_deviceHash: { userId: u.userId, deviceHash } }, create: { userId: u.userId, deviceHash, label: label(userAgent) }, update: { lastSeenAt: new Date() } });
  if (others > 0) await sendSecurityNotice(u.email, u.name, "New sign-in to your OneSimpleSite account", `We noticed a sign-in from ${label(userAgent)}, a device we haven't seen before.`);
}

/** What support sees for each person. */
export async function twoStepStatus(userIds: string[]) {
  if (!userIds.length) return new Map<string, { authenticator: boolean; passkeys: number }>();
  const [tf, pk] = await Promise.all([
    db.twoFactor.findMany({ where: { userId: { in: userIds }, verified: true }, select: { userId: true } }),
    db.passkey.groupBy({ by: ["userId"], where: { userId: { in: userIds } }, _count: true }),
  ]);
  return new Map(userIds.map((id) => [id, { authenticator: tf.some((t) => t.userId === id), passkeys: pk.find((p) => p.userId === id)?._count ?? 0 }]));
}

/**
 * Support reset: removes their authenticator app, passkeys and trusted devices, and signs them out everywhere.
 * If two-step is required for them they set it up again at their next sign-in. Customers: anyone who can edit the company. Team: owners only, never yourself.
 */
export async function resetTwoStep(ctx: StaffCtx, target: { userId: string; kind: "client" | "staff" }) {
  if (target.userId === ctx.userId) throw new DomainError("conflict", "Ask another owner to reset yours.");
  if (target.kind === "staff") {
    if (ctx.role !== "owner") throw forbidden("Only an owner can reset a team member's two-step sign-in.");
    if (!(await db.staffMembership.findFirst({ where: { workspaceId: ctx.workspaceId, userId: target.userId }, select: { id: true } }))) throw notFound("That team member wasn't found.");
  } else {
    if (!can(ctx.role, "customer.write")) throw forbidden();
    if (!(await db.clientMembership.findFirst({ where: { userId: target.userId, customer: { workspaceId: ctx.workspaceId } }, select: { id: true } }))) throw notFound("That person wasn't found.");
  }
  const u = await db.user.findUniqueOrThrow({ where: { id: target.userId }, select: { id: true, email: true, name: true } });
  await db.$transaction(async (tx) => {
    await tx.twoFactor.deleteMany({ where: { userId: u.id } });
    await tx.passkey.deleteMany({ where: { userId: u.id } });
    await tx.verification.deleteMany({ where: { value: u.id, identifier: { startsWith: "trust-device-" } } });
    await tx.knownDevice.deleteMany({ where: { userId: u.id } });
    await tx.user.update({ where: { id: u.id }, data: { twoFactorEnabled: false } });
    await tx.session.deleteMany({ where: { userId: u.id } });
    await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "security.two_step_reset", targetType: "user", targetId: u.id, detail: { kind: target.kind } });
  });
  await sendSecurityNotice(u.email, u.name, "Your two-step sign-in was reset", "Our team reset your two-step sign-in, so you were signed out everywhere. Sign in with your password and you'll be guided through setting it up again.");
}
