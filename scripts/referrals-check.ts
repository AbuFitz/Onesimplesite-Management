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
  const deposit = (customerId: string) => db.billingIntent.create({ data: { workspaceId: ws, customerId, kind: "deposit", amountMinor: 50000, status: "paid", paidAt: new Date() } });
  try {
    await R.saveSettings(ctx, { enabled: true, referrer: 50, referee: 50, cap: 10 });
    const A = await co(`Ref A ${stamp}`, `a${stamp}@alpha-${stamp}.example`);
    const B = await co(`Ref B ${stamp}`, `b${stamp}@beta-${stamp}.example`);

    ok((await R.ensureLink(ws, A)) === (await R.ensureLink(ws, A)), "a company keeps one stable referral code");
    await R.attachReferrer(ctx, B, A);
    ok((await db.referral.findFirstOrThrow({ where: { refereeId: B } })).status === "pending", "a new referral waits as pending");
    await R.attachReferrer(ctx, B, A).then(() => ok(false, "second referrer refused"), () => ok(true, "a company can only be referred once"));
    await R.attachReferrer(ctx, A, A).then(() => ok(false, "self refused"), () => ok(true, "a company can't refer itself"));
    ok((await R.balanceOf(ws, A)) === 0, "no credit before anything is paid");

    await deposit(B);
    await R.qualifyIfDue(ws, B); await R.qualifyIfDue(ws, B); await R.qualifyIfDue(ws, B);
    ok((await R.balanceOf(ws, A)) === 5000 && (await R.balanceOf(ws, B)) === 5000, "a paid deposit gives both sides credit, exactly once (replays change nothing)");
    ok((await db.rewardEntry.count({ where: { workspaceId: ws, referralId: (await db.referral.findFirstOrThrow({ where: { refereeId: B } })).id } })) === 2, "exactly two ledger entries");

    await R.useCredit(ctx, A, 2000, "test payment");
    ok((await R.balanceOf(ws, A)) === 3000, "using credit lowers the balance by an entry (nothing is edited)");
    await R.useCredit(ctx, A, 999999, "too much").then(() => ok(false, "overspend refused"), () => ok(true, "credit can't go below zero"));

    const refId = (await db.referral.findFirstOrThrow({ where: { refereeId: B } })).id;
    await R.reverse(ctx, refId, "order cancelled");
    ok((await R.balanceOf(ws, B)) === 0 && (await R.balanceOf(ws, A)) === -2000, "reversing takes the rewards back with negative entries (credit already spent shows as owed)");
    await R.reverse(ctx, refId).then(() => ok(false, "double reverse refused"), () => ok(true, "a reversed referral can't be reversed twice"));

    // Looks-alike companies go to review and earn nothing until a person decides.
    const C = await co(`Ref C ${stamp}`, `c${stamp}@alpha-${stamp}.example`);
    await R.attachReferrer(ctx, C, A);
    ok((await db.referral.findFirstOrThrow({ where: { refereeId: C } })).status === "review", "same email domain is sent for review");
    await deposit(C); await R.qualifyIfDue(ws, C);
    ok((await R.balanceOf(ws, C)) === 0, "a flagged referral earns nothing automatically");
    const cRef = await db.referral.findFirstOrThrow({ where: { refereeId: C } });
    ok((await R.approve(ctx, cRef.id)) === "rewarded" && (await R.balanceOf(ws, C)) === 5000, "a person approving it pays the reward");

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
    await db.rewardEntry.deleteMany({ where: { customerId: { in: ids } } });
    await db.referral.deleteMany({ where: { OR: [{ referrerId: { in: ids } }, { refereeId: { in: ids } }] } });
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
