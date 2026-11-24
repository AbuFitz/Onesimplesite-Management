"use server";
import { requireStaff } from "@/modules/identity/session";
import { announcementRecipients, queueAnnouncement, queueUpdate, type Audience } from "@/modules/outbox/announce";
import { flushEmails } from "@/lib/flush-email";

const pick = (a: string): Audience => (a === "team" || a === "customers" ? a : "everyone");

/** How many people each choice would reach, so the button can say it before anyone presses it. */
export async function announcementCountsAction() {
  const ctx = await requireStaff("settings.write");
  const [team, customers, everyone] = await Promise.all((["team", "customers", "everyone"] as const).map((a) => announcementRecipients(ctx, a).then((r) => r.length)));
  return { team, customers, everyone };
}

export async function sendAnnouncementAction(audience: string, kind: string = "rollout"): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const ctx = await requireStaff("settings.write");
  try {
    const count = kind === "update" ? await queueUpdate(ctx, pick(audience)) : await queueAnnouncement(ctx, pick(audience));
    flushEmails();
    return { ok: true, count };
  } catch (e) { return { ok: false, error: String(e).slice(0, 160) }; }
}
