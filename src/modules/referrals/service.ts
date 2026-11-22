import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { DomainError, forbidden, notFound } from "@/lib/errors";
import { can } from "@/modules/identity/permissions";
import type { StaffCtx } from "@/modules/identity/session";

/** See docs/REFERRALS.md for why each rule exists. */
export type ReferralSettings = { enabled: boolean; referrerMinor: number; refereeMinor: number; yearlyCap: number };
export const DEFAULTS: ReferralSettings = { enabled: true, referrerMinor: 5000, refereeMinor: 5000, yearlyCap: 10 };
export const QUALIFYING_KINDS = ["deposit", "one_off"];
const FREE_MAIL = new Set(["gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "hotmail.co.uk", "live.com", "yahoo.com", "yahoo.co.uk", "icloud.com", "me.com", "btinternet.com", "sky.com", "proton.me", "protonmail.com", "aol.com"]);
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L: easy to read out over the phone

export async function getSettings(workspaceId: string): Promise<ReferralSettings> {
  const w = await db.workspace.findUnique({ where: { id: workspaceId }, select: { settings: true } });
  const r = (w?.settings as { referrals?: Partial<ReferralSettings> } | null)?.referrals ?? {};
  return { enabled: r.enabled ?? DEFAULTS.enabled, referrerMinor: r.referrerMinor ?? DEFAULTS.referrerMinor, refereeMinor: r.refereeMinor ?? DEFAULTS.refereeMinor, yearlyCap: r.yearlyCap ?? DEFAULTS.yearlyCap };
}

export async function saveSettings(ctx: StaffCtx, raw: { enabled: boolean; referrer: number; referee: number; cap: number }) {
  if (!can(ctx.role, "settings.write")) throw forbidden();
  const s: ReferralSettings = { enabled: !!raw.enabled, referrerMinor: Math.max(0, Math.min(100000, Math.round(raw.referrer * 100))), refereeMinor: Math.max(0, Math.min(100000, Math.round(raw.referee * 100))), yearlyCap: Math.max(1, Math.min(200, Math.round(raw.cap))) };
  const w = await db.workspace.findUniqueOrThrow({ where: { id: ctx.workspaceId }, select: { settings: true } });
  await db.workspace.update({ where: { id: ctx.workspaceId }, data: { settings: { ...((w.settings as object) ?? {}), referrals: s } } });
  await db.$transaction((tx) => audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "referral.settings_changed", targetType: "workspace", targetId: ctx.workspaceId, detail: s }));
  return s;
}

const makeCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (n) => ALPHABET[n % ALPHABET.length]).join("");

/** One stable personal code per company. Created the first time it is needed. */
export async function ensureLink(workspaceId: string, customerId: string) {
  const have = await db.referralLink.findUnique({ where: { workspaceId_customerId: { workspaceId, customerId } } });
  if (have) return have.code;
  for (let i = 0; i < 6; i++) {
    try { return (await db.referralLink.create({ data: { workspaceId, customerId, code: makeCode() } })).code; }
    catch { const again = await db.referralLink.findUnique({ where: { workspaceId_customerId: { workspaceId, customerId } } }); if (again) return again.code; }
  }
  throw new DomainError("conflict", "Couldn't make a referral link. Try again.");
}

export async function findByCode(code: string) {
  const l = await db.referralLink.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!l) return null;
  const c = await db.customer.findFirst({ where: { id: l.customerId, archivedAt: null }, select: { id: true, workspaceId: true, displayName: true } });
  return c ? { link: l, customer: c } : null;
}

const host = (u?: string | null) => { try { return u ? new URL(/^https?:/i.test(u) ? u : `https://${u}`).hostname.replace(/^www\./, "").toLowerCase() : null; } catch { return null; } };
const digits = (p?: string | null) => (p ?? "").replace(/\D/g, "").replace(/^44/, "0");

