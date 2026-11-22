// Proves the referral rules against a real (local or dev) database. Makes its own test companies and removes them afterwards.
//   npx tsx scripts/referrals-check.ts
import "dotenv/config";
import { db } from "../src/lib/db";
import * as R from "../src/modules/referrals/service";
import { submitReferralLead } from "../src/modules/referrals/public";

const ok = (c: unknown, m: string) => { if (!c) throw new Error("FAIL: " + m); console.log("ok  -", m); };
const stamp = Date.now();

async function main() {
  const staff = await db.staffMembership.findFirstOrThrow({ where: { role: "owner", status: "active" } });
  const ws = staff.workspaceId;
  const ctx = { userId: staff.userId ?? "u", staffId: staff.id, name: staff.displayName, role: "owner", workspaceId: ws } as unknown as Parameters<typeof R.approve>[0];
  const made: string[] = [];
  const co = async (name: string, email: string, extra: { postcode?: string; phone?: string } = {}) => {
    const c = await db.customer.create({ data: { workspaceId: ws, reference: `REF-${stamp}-${made.length}`, displayName: name, postcode: extra.postcode ?? null } });
    await db.contact.create({ data: { workspaceId: ws, customerId: c.id, name: "Test", email, phone: extra.phone ?? null, isPrimary: true } });
    made.push(c.id); return c.id;
  };
  const balance = (customerId: string) => db.billingIntent.create({ data: { workspaceId: ws, customerId, kind: "balance", amountMinor: 50000, status: "paid", paidAt: new Date() } });
  const partners: string[] = [];
  const deposit = (customerId: string) => db.billingIntent.create({ data: { workspaceId: ws, customerId, kind: "deposit", amountMinor: 50000, status: "paid", paidAt: new Date() } });
  try {
    await R.saveSettings(ctx, { enabled: true, trigger: "final", rewardType: "fixed", reward: 50, team: 0, cap: 10, stdMonths: 1, stdLabel: "free hosting", ecoMonths: 1, ecoLabel: "free care plan" });
    const A = await co(`Ref A ${stamp}`, `a${stamp}@alpha-${stamp}.example`);
    const B = await co(`Ref B ${stamp}`, `b${stamp}@beta-${stamp}.example`);

    ok((await R.ensureLink(ws, A)) === (await R.ensureLink(ws, A)), "a company keeps one stable referral code");
    await R.attachReferrer(ctx, B, { customerId: A });
    ok((await db.referral.findFirstOrThrow({ where: { refereeId: B } })).status === "pending", "a new referral waits as pending");
    await R.attachReferrer(ctx, B, { customerId: A }).then(() => ok(false, "second referrer refused"), () => ok(true, "a company can only be referred once"));
    await R.attachReferrer(ctx, A, { customerId: A }).then(() => ok(false, "self refused"), () => ok(true, "a company can't refer itself"));
    ok((await R.owedTo(ws, A)) === 0, "no credit before anything is paid");

    // Rule: the referrer is only owed once the website is fully paid for (the default trigger).
    const plan = await db.billingIntent.create({ data: { workspaceId: ws, customerId: B, kind: "recurring_setup", amountMinor: 4900, status: "pending" } });
    await deposit(B); await R.qualifyIfDue(ws, B);
    ok((await R.owedTo(ws, A)) === 0, "a paid deposit alone earns nothing when the rule is 'fully paid'");
    await balance(B);
    await R.qualifyIfDue(ws, B); await R.qualifyIfDue(ws, B); await R.qualifyIfDue(ws, B);
    ok((await R.owedTo(ws, A)) === 5000, "the final payment makes the referrer owed £50 cash, exactly once (replays change nothing)");
    ok((await db.rewardEntry.count({ where: { workspaceId: ws, referralId: (await db.referral.findFirstOrThrow({ where: { refereeId: B } })).id } })) === 1, "exactly one ledger entry (the new company's gift is free months, not cash)");
    const refB = await db.referral.findFirstOrThrow({ where: { refereeId: B } });
    ok(refB.freeMonths === 1 && refB.freeLabel === "free hosting", "the new company's incentive is recorded (1 month free hosting for a normal website)");
    ok((await db.billingIntent.findUniqueOrThrow({ where: { id: plan.id } })).trialMonths === 1, "…and added to their monthly plan before it starts");

    await R.markPaid(ctx, A, 2000, "bank transfer");
    ok((await R.owedTo(ws, A)) === 3000, "recording a payout lowers what is owed by a new entry (nothing is edited)");
    await R.markPaid(ctx, A, 999999, "too much").then(() => ok(false, "overpay refused"), () => ok(true, "a payout can't exceed what is owed"));

    await R.reverse(ctx, refB.id, "order cancelled");
    ok((await R.owedTo(ws, A)) === -2000, "reversing takes the reward back (already-paid money shows as owed back)");
    await R.reverse(ctx, refB.id).then(() => ok(false, "double reverse refused"), () => ok(true, "a reversed referral can't be reversed twice"));

    // Looks-alike companies go to review and earn nothing until a person decides.
    const C = await co(`Ref C ${stamp}`, `c${stamp}@alpha-${stamp}.example`);
    await R.attachReferrer(ctx, C, { customerId: A });
    ok((await db.referral.findFirstOrThrow({ where: { refereeId: C } })).status === "review", "same email domain is sent for review");
    await balance(C); await R.qualifyIfDue(ws, C);
    ok((await R.owedTo(ws, A)) === -2000, "a flagged referral earns nothing automatically");
    const cRef = await db.referral.findFirstOrThrow({ where: { refereeId: C } });
    ok((await R.approve(ctx, cRef.id)) === "rewarded" && (await R.owedTo(ws, A)) === 3000, "a person approving it makes the reward owed");

    // Partners: a fixed amount pays out on its own; a percentage needs a signed order to work from.
    const fixed = await R.createPartner(ctx, { name: `Fixed Partner ${stamp}`, kind: "agency", type: "fixed", value: 75 }); partners.push(fixed.id);
    const pct = await R.createPartner(ctx, { name: `Percent Partner ${stamp}`, kind: "individual", type: "percent", value: 10 }); partners.push(pct.id);
    const D = await co(`Ref D ${stamp}`, `d${stamp}@delta-${stamp}.example`); await R.attachReferrer(ctx, D, { partnerId: fixed.id });
    await balance(D); await R.qualifyIfDue(ws, D);
    ok((await R.owedTo(ws, fixed.id)) === 7500, "a partner on a fixed rate is owed that amount when the website is paid");
    const E = await co(`Ref E ${stamp}`, `e${stamp}@echo-${stamp}.example`); await R.attachReferrer(ctx, E, { partnerId: pct.id });
    await balance(E); await R.qualifyIfDue(ws, E);
    ok((await db.referral.findFirstOrThrow({ where: { refereeId: E } })).status === "review", "a percentage partner with no signed order to work from is sent for a look");
    ok(!!(await R.findByCode(fixed.code)) && (await R.findByCode(fixed.code))?.kind === "partner", "a partner's code finds the partner");
    await R.setPartnerActive(ctx, fixed.id, false);
    ok((await R.findByCode(fixed.code)) === null, "a paused partner's link stops working");

    // A company's own deal beats the default. A percentage needs a signed order; a fixed amount does not.
    await R.setCompanyDeal(ctx, A, { type: "percent", value: 10, months: 2 });
    const F = await co(`Ref F ${stamp}`, `f${stamp}@foxtrot-${stamp}.example`); await R.attachReferrer(ctx, F, { customerId: A });
    await balance(F); await R.qualifyIfDue(ws, F);
    ok((await db.referral.findFirstOrThrow({ where: { refereeId: F } })).status === "review", "a percentage deal with no signed order to work from goes for a look");
    await R.setCompanyDeal(ctx, A, { type: "fixed", value: 80, months: 2 });
    const G = await co(`Ref G ${stamp}`, `g${stamp}@golf-${stamp}.example`); const before = await R.owedTo(ws, A); await R.attachReferrer(ctx, G, { customerId: A });
    await balance(G); await R.qualifyIfDue(ws, G);
    ok((await R.owedTo(ws, A)) === before + 8000, "a company on its own fixed deal is owed that amount, not the default");
    ok((await db.referral.findFirstOrThrow({ where: { refereeId: G } })).freeMonths === 2, "and the people they send get that company's own free months");
    const deal = await R.getCompanyDeal(ws, A); ok(deal.type === "fixed" && deal.value === 8000 && deal.months === 2, "the deal is stored and readable");
    await R.setCompanyDeal(ctx, A, { type: "", value: null, months: null });
    ok((await R.effectiveReward(ws, A)).text === "£50", "clearing the deal goes back to the default");
    await R.setCompanyDeal(ctx, A, { type: "percent", value: 99, months: null }).then(() => ok(false, "99% refused"), () => ok(true, "a silly percentage is refused"));

    // Team members get their own link; the reward follows the team setting.
    await R.saveSettings(ctx, { enabled: true, trigger: "final", rewardType: "fixed", reward: 50, team: 25, cap: 10, stdMonths: 1, stdLabel: "free hosting", ecoMonths: 1, ecoLabel: "free care plan" });
    const tp = await R.ensureStaffLink(ctx); partners.push(tp.id);
    ok(tp.kind === "team" && tp.commissionValue === 2500, "a team member's link carries the team reward");
    ok((await R.ensureStaffLink(ctx)).id === tp.id, "and stays the same link");
    ok((await R.findByCode(tp.code))?.kind === "partner", "the link works like any partner link");
    const H = await co(`Ref H ${stamp}`, `h${stamp}@hotel-${stamp}.example`); await R.attachReferrer(ctx, H, { partnerId: tp.id });
    await balance(H); await R.qualifyIfDue(ws, H);
    ok((await R.owedTo(ws, tp.id)) === 2500, "a team member is credited their reward when the website is paid");
    ok((await R.myTeamReferrals(ctx)).list.some((x) => x.status === "won"), "and sees it as won on their own page");

    // The public link: one lead, same answer every time, throttled, honeypot ignored.
    const code = await R.ensureLink(ws, A);
    const lead = { code, business: `Link Lead ${stamp}`, name: "Pat", email: `pat${stamp}@lead-${stamp}.example` };
    ok((await submitReferralLead(lead)).ok, "a visitor can submit through a link");
    const lc = await db.customer.findFirst({ where: { workspaceId: ws, displayName: lead.business } }); if (lc) made.push(lc.id);
    ok(!!lc && (await db.referral.count({ where: { refereeId: lc.id, via: "link" } })) === 1, "it creates a lead and a pending referral");
    await submitReferralLead(lead);
    ok((await db.customer.count({ where: { workspaceId: ws, displayName: lead.business } })) === 1, "submitting the same email again creates nothing new");
    await submitReferralLead({ ...lead, email: `bot${stamp}@x-${stamp}.example`, business: `Bot ${stamp}`, website: "http://spam" });
    ok((await db.customer.count({ where: { workspaceId: ws, displayName: `Bot ${stamp}` } })) === 0, "the hidden field catches bots");
    ok(!(await submitReferralLead({ ...lead, code: "ZZZZZZ" })).ok, "an unknown code is refused");
    console.log("ALL OK");
  } finally {
    const ids = made;
    await db.rewardEntry.deleteMany({ where: { payeeId: { in: [...ids, ...partners] } } });
    await db.referral.deleteMany({ where: { OR: [{ referrerId: { in: ids } }, { refereeId: { in: ids } }, { partnerId: { in: partners } }] } });
    await db.partner.deleteMany({ where: { id: { in: partners } } });
    await db.referralLink.deleteMany({ where: { customerId: { in: ids } } });
    await db.billingIntent.deleteMany({ where: { customerId: { in: ids } } });
    await db.outbox.deleteMany({ where: { topic: "email.referral_notice", payload: { path: ["business"], string_contains: String(stamp) } } });
    await db.auditEvent.deleteMany({ where: { customerId: { in: ids } } });
    await db.contact.deleteMany({ where: { customerId: { in: ids } } });
    await db.customer.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
