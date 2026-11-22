import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { DomainError, forbidden, notFound } from "@/lib/errors";
import { can } from "@/modules/identity/permissions";
import type { StaffCtx } from "@/modules/identity/session";

/** See docs/REFERRALS.md for why each rule exists. Referrers (customers and partners) are paid cash; the new company gets free months on their plan. */
export type Welcome = { months: number; label: string };
export type ReferralSettings = { enabled: boolean; trigger: "deposit" | "final"; customerCashMinor: number; yearlyCap: number; welcome: { standard: Welcome; ecommerce: Welcome } };
export const DEFAULTS: ReferralSettings = { enabled: true, trigger: "final", customerCashMinor: 5000, yearlyCap: 10, welcome: { standard: { months: 1, label: "free hosting" }, ecommerce: { months: 1, label: "free care plan" } } };
/** Which paid charge completes a referral. "final" means the website is fully paid for. */
export const TRIGGER_KINDS: Record<ReferralSettings["trigger"], string[]> = { deposit: ["deposit", "one_off"], final: ["balance", "one_off"] };
const FREE_MAIL = new Set(["gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "hotmail.co.uk", "live.com", "yahoo.com", "yahoo.co.uk", "icloud.com", "me.com", "btinternet.com", "sky.com", "proton.me", "protonmail.com", "aol.com"]);
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L: easy to read out over the phone

export type Source = { customerId?: string; partnerId?: string };
/** The forms send "c:<id>" for a customer or "p:<id>" for a partner. */
export const parseSource = (v: string): Source | null => { const m = /^([cp]):([0-9a-f-]{36})$/i.exec(v.trim()); return m ? (m[1].toLowerCase() === "c" ? { customerId: m[2] } : { partnerId: m[2] }) : null; };

export async function getSettings(workspaceId: string): Promise<ReferralSettings> {
  const w = await db.workspace.findUnique({ where: { id: workspaceId }, select: { settings: true } });
  const r = ((w?.settings as { referrals?: Partial<ReferralSettings> } | null)?.referrals ?? {}) as Partial<ReferralSettings>;
  const wl = (x: Partial<Welcome> | undefined, d: Welcome): Welcome => ({ months: Number.isInteger(x?.months) ? Math.max(0, Math.min(12, x!.months!)) : d.months, label: (x?.label ?? d.label).slice(0, 40) });
  return { enabled: r.enabled ?? DEFAULTS.enabled, trigger: r.trigger === "deposit" ? "deposit" : "final", customerCashMinor: r.customerCashMinor ?? DEFAULTS.customerCashMinor, yearlyCap: r.yearlyCap ?? DEFAULTS.yearlyCap, welcome: { standard: wl(r.welcome?.standard, DEFAULTS.welcome.standard), ecommerce: wl(r.welcome?.ecommerce, DEFAULTS.welcome.ecommerce) } };
}

export async function saveSettings(ctx: StaffCtx, raw: { enabled: boolean; trigger: string; cash: number; cap: number; stdMonths: number; stdLabel: string; ecoMonths: number; ecoLabel: string }) {
  if (!can(ctx.role, "settings.write")) throw forbidden();
  const n = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(Number.isFinite(v) ? v : lo)));
  const s: ReferralSettings = { enabled: !!raw.enabled, trigger: raw.trigger === "deposit" ? "deposit" : "final", customerCashMinor: n(raw.cash * 100, 0, 200000), yearlyCap: n(raw.cap, 1, 200),
    welcome: { standard: { months: n(raw.stdMonths, 0, 12), label: raw.stdLabel.trim().slice(0, 40) || "free hosting" }, ecommerce: { months: n(raw.ecoMonths, 0, 12), label: raw.ecoLabel.trim().slice(0, 40) || "free care plan" } } };
  const w = await db.workspace.findUniqueOrThrow({ where: { id: ctx.workspaceId }, select: { settings: true } });
  await db.workspace.update({ where: { id: ctx.workspaceId }, data: { settings: { ...((w.settings as object) ?? {}), referrals: s } } });
  await db.$transaction((tx) => audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "referral.settings_changed", targetType: "workspace", targetId: ctx.workspaceId, detail: s }));
  return s;
}

const makeCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (n) => ALPHABET[n % ALPHABET.length]).join("");
async function freshCode(): Promise<string> {
  for (let i = 0; i < 8; i++) { const c = makeCode(); const [a, b] = await Promise.all([db.referralLink.findUnique({ where: { code: c } }), db.partner.findUnique({ where: { code: c } })]); if (!a && !b) return c; }
  throw new DomainError("conflict", "Couldn't make a link. Try again.");
}

/** One stable personal code per customer. Created the first time it is needed. */
export async function ensureLink(workspaceId: string, customerId: string) {
  const have = await db.referralLink.findUnique({ where: { workspaceId_customerId: { workspaceId, customerId } } });
  if (have) return have.code;
  try { return (await db.referralLink.create({ data: { workspaceId, customerId, code: await freshCode() } })).code; }
  catch { const again = await db.referralLink.findUnique({ where: { workspaceId_customerId: { workspaceId, customerId } } }); if (again) return again.code; throw new DomainError("conflict", "Couldn't make a link. Try again."); }
}

/** A code belongs to a customer's link or to a partner. */
export async function findByCode(raw: string): Promise<{ workspaceId: string; name: string; code: string; source: Source; kind: "customer" | "partner" } | null> {
  const code = raw.trim().toUpperCase();
  const l = await db.referralLink.findUnique({ where: { code } });
  if (l) { const c = await db.customer.findFirst({ where: { id: l.customerId, archivedAt: null }, select: { id: true, workspaceId: true, displayName: true } }); return c ? { workspaceId: c.workspaceId, name: c.displayName, code, source: { customerId: c.id }, kind: "customer" } : null; }
  const p = await db.partner.findUnique({ where: { code } });
  return p && p.active ? { workspaceId: p.workspaceId, name: p.name, code, source: { partnerId: p.id }, kind: "partner" } : null;
}

const host = (u?: string | null) => { try { return u ? new URL(/^https?:/i.test(u) ? u : `https://${u}`).hostname.replace(/^www\./, "").toLowerCase() : null; } catch { return null; } };
const digits = (p?: string | null) => (p ?? "").replace(/\D/g, "").replace(/^44/, "0");
const domainsOf = (emails: (string | null)[]) => new Set(emails.map((e) => e?.split("@")[1]?.toLowerCase()).filter((d): d is string => !!d && !FREE_MAIL.has(d)));

/** Things that suggest the two sides are the same people. Returns the first reason, or null. Never blocks: it only sends the referral for a look. */
export async function lookAlike(workspaceId: string, from: Source, refereeId: string): Promise<string | null> {
  if (from.customerId && from.customerId === refereeId) return "A company can't refer itself.";
  const sel = { postcode: true, website: true, phone: true, contacts: { select: { email: true, phone: true } } } as const;
  const b = await db.customer.findFirst({ where: { id: refereeId, workspaceId }, select: sel });
  if (!b) return null;
  const bd = domainsOf(b.contacts.map((x) => x.email));
  if (from.partnerId) {
    const p = await db.partner.findFirst({ where: { id: from.partnerId, workspaceId }, select: { email: true } });
    for (const d of domainsOf([p?.email ?? null])) if (bd.has(d)) return `The partner and the new company share an email domain (${d}).`;
    return null;
  }
  const a = from.customerId ? await db.customer.findFirst({ where: { id: from.customerId, workspaceId }, select: sel }) : null;
  if (!a) return null;
  const ad = domainsOf(a.contacts.map((x) => x.email)); for (const d of bd) if (ad.has(d)) return `Same email domain (${d}).`;
  const pa = new Set([a.phone, ...a.contacts.map((x) => x.phone)].map(digits).filter((x) => x.length > 6));
  for (const p of [b.phone, ...b.contacts.map((x) => x.phone)].map(digits)) if (p && pa.has(p)) return "Same phone number.";
  if (a.postcode && b.postcode && a.postcode.replace(/\s/g, "").toLowerCase() === b.postcode.replace(/\s/g, "").toLowerCase()) return "Same postcode.";
  if (host(a.website) && host(a.website) === host(b.website)) return "Same website.";
  return null;
}

async function sourceName(workspaceId: string, s: Source) {
  if (s.partnerId) return (await db.partner.findFirst({ where: { id: s.partnerId, workspaceId }, select: { name: true } }))?.name;
  if (s.customerId) return (await db.customer.findFirst({ where: { id: s.customerId, workspaceId }, select: { displayName: true } }))?.displayName;
}