/** Things that suggest the two companies are the same people. Returns the first reason, or null. Never blocks: it only sends the referral for a look. */
export async function lookAlike(workspaceId: string, referrerId: string, refereeId: string): Promise<string | null> {
  if (referrerId === refereeId) return "A company can't refer itself.";
  const [a, b] = await Promise.all([referrerId, refereeId].map((id) => db.customer.findFirst({ where: { id, workspaceId }, select: { postcode: true, website: true, phone: true, contacts: { select: { email: true, phone: true } } } })));
  if (!a || !b) return null;
  const doms = (c: typeof a) => new Set(c.contacts.map((x) => x.email?.split("@")[1]?.toLowerCase()).filter((d): d is string => !!d && !FREE_MAIL.has(d)));
  const da = doms(a); for (const d of doms(b)) if (da.has(d)) return `Same email domain (${d}).`;
  const pa = new Set([a.phone, ...a.contacts.map((x) => x.phone)].map(digits).filter((x) => x.length > 6));
  for (const p of [b.phone, ...b.contacts.map((x) => x.phone)].map(digits)) if (p && pa.has(p)) return "Same phone number.";
  if (a.postcode && b.postcode && a.postcode.replace(/\s/g, "").toLowerCase() === b.postcode.replace(/\s/g, "").toLowerCase()) return "Same postcode.";
  if (host(a.website) && host(a.website) === host(b.website)) return "Same website.";
  return null;
}

/** The team says who recommended a company (when registering it, or later). */
export async function attachReferrer(ctx: StaffCtx, refereeId: string, referrerId: string, via: "team" | "link" = "team") {
  if (!can(ctx.role, "customer.write")) throw forbidden();
  const s = await getSettings(ctx.workspaceId);
  if (!s.enabled) throw new DomainError("conflict", "Referrals are switched off.");
  const [ref, rer] = await Promise.all([refereeId, referrerId].map((id) => db.customer.findFirst({ where: { id, workspaceId: ctx.workspaceId }, select: { id: true, displayName: true } })));
  if (!ref || !rer) throw notFound();
  if (refereeId === referrerId) throw new DomainError("validation", "A company can't refer itself.");
  const exists = await db.referral.findUnique({ where: { workspaceId_refereeId: { workspaceId: ctx.workspaceId, refereeId } } });
  if (exists) throw new DomainError("conflict", "This company already has a referrer.");
  const flag = await lookAlike(ctx.workspaceId, referrerId, refereeId);
  const r = await db.referral.create({ data: { workspaceId: ctx.workspaceId, referrerId, refereeId, via, flag, status: flag ? "review" : "pending" } });
  await db.$transaction((tx) => audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "referral.created", targetType: "referral", targetId: r.id, customerId: refereeId, detail: { referrer: rer.displayName, via, flag } }));
  await qualifyIfDue(ctx.workspaceId, refereeId).catch(() => {});
  return r;
}

/** A link visitor became a lead. Their company already exists (created by the public form). */
export async function attachFromLink(workspaceId: string, referrerId: string, refereeId: string) {
  const s = await getSettings(workspaceId);
  if (!s.enabled) return null;
  const flag = await lookAlike(workspaceId, referrerId, refereeId);
  try {
    const r = await db.referral.create({ data: { workspaceId, referrerId, refereeId, via: "link", flag, status: flag ? "review" : "pending" } });
    await db.$transaction((tx) => audit(tx, { workspaceId, actor: null, action: "referral.created", targetType: "referral", targetId: r.id, customerId: refereeId, detail: { via: "link", flag } }));
    return r;
  } catch { return null; }
}

/** Called whenever a payment is marked paid. Safe to call any number of times: rewards are written once. */
export async function qualifyIfDue(workspaceId: string, customerId: string) {
  const r = await db.referral.findUnique({ where: { workspaceId_refereeId: { workspaceId, refereeId: customerId } } });
  if (!r || r.status !== "pending") return;
  const paid = await db.billingIntent.findFirst({ where: { workspaceId, customerId, kind: { in: QUALIFYING_KINDS }, status: "paid" }, select: { id: true } });
  if (!paid) return;
  const s = await getSettings(workspaceId);
  if (!s.enabled) return;
  const since = new Date(Date.now() - 365 * 864e5);
  const rewarded = await db.referral.count({ where: { workspaceId, referrerId: r.referrerId, status: "qualified", qualifiedAt: { gte: since } } });
  const flag = (await lookAlike(workspaceId, r.referrerId, r.refereeId)) ?? (rewarded >= s.yearlyCap ? `Over the limit of ${s.yearlyCap} rewarded referrals a year.` : null);
  if (flag) { await db.referral.update({ where: { id: r.id }, data: { status: "review", flag } }); return; }
  await award(null, r.id, s);
}

