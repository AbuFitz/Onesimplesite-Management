import { db } from "@/lib/db";
import { audit, enqueue } from "@/lib/audit";
import { manageLink, portalLink } from "@/lib/env";

/** What the notice says is new, and which snapshots it carries, for each kind of reader. */
export const WHATS_NEW = {
  customer: { items: ["Refer a friend: earn cash for every business you send us, with a link, QR code and share buttons", "A bell for replies, payments and signatures", "Passkeys and an authenticator app for safer sign-in, set up in about a minute", "A cleaner home page and a tidier Settings"], images: [["email/c-refer.jpg", "Refer a friend"], ["email/c-qr.jpg", "Your referral QR code"], ["email/c-notify.jpg", "The notification bell"]] },
  team: { items: ["Today: every widget opens a summary, and Customise lets you choose what shows", "Projects: a journey tracker with dates, a progress ring and a clearer overview", "Referrals: customer and partner links, payouts and rules", "Agreements: price, care plan, deposit and offer on one page with a live summary", "Tickets rebuilt as a record with a waiting timer, and a bell for what needs you"], images: [["email/t-customise.jpg", "Customise Today"], ["email/t-journey.jpg", "The project journey"], ["email/t-rules.jpg", "Referral rules"]] },
} as const;
import { can } from "@/modules/identity/permissions";
import { forbidden } from "@/lib/errors";
import type { StaffCtx } from "@/modules/identity/session";

export type Audience = "team" | "customers" | "everyone";
/** One notice per rollout. Re-sending is safe: each person has one queue entry per key, so nobody gets it twice. */
export const ROLLOUT_KEY = "rollout-2026-11b";

type Person = { email: string; name: string; audience: "team" | "customer" };

/** Everyone who can sign in today: active team members, and customers whose portal access has not been removed. */
export async function announcementRecipients(ctx: StaffCtx, audience: Audience): Promise<Person[]> {
  if (!can(ctx.role, "settings.write")) throw forbidden();
  const out = new Map<string, Person>();
  if (audience !== "customers") {
    const staff = await db.staffMembership.findMany({ where: { workspaceId: ctx.workspaceId, status: "active", deactivatedAt: null }, select: { email: true, displayName: true } });
    for (const s of staff) out.set(s.email.toLowerCase(), { email: s.email, name: s.displayName.split(" ")[0] || s.displayName, audience: "team" });
  }
  if (audience !== "team") {
    const users = await db.user.findMany({ where: { clientMemberships: { some: { revokedAt: null, customer: { workspaceId: ctx.workspaceId, archivedAt: null } } } }, select: { email: true, name: true } });
    for (const u of users) if (!out.has(u.email.toLowerCase())) out.set(u.email.toLowerCase(), { email: u.email, name: u.name.split(" ")[0] || u.name, audience: "customer" });
  }
  return [...out.values()];
}

export async function queueAnnouncement(ctx: StaffCtx, audience: Audience) {
  const people = await announcementRecipients(ctx, audience);
  for (const p of people) {
    await enqueue(db as never, ctx.workspaceId, "email.announcement", `announce:${ROLLOUT_KEY}:${p.email.toLowerCase()}`, { to: p.email, name: p.name, audience: p.audience, link: p.audience === "team" ? manageLink("/login") : portalLink("/login"), items: [...WHATS_NEW[p.audience].items], images: WHATS_NEW[p.audience].images.map(([path, alt]) => ({ src: (p.audience === "team" ? manageLink : portalLink)(`/${path}`), alt })) });
  }
  await audit(db as never, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "announcement.queued", targetType: "workspace", targetId: ctx.workspaceId, detail: { audience, count: people.length, key: ROLLOUT_KEY } });
  return people.length;
}