async function create(workspaceId: string, from: Source, refereeId: string, via: "team" | "link", actor: { userId: string; label: string } | null) {
  const flag = await lookAlike(workspaceId, from, refereeId);
  const r = await db.referral.create({ data: { workspaceId, referrerId: from.customerId ?? null, partnerId: from.partnerId ?? null, refereeId, via, flag, status: flag ? "review" : "pending" } });
  await db.$transaction(async (tx) => audit(tx, { workspaceId, actor, action: "referral.created", targetType: "referral", targetId: r.id, customerId: refereeId, detail: { from: await sourceName(workspaceId, from), via, flag } }));
  return r;
}

/** The team says who recommended a company (when registering it, or later). */
export async function attachReferrer(ctx: StaffCtx, refereeId: string, from: Source) {
  if (!can(ctx.role, "customer.write")) throw forbidden();
  if (!!from.customerId === !!from.partnerId) throw new DomainError("validation", "Choose who recommended them.");
  if (!(await getSettings(ctx.workspaceId)).enabled) throw new DomainError("conflict", "Referrals are switched off.");
  if (!(await sourceName(ctx.workspaceId, from))) throw notFound();
  if (!(await db.customer.findFirst({ where: { id: refereeId, workspaceId: ctx.workspaceId }, select: { id: true } }))) throw notFound();
  if (from.customerId === refereeId) throw new DomainError("validation", "A company can't refer itself.");
  if (await db.referral.findUnique({ where: { workspaceId_refereeId: { workspaceId: ctx.workspaceId, refereeId } } })) throw new DomainError("conflict", "This company already has a referrer.");
  const r = await create(ctx.workspaceId, from, refereeId, "team", { userId: ctx.userId, label: ctx.name });
  await qualifyIfDue(ctx.workspaceId, refereeId).catch(() => {});
  return r;
}

/** A link visitor became a lead (their company was just created by the public form). */
export async function attachFromLink(workspaceId: string, from: Source, refereeId: string) {
  if (!(await getSettings(workspaceId)).enabled) return null;
  try { return await create(workspaceId, from, refereeId, "link", null); } catch { return null; }
}

const siteKind = async (workspaceId: string, customerId: string): Promise<"standard" | "ecommerce"> => (await db.project.findFirst({ where: { workspaceId, customerId, workType: "shop" }, select: { id: true } })) ? "ecommerce" : "standard";
const orderValue = async (workspaceId: string, customerId: string) => (await db.contract.findFirst({ where: { workspaceId, customerId, status: "completed", cancelledAt: null }, orderBy: { createdAt: "desc" }, select: { oneOffMinor: true } }))?.oneOffMinor ?? null;

/** Called whenever a payment is marked paid. Safe to call any number of times: rewards are written once. */
export async function qualifyIfDue(workspaceId: string, customerId: string) {
  const r = await db.referral.findUnique({ where: { workspaceId_refereeId: { workspaceId, refereeId: customerId } } });
  if (!r || r.status !== "pending") return;
  const s = await getSettings(workspaceId);
  if (!s.enabled) return;
  const paid = await db.billingIntent.findFirst({ where: { workspaceId, customerId, kind: { in: TRIGGER_KINDS[s.trigger] }, status: "paid" }, select: { id: true } });
  if (!paid) return;
  const from: Source = { customerId: r.referrerId ?? undefined, partnerId: r.partnerId ?? undefined };
  let flag = await lookAlike(workspaceId, from, r.refereeId);
  if (!flag && r.referrerId) {
    const rewarded = await db.referral.count({ where: { workspaceId, referrerId: r.referrerId, status: "qualified", qualifiedAt: { gte: new Date(Date.now() - 365 * 864e5) } } });
    if (rewarded >= s.yearlyCap) flag = `Over the limit of ${s.yearlyCap} rewarded referrals a year.`;
  }
  if (!flag && r.partnerId) { const p = await db.partner.findUnique({ where: { id: r.partnerId } }); if (p?.commissionType === "percent" && (await orderValue(workspaceId, r.refereeId)) === null) flag = "No signed order to work the commission from."; }
  if (flag) { await db.referral.update({ where: { id: r.id }, data: { status: "review", flag } }); return; }
  await award(null, r.id, s);
}