async function award(actor: { userId: string; label: string } | null, referralId: string, s: ReferralSettings) {
  await db.$transaction(async (tx) => {
    const r = await tx.referral.findUniqueOrThrow({ where: { id: referralId } });
    if (r.status === "qualified") return;
    const [rer, ree] = await Promise.all([r.referrerId, r.refereeId].map((id) => tx.customer.findUnique({ where: { id }, select: { displayName: true } })));
    const note = (who: string) => `Referral: ${who}`;
    const up = (customerId: string, kind: string, amountMinor: number, n: string) => amountMinor > 0 ? tx.rewardEntry.upsert({ where: { referralId_customerId_kind: { referralId, customerId, kind } }, create: { workspaceId: r.workspaceId, customerId, referralId, kind, amountMinor, note: n, actorLabel: actor?.label ?? "automatic" }, update: {} }) : Promise.resolve();
    await up(r.referrerId, "earned", s.referrerMinor, note(`${ree?.displayName ?? "a company"} became a customer`));
    await up(r.refereeId, "welcome", s.refereeMinor, note(`recommended by ${rer?.displayName ?? "a customer"}`));
    await tx.referral.update({ where: { id: referralId }, data: { status: "qualified", qualifiedAt: new Date(), flag: null, decidedBy: actor?.label ?? null } });
    await audit(tx, { workspaceId: r.workspaceId, actor, action: "referral.qualified", targetType: "referral", targetId: referralId, customerId: r.refereeId, detail: { referrerMinor: s.referrerMinor, refereeMinor: s.refereeMinor } });
  });
}

const needDecide = (ctx: StaffCtx) => { if (!can(ctx.role, "settings.write")) throw forbidden(); };

/** A person looked at a flagged referral and is happy with it. */
export async function approve(ctx: StaffCtx, id: string) {
  needDecide(ctx);
  const r = await db.referral.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!r) throw notFound();
  if (r.status !== "review") throw new DomainError("conflict", "This one isn't waiting for a decision.");
  const paid = await db.billingIntent.findFirst({ where: { workspaceId: ctx.workspaceId, customerId: r.refereeId, kind: { in: QUALIFYING_KINDS }, status: "paid" }, select: { id: true } });
  if (!paid) { await db.referral.update({ where: { id }, data: { status: "pending", flag: null, decidedBy: ctx.name } }); return "waiting" as const; }
  await award({ userId: ctx.userId, label: ctx.name }, id, await getSettings(ctx.workspaceId));
  return "rewarded" as const;
}

export async function reject(ctx: StaffCtx, id: string, note?: string) {
  needDecide(ctx);
  const r = await db.referral.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!r) throw notFound();
  if (r.status === "qualified") throw new DomainError("conflict", "Already rewarded. Use Reverse instead.");
  await db.referral.update({ where: { id }, data: { status: "rejected", decidedBy: ctx.name, note: note?.trim().slice(0, 300) || r.note } });
  await db.$transaction((tx) => audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "referral.rejected", targetType: "referral", targetId: id, customerId: r.refereeId, detail: { note } }));
}

/** Takes the rewards back (order cancelled, deposit refunded). Adds negative entries; nothing is deleted. */
export async function reverse(ctx: StaffCtx, id: string, note?: string) {
  needDecide(ctx);
  await db.$transaction(async (tx) => {
    const r = await tx.referral.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
    if (!r) throw notFound();
    if (r.status !== "qualified") throw new DomainError("conflict", "Only a rewarded referral can be reversed.");
    const given = await tx.rewardEntry.findMany({ where: { referralId: id, kind: { in: ["earned", "welcome"] } } });
    for (const e of given) await tx.rewardEntry.upsert({ where: { referralId_customerId_kind: { referralId: id, customerId: e.customerId, kind: "reversed" } }, create: { workspaceId: ctx.workspaceId, customerId: e.customerId, referralId: id, kind: "reversed", amountMinor: -e.amountMinor, note: note?.trim().slice(0, 200) || "Reversed", actorLabel: ctx.name }, update: {} });
    await tx.referral.update({ where: { id }, data: { status: "reversed", decidedBy: ctx.name, note: note?.trim().slice(0, 300) || r.note } });
    await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "referral.reversed", targetType: "referral", targetId: id, customerId: r.refereeId, detail: { note } });
  });
}

