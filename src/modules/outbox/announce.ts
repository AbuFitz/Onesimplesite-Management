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

/** The follow-up: what actually changed, with a screenshot and a plain explanation for each part. A separate once-only key from the rollout notice, so everyone who had that one still gets this. */
export const UPDATE_KEY = "update-2026-11";
type Section = { title: string; lead: string; points: string[]; image?: [string, string] };
const SECURITY = (img: string): Section => ({ title: "Two-step sign-in is being turned on for everyone", lead: "Your password alone is no longer the only thing between your account and someone else. After your password you confirm it is really you with a second step.", points: [
  "The next time you sign in you will be asked to set it up. It takes about a minute. Your email and password stay the same.",
  "Passkey (quickest): use Face ID, your fingerprint or your device PIN. Nothing to type.",
  "Authenticator app: a 6-digit code from Google Authenticator, 1Password or similar.",
  "You will be shown backup codes once. Keep them somewhere private: they get you in if you lose your phone.",
  "Signing in from a new device also sends a short code to your email.",
  "Locked out? Reply to this email and we will reset it after checking it is you."], image: [img, "Setting up two-step sign-in"] });
export const UPDATE: { customer: { sections: Section[] }; team: { sections: Section[] } } = {
  customer: { sections: [
    SECURITY("email/u-c-2fa.jpg"),
    { title: "Home", lead: "One calm page that shows what needs you first: the next thing to do, open requests, documents and what is due.", points: ["A dark panel at the top always shows your next step, with the button to do it", "Small tiles underneath: open tickets, what is needed from you, documents and what to pay", "A bell in the corner for replies, payments and signatures"], image: ["email/u-c-home.jpg", "Your new home page"] },
    { title: "Get help", lead: "Something not right, or want a change? Raise a ticket and we reply by email and on the same page.", points: ["Pick the kind first: Support, Change request or Onboarding", "Add photos and files, and open them full size", "A timeline shows what has happened and who we are waiting on"], image: ["email/u-c-help.jpg", "The help page"] },
    { title: "Billing", lead: "Every payment for your website in one path, so you always know what is next.", points: ["Deposit, final payment and care plan shown step by step", "Pay by card on a secure payment page", "Free months on a care plan mean no monthly charge until they end, and nothing starts without telling you", "A receipt for every payment, ready to download"], image: ["email/u-c-billing.jpg", "Billing, step by step"] },
    { title: "Refer a friend", lead: "Know another business that needs a website? Send them your link. You earn cash when their website is paid for and they get free months.", points: ["Your own link and QR code, with one-tap sharing to WhatsApp, X, LinkedIn and email", "Once someone you sent becomes a customer you see their name here, and they see that you recommended them", "We tell you what we owe you and when it has been paid"], image: ["email/u-c-refer.jpg", "Refer a friend"] },
    { title: "A new look", lead: "Everything was redrawn to be calmer and quicker to read.", points: ["Soft glass cards, one small touch of green, fewer words", "Designed for your phone first, and just as good on a computer"] }] },
  team: { sections: [
    SECURITY("email/u-t-2fa.jpg"),
    { title: "Today", lead: "Your day on one page. Every tile opens a summary you can act on, so you rarely need to go looking.", points: ["Tap any tile to see the detail behind the number", "Customise lets you pick which tiles show and in what order"], image: ["email/t-customise.jpg", "Customise Today"] },
    { title: "Projects", lead: "A project now reads like a journey, from signed to live.", points: ["Stages with dates and a progress ring", "Checklist, requests, files and linked tickets together", "The next thing to do is always shown first"], image: ["email/t-journey.jpg", "The project journey"] },
    { title: "Referrals", lead: "Customers and partners can recommend us and be paid for it, with every pound recorded.", points: ["Customer and partner links, each with their own reward", "Reward on final payment or deposit, paid in cash and recorded in a ledger", "New companies get free months instead of the monthly charge, with a reminder a week before it ends", "Activity, Customers, Partners, Payouts, My referrals and Rules are separate pages"], image: ["email/u-t-referrals.jpg", "The referrals hub"] },
    { title: "Rules", lead: "You decide how generous it is, and can give any company their own deal.", points: ["Set the default reward and the free months for new companies", "Override it for one company on their page"], image: ["email/t-rules.jpg", "Referral rules"] },
    { title: "Also new", lead: "A tidier rest of the app.", points: ["Customers are now Companies, each with a logo and a clearer People tab", "Tickets are records with a timeline and a waiting timer", "Agreements show price, care plan, deposit and offer on one page with a live summary", "A side rail on a computer and a tab bar on your phone", "A bell for what needs you"] }] },
};

export async function queueUpdate(ctx: StaffCtx, audience: Audience) {
  const people = await announcementRecipients(ctx, audience);
  for (const p of people) {
    const u = UPDATE[p.audience];
    const origin = p.audience === "team" ? manageLink : portalLink;
    await enqueue(db as never, ctx.workspaceId, "email.whats_changed", `announce:${UPDATE_KEY}:${p.email.toLowerCase()}`, { to: p.email, name: p.name, audience: p.audience, link: origin("/login"), sections: u.sections.map((x) => ({ title: x.title, lead: x.lead, points: [...x.points], image: x.image ? { src: origin(`/${x.image[0]}`), alt: x.image[1] } : undefined })) });
  }
  await audit(db as never, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "announcement.queued", targetType: "workspace", targetId: ctx.workspaceId, detail: { audience, count: people.length, key: UPDATE_KEY } });
  return people.length;
}