async function award(actor: { userId: string; label: string } | null, referralId: string, s: ReferralSettings) {
  await db.$transaction(async (tx) => {
    const r = await tx.referral.findUniqueOrThrow({ where: { id: referralId } });
    if (r.status === "qualified") return;
    const order = await orderValue(r.workspaceId, r.refereeId);
    const ree = await tx.customer.findUnique({ where: { id: r.refereeId }, select: { displayName: true } });
    let payee: { id: string; type: "customer" | "partner" } | null = null, amount = 0;
    if (r.partnerId) { const p = await tx.partner.findUnique({ where: { id: r.partnerId } }); if (p) { payee = { id: p.id, type: "partner" }; amount = p.commissionType === "percent" ? Math.round(((order ?? 0) * p.commissionValue) / 100) : p.commissionValue; } }
    else if (r.referrerId) { payee = { id: r.referrerId, type: "customer" }; amount = s.customerCashMinor; }
    if (payee && amount > 0) await tx.rewardEntry.upsert({ where: { referralId_payeeId_kind: { referralId, payeeId: payee.id, kind: "earned" } }, create: { workspaceId: r.workspaceId, payeeId: payee.id, payeeType: payee.type, referralId, kind: "earned", amountMinor: amount, note: `${ree?.displayName ?? "A company"} became a customer`, actorLabel: actor?.label ?? "automatic" }, update: {} });
    // The new company's incentive: free months at the start of their monthly plan, if it has not started yet.
    const w = s.welcome[await siteKind(r.workspaceId, r.refereeId)];
    let applied = false;
    if (w.months > 0) {
      const plan = await tx.billingIntent.findFirst({ where: { workspaceId: r.workspaceId, customerId: r.refereeId, kind: "recurring_setup", status: "pending" } });
      if (plan) { await tx.billingIntent.update({ where: { id: plan.id }, data: { trialMonths: Math.min(12, plan.trialMonths + w.months), promoLabel: plan.promoLabel ? `${plan.promoLabel} + referral` : `Referral: ${w.label}` } }); applied = true; }
    }
    await tx.referral.update({ where: { id: referralId }, data: { status: "qualified", qualifiedAt: new Date(), flag: null, decidedBy: actor?.label ?? null, orderMinor: order, freeMonths: w.months, freeLabel: w.months > 0 ? w.label : null } });
    await audit(tx, { workspaceId: r.workspaceId, actor, action: "referral.qualified", targetType: "referral", targetId: referralId, customerId: r.refereeId, detail: { payeeType: payee?.type, amountMinor: amount, freeMonths: w.months, freeApplied: applied } });
  });
}

const needDecide = (ctx: StaffCtx) => { if (!can(ctx.role, "settings.write")) throw forbidden(); };

/** A person looked at a flagged referral and is happy with it. */
export async function approve(ctx: StaffCtx, id: string) {
  needDecide(ctx);
  const r = await db.referral.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!r) throw notFound();
  if (r.status !== "review") throw new DomainError("conflict", "This one isn't waiting for a decision.");
  const s = await getSettings(ctx.workspaceId);
  const paid = await db.billingIntent.findFirst({ where: { workspaceId: ctx.workspaceId, customerId: r.refereeId, kind: { in: TRIGGER_KINDS[s.trigger] }, status: "paid" }, select: { id: true } });
  if (!paid) { await db.referral.update({ where: { id }, data: { status: "pending", flag: null, decidedBy: ctx.name } }); return "waiting" as const; }
  await award({ userId: ctx.userId, label: ctx.name }, id, s);
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

/** Takes the reward back (order cancelled, refunded). Adds a negative entry; nothing is deleted. If it was already paid out, the balance shows what they owe back. */
export async function reverse(ctx: StaffCtx, id: string, note?: string) {
  needDecide(ctx);
  await db.$transaction(async (tx) => {
    const r = await tx.referral.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
    if (!r) throw notFound();
    if (r.status !== "qualified") throw new DomainError("conflict", "Only a rewarded referral can be reversed.");
    const given = await tx.rewardEntry.findMany({ where: { referralId: id, kind: "earned" } });
    for (const e of given) await tx.rewardEntry.upsert({ where: { referralId_payeeId_kind: { referralId: id, payeeId: e.payeeId, kind: "reversed" } }, create: { workspaceId: ctx.workspaceId, payeeId: e.payeeId, payeeType: e.payeeType, referralId: id, kind: "reversed", amountMinor: -e.amountMinor, note: note?.trim().slice(0, 200) || "Reversed", actorLabel: ctx.name }, update: {} });
    await tx.referral.update({ where: { id }, data: { status: "reversed", decidedBy: ctx.name, note: note?.trim().slice(0, 300) || r.note } });
    await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "referral.reversed", targetType: "referral", targetId: id, customerId: r.refereeId, detail: { note } });
  });
}