/** The follow-up: what actually changed, in detail. A separate once-only key from the rollout notice, so everyone who had that one still gets this. */
export const UPDATE_KEY = "update-2026-11";
const SECURITY = { title: "Two-step sign-in is being turned on for everyone", points: [
  "The next time you sign in you will be asked to set it up. It takes about a minute and your password stays the same.",
  "Choose a passkey (Face ID, fingerprint or your device PIN: the quickest) or an authenticator app such as Google Authenticator or 1Password.",
  "You will be shown backup codes once. Keep them somewhere private: they get you in if you lose your phone.",
  "Signing in from a new device sends a short code to your email as well.",
  "Lost access? Reply to this email and we will reset it after checking it is you."] };
export const UPDATE = {
  customer: { sections: [
    SECURITY,
    { title: "A new look", points: ["Calmer glass cards with a dark panel at the top of each page and one small touch of green", "Fewer words and fewer titles: each page shows what matters first", "Built for your phone first, and just as good on a computer"] },
    { title: "Home", points: ["Your open requests, what is waiting for you and your next payment at a glance", "A bell for replies, payments and signatures"] },
    { title: "Tickets", points: ["Choose the kind first: Support, Change request or Onboarding", "A clear timeline of what has happened, and who we are waiting on", "Add photos and files, and open them full size"] },
    { title: "Agreements and payments", points: ["Price, care plan, deposit and offer on one clear page before you sign", "Deposit, final payment and care plan shown as one simple path", "Free months on your care plan mean no monthly charge until they end, and we check with you before anything starts", "Receipts for every payment, ready to download"] },
    { title: "Refer a friend", points: ["Earn cash for every business you send us, paid once their website is paid for", "Your own link, QR code and share buttons for WhatsApp, LinkedIn, X and email", "Your friend gets free months on their plan and sees that you recommended them"] }],
    images: [["email/c-refer.jpg", "Refer a friend"], ["email/c-qr.jpg", "Your referral QR code"], ["email/c-notify.jpg", "The notification bell"]] },
  team: { sections: [
    SECURITY,
    { title: "A new look", points: ["Glass cards, a dark headline panel and one small green accent across every page", "A side rail on a computer and a tab bar on your phone, with no sticky header getting in the way", "Fewer words: titles only where they help"] },
    { title: "Today", points: ["Every widget opens a summary you can act on", "Customise chooses what shows and in what order"] },
    { title: "Companies", points: ["Customers are now Companies, each with a logo", "A tidier People tab, with who can see and pay", "Referral card: who recommended them, who they sent us and what is owed"] },
    { title: "Projects", points: ["A journey tracker with dates and a progress ring", "Checklist, requests, files and linked tickets in one place"] },
    { title: "Tickets", points: ["Rebuilt as a record with a timeline and a waiting timer", "Type first, then the details, then send", "The bell tells you what needs you"] },
    { title: "Agreements and payments", points: ["Price, care plan, deposit and offer on one page with a live summary", "Deposit and final payment are separate steps with clear states", "Free months replace the monthly charge until they end, and you get a reminder a week before"] },
    { title: "Referrals", points: ["Customer and partner links, with their own reward each", "Reward on final payment or deposit, paid out in cash and recorded in a ledger", "Rules, payouts and My referrals as separate pages"] }],
    images: [["email/t-customise.jpg", "Customise Today"], ["email/t-journey.jpg", "The project journey"], ["email/t-rules.jpg", "Referral rules"]] },
} as const;

export async function queueUpdate(ctx: StaffCtx, audience: Audience) {
  const people = await announcementRecipients(ctx, audience);
  for (const p of people) {
    const u = UPDATE[p.audience];
    await enqueue(db as never, ctx.workspaceId, "email.whats_changed", `announce:${UPDATE_KEY}:${p.email.toLowerCase()}`, { to: p.email, name: p.name, audience: p.audience, link: p.audience === "team" ? manageLink("/login") : portalLink("/login"), sections: u.sections.map((x) => ({ title: x.title, points: [...x.points] })), images: u.images.map(([path, alt]) => ({ src: (p.audience === "team" ? manageLink : portalLink)(`/${path}`), alt })) });
  }
  await audit(db as never, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "announcement.queued", targetType: "workspace", targetId: ctx.workspaceId, detail: { audience, count: people.length, key: UPDATE_KEY } });
  return people.length;
}
