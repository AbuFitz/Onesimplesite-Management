"use server";
import { redirect } from "next/navigation";
import { requireStaff } from "@/modules/identity/session";
import { createTestClient, resetTestClient } from "@/modules/crm/test-client";
import { DomainError } from "@/lib/errors";
import { stripe, stripeReady } from "@/lib/stripe";
import { ZodError } from "zod";
import { reportProblem } from "@/lib/problems";

const msg = (e: unknown) => (e instanceof DomainError ? e.message : e instanceof ZodError ? e.issues.map((i) => i.message).join(" ") : "Something went wrong and nothing was changed.");

export async function createTestClientAction(fd: FormData) {
  const ctx = await requireStaff("settings.write");
  try { await createTestClient(ctx, fd.get("email")); } catch (e) { if (!(e instanceof DomainError) && !(e instanceof ZodError)) await reportProblem({ workspaceId: ctx.workspaceId, area: "test_client", error: e }); redirect(`/testing?error=${encodeURIComponent(msg(e))}`); }
  redirect("/testing?created=1");
}
export async function resetTestClientAction() {
  const ctx = await requireStaff("settings.write");
  try { await resetTestClient(ctx); } catch (e) { if (!(e instanceof DomainError)) await reportProblem({ workspaceId: ctx.workspaceId, area: "test_client", error: e }); redirect(`/testing?error=${encodeURIComponent(msg(e) + (e instanceof DomainError ? "" : " The reason is under Problems below."))}`); }
  redirect("/testing?reset=1");
}

export type StripeCheck = { ok: boolean; mode: "test" | "live" | "unknown"; detail: string };
/** Asks Stripe for the balance, which proves the secret key works. Nothing is changed or charged. */
export async function checkStripeAction(): Promise<StripeCheck> {
  await requireStaff("settings.write");
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  const mode = /^(sk|rk)_test_/.test(key) ? "test" : /^(sk|rk)_live_/.test(key) ? "live" : "unknown";
  if (!stripeReady()) return { ok: false, mode, detail: "STRIPE_SECRET_KEY isn't set on this deployment." };
  try { await stripe("/balance"); return { ok: true, mode, detail: "Stripe accepted the key." }; } catch (e) { return { ok: false, mode, detail: e instanceof Error ? e.message : "Stripe didn't answer." }; }
}

/** Sends today's summary of held notices now, instead of waiting for tomorrow morning. */
export async function sendDigestNowAction() {
  const ctx = await requireStaff("settings.write");
  const { sendDailyDigest } = await import("@/modules/outbox/digest");
  const { drainOutbox } = await import("@/modules/outbox/drain");
  const r = await sendDailyDigest(ctx.workspaceId, { force: true });
  await drainOutbox(50);
  redirect(`/testing?queue=${encodeURIComponent(r.sent ? `Summary sent with ${"items" in r ? r.items : 0} items` : "Nothing is being held for the summary")}`);
}

/** Sends anything waiting in the email queue right now, and retries anything that failed. */
export async function sendQueuedEmailsAction() {
  const ctx = await requireStaff("settings.write");
  const { drainOutbox, retryFailed } = await import("@/modules/outbox/drain");
  await retryFailed(ctx.workspaceId);
  const r = await drainOutbox(100);
  redirect(`/testing?queue=${encodeURIComponent("done" in r ? `${r.done} sent, ${r.failed} failed` : "email isn't configured")}`);
}