/** What we owe someone right now (earned minus paid minus reversed). */
export const owedTo = async (workspaceId: string, payeeId: string) => (await db.rewardEntry.aggregate({ where: { workspaceId, payeeId }, _sum: { amountMinor: true } }))._sum.amountMinor ?? 0;

/** Record a cash payout we have made (bank transfer). It cannot pay more than is owed. */
export async function markPaid(ctx: StaffCtx, payeeId: string, amountMinor: number, note: string) {
  needDecide(ctx);
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) throw new DomainError("validation", "Enter an amount above zero.");
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${payeeId}))`; // two people can't pay out the same money at once
    const owed = (await tx.rewardEntry.aggregate({ where: { workspaceId: ctx.workspaceId, payeeId }, _sum: { amountMinor: true } }))._sum.amountMinor ?? 0;
    const last = await tx.rewardEntry.findFirst({ where: { workspaceId: ctx.workspaceId, payeeId }, select: { payeeType: true } });
    if (!last) throw notFound();
    if (amountMinor > owed) throw new DomainError("conflict", "That's more than is owed.");
    await tx.rewardEntry.create({ data: { workspaceId: ctx.workspaceId, payeeId, payeeType: last.payeeType, kind: "paid", amountMinor: -amountMinor, note: note.trim().slice(0, 200) || "Paid by bank transfer", actorLabel: ctx.name } });
    await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "referral.paid_out", targetType: last.payeeType, targetId: payeeId, customerId: last.payeeType === "customer" ? payeeId : null, detail: { amountMinor, note } });
  });
}

// ───────── Partners ─────────
export async function createPartner(ctx: StaffCtx, raw: { name: string; kind: string; email?: string; type: string; value: number; notes?: string }) {
  if (!can(ctx.role, "settings.write")) throw forbidden();
  const name = raw.name.trim(); if (name.length < 2) throw new DomainError("validation", "Enter the partner's name.");
  const percent = raw.type === "percent";
  const value = percent ? Math.round(raw.value) : Math.round(raw.value * 100);
  if (!Number.isFinite(value) || value < 0 || (percent && value > 50) || (!percent && value > 500000)) throw new DomainError("validation", percent ? "Choose a percentage from 0 to 50." : "Enter an amount up to £5,000.");
  const email = raw.email?.trim().toLowerCase() || null;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new DomainError("validation", "That email doesn't look right.");
  const p = await db.partner.create({ data: { workspaceId: ctx.workspaceId, name, kind: raw.kind === "individual" ? "individual" : "agency", email, code: await freshCode(), commissionType: percent ? "percent" : "fixed", commissionValue: value, notes: raw.notes?.trim().slice(0, 300) || null } });
  await db.$transaction((tx) => audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "partner.created", targetType: "partner", targetId: p.id, detail: { name, type: p.commissionType, value } }));
  return p;
}

export async function setPartnerActive(ctx: StaffCtx, id: string, active: boolean) {
  if (!can(ctx.role, "settings.write")) throw forbidden();
  const p = await db.partner.findFirst({ where: { id, workspaceId: ctx.workspaceId } }); if (!p) throw notFound();
  await db.partner.update({ where: { id }, data: { active } });
  await db.$transaction((tx) => audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: active ? "partner.resumed" : "partner.paused", targetType: "partner", targetId: id }));
}

export async function listPartners(workspaceId: string) {
  const [partners, refs, sums] = await Promise.all([
    db.partner.findMany({ where: { workspaceId }, orderBy: [{ active: "desc" }, { name: "asc" }] }),
    db.referral.groupBy({ by: ["partnerId", "status"], where: { workspaceId, partnerId: { not: null } }, _count: true }),
    db.rewardEntry.groupBy({ by: ["payeeId"], where: { workspaceId, payeeType: "partner" }, _sum: { amountMinor: true } }),
  ]);
  const owed = new Map(sums.map((x) => [x.payeeId, x._sum.amountMinor ?? 0]));
  return partners.map((p) => { const mine = refs.filter((r) => r.partnerId === p.id); return { ...p, leads: mine.reduce((n, r) => n + r._count, 0), won: mine.filter((r) => r.status === "qualified").reduce((n, r) => n + r._count, 0), owedMinor: owed.get(p.id) ?? 0 }; });
}

export async function listReferrals(workspaceId: string) {
  const rows = await db.referral.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" }, take: 300 });
  const cust = [...new Set(rows.flatMap((r) => [r.referrerId, r.refereeId]).filter((x): x is string => !!x))];
  const parts = [...new Set(rows.map((r) => r.partnerId).filter((x): x is string => !!x))];
  const [cn, pn, earned] = await Promise.all([
    db.customer.findMany({ where: { id: { in: cust } }, select: { id: true, displayName: true } }),
    db.partner.findMany({ where: { id: { in: parts } }, select: { id: true, name: true } }),
    db.rewardEntry.groupBy({ by: ["referralId"], where: { workspaceId, kind: "earned" }, _sum: { amountMinor: true } }),
  ]);
  const names = new Map(cn.map((c) => [c.id, c.displayName])), pnames = new Map(pn.map((p) => [p.id, p.name])), money = new Map(earned.map((e) => [e.referralId, e._sum.amountMinor ?? 0]));
  return rows.map((r) => ({ ...r, referrer: r.partnerId ? (pnames.get(r.partnerId) ?? "Partner") : (names.get(r.referrerId ?? "") ?? "Unknown"), isPartner: !!r.partnerId, referee: names.get(r.refereeId) ?? "Unknown", rewardMinor: money.get(r.id) ?? 0 }));
}

/** Everyone we currently owe money to, biggest first. */
export async function payables(workspaceId: string) {
  const g = await db.rewardEntry.groupBy({ by: ["payeeId", "payeeType"], where: { workspaceId }, _sum: { amountMinor: true } });
  const open = g.filter((x) => (x._sum.amountMinor ?? 0) !== 0);
  const [cn, pn] = await Promise.all([
    db.customer.findMany({ where: { id: { in: open.filter((x) => x.payeeType === "customer").map((x) => x.payeeId) } }, select: { id: true, displayName: true } }),
    db.partner.findMany({ where: { id: { in: open.filter((x) => x.payeeType === "partner").map((x) => x.payeeId) } }, select: { id: true, name: true } }),
  ]);
  const name = new Map<string, string>([...cn.map((c) => [c.id, c.displayName] as const), ...pn.map((p) => [p.id, p.name] as const)]);
  return open.map((x) => ({ payeeId: x.payeeId, type: x.payeeType, name: name.get(x.payeeId) ?? "Unknown", owedMinor: x._sum.amountMinor ?? 0 })).sort((a, b) => b.owedMinor - a.owedMinor);
}

/** What one company sees about its own referrals (portal). Never shows the other side's private details. */
export async function myReferrals(workspaceId: string, customerId: string) {
  const [code, rows, owed, entries] = await Promise.all([
    ensureLink(workspaceId, customerId),
    db.referral.findMany({ where: { workspaceId, referrerId: customerId }, orderBy: { createdAt: "desc" }, take: 50 }),
    owedTo(workspaceId, customerId),
    db.rewardEntry.findMany({ where: { workspaceId, payeeId: customerId }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const names = new Map((await db.customer.findMany({ where: { id: { in: rows.map((r) => r.refereeId) } }, select: { id: true, displayName: true } })).map((c) => [c.id, c.displayName]));
  const paid = entries.filter((e) => e.kind === "paid").reduce((n, e) => n - e.amountMinor, 0);
  return {
    code, owed, paid, entries,
    // "review" and "rejected" are our business: the customer just sees it as still in progress.
    list: rows.map((r) => ({ id: r.id, name: names.get(r.refereeId) ?? "A company", status: r.status === "qualified" ? "rewarded" : r.status === "reversed" || r.status === "rejected" ? "ended" : "in progress", at: r.createdAt })),
  };
}