export const balanceOf = async (workspaceId: string, customerId: string) => (await db.rewardEntry.aggregate({ where: { workspaceId, customerId }, _sum: { amountMinor: true } }))._sum.amountMinor ?? 0;

/** Spend some of a company's credit against a payment. It cannot go below zero. */
export async function useCredit(ctx: StaffCtx, customerId: string, amountMinor: number, note: string) {
  if (!can(ctx.role, "customer.write")) throw forbidden();
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) throw new DomainError("validation", "Enter an amount above zero.");
  await db.$transaction(async (tx) => {
    // Lock this company's entries so two people can't spend the same credit at once.
    await tx.$queryRaw`SELECT 1 FROM "Customer" WHERE "id" = ${customerId}::uuid AND "workspaceId" = ${ctx.workspaceId}::uuid FOR UPDATE`;
    const bal = (await tx.rewardEntry.aggregate({ where: { workspaceId: ctx.workspaceId, customerId }, _sum: { amountMinor: true } }))._sum.amountMinor ?? 0;
    if (amountMinor > bal) throw new DomainError("conflict", "That's more than their credit.");
    await tx.rewardEntry.create({ data: { workspaceId: ctx.workspaceId, customerId, kind: "used", amountMinor: -amountMinor, note: note.trim().slice(0, 200) || "Used against a payment", actorLabel: ctx.name } });
    await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "referral.credit_used", targetType: "customer", targetId: customerId, customerId, detail: { amountMinor, note } });
  });
}

export async function listReferrals(workspaceId: string) {
  const rows = await db.referral.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" }, take: 300 });
  const ids = [...new Set(rows.flatMap((r) => [r.referrerId, r.refereeId]))];
  const names = new Map((await db.customer.findMany({ where: { id: { in: ids } }, select: { id: true, displayName: true } })).map((c) => [c.id, c.displayName]));
  const earned = await db.rewardEntry.groupBy({ by: ["referralId"], where: { workspaceId, kind: { in: ["earned", "welcome"] } }, _sum: { amountMinor: true } });
  const paidOut = new Map(earned.map((e) => [e.referralId, e._sum.amountMinor ?? 0]));
  return rows.map((r) => ({ ...r, referrer: names.get(r.referrerId) ?? "Unknown", referee: names.get(r.refereeId) ?? "Unknown", rewardMinor: paidOut.get(r.id) ?? 0 }));
}

/** What one company sees about its own referrals (portal). Never shows the other side's private details. */
export async function myReferrals(workspaceId: string, customerId: string) {
  const [code, rows, balance, entries] = await Promise.all([
    ensureLink(workspaceId, customerId),
    db.referral.findMany({ where: { workspaceId, referrerId: customerId }, orderBy: { createdAt: "desc" }, take: 50 }),
    balanceOf(workspaceId, customerId),
    db.rewardEntry.findMany({ where: { workspaceId, customerId }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const names = new Map((await db.customer.findMany({ where: { id: { in: rows.map((r) => r.refereeId) } }, select: { id: true, displayName: true } })).map((c) => [c.id, c.displayName]));
  const cameFrom = await db.referral.findUnique({ where: { workspaceId_refereeId: { workspaceId, refereeId: customerId } } });
  return {
    code, balance, entries,
    // "review" and "rejected" are our business: the customer just sees it as still in progress.
    list: rows.map((r) => ({ id: r.id, name: names.get(r.refereeId) ?? "A company", status: r.status === "qualified" ? "rewarded" : r.status === "reversed" ? "ended" : r.status === "rejected" ? "ended" : "in progress", at: r.createdAt })),
    cameFrom: !!cameFrom,
  };
}
