"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireClient, requireStaff } from "@/modules/identity/session";
import { startPayment, emailPaymentLink, startCarePlanNow, continueFreePlan, requestFinalPayment, openBillingPortal, markPaidManually, cancelCharge, splitWebsiteFee, cancelPlan, setPlanOffer } from "@/modules/billing/service";
import { flushEmails } from "@/lib/flush-email";
import { DomainError } from "@/lib/errors";

const why = (e: unknown) => (e instanceof DomainError ? e.message : "We couldn't start that. Please try again.");

export async function payAction(fd: FormData) {
  const c = await requireClient();
  let url: string;
  try { url = await startPayment(c, String(fd.get("id"))); } catch (e) { redirect(`/billing?error=${encodeURIComponent(why(e))}`); }
  redirect(url);
}

export async function manageBillingAction() {
  const c = await requireClient();
  let url: string;
  try { url = await openBillingPortal(c); } catch (e) { redirect(`/billing?error=${encodeURIComponent(why(e))}`); }
  redirect(url);
}

export async function markPaidAction(fd: FormData) {
  const ctx = await requireStaff("billing.write");
  await markPaidManually(ctx, String(fd.get("id")), "bank");
  revalidatePath(String(fd.get("back") || "/"));
}
export async function requestFinalPaymentAction(fd: FormData) {
  const ctx = await requireStaff("billing.write");
  const back = String(fd.get("back") || "/");
  try { await requestFinalPayment(ctx, String(fd.get("contractId"))); } catch (e) { redirect(`${back}${back.includes("?") ? "&" : "?"}error=${encodeURIComponent(e instanceof DomainError ? e.message : "Something went wrong.")}`); }
  revalidatePath(back);
}
export async function emailPaymentLinkAction(fd: FormData) {
  const ctx = await requireStaff("billing.write");
  const back = String(fd.get("back") || "/");
  let sentTo = "";
  try { sentTo = await emailPaymentLink(ctx, String(fd.get("id"))); flushEmails(); } catch (e) { redirect(`${back}${back.includes("?") ? "&" : "?"}error=${encodeURIComponent(e instanceof DomainError ? e.message : "Something went wrong.")}`); }
  redirect(`${back}${back.includes("?") ? "&" : "?"}emailed=${encodeURIComponent(sentTo)}`);
}
export async function startCarePlanAction(fd: FormData) {
  const ctx = await requireStaff("billing.write");
  const back = String(fd.get("back") || "/");
  try { await startCarePlanNow(ctx, String(fd.get("contractId"))); } catch (e) { redirect(`${back}${back.includes("?") ? "&" : "?"}error=${encodeURIComponent(e instanceof DomainError ? e.message : "Something went wrong.")}`); }
  revalidatePath(back);
}
export async function continueFreePlanAction(fd: FormData) {
  const ctx = await requireStaff("billing.write");
  const back = String(fd.get("back") || "/");
  try { await continueFreePlan(ctx, String(fd.get("id"))); } catch (e) { redirect(`${back}${back.includes("?") ? "&" : "?"}error=${encodeURIComponent(e instanceof DomainError ? e.message : "Something went wrong.")}`); }
  revalidatePath(back);
}
export async function cancelChargeAction(fd: FormData) {
  const ctx = await requireStaff("billing.write");
  await cancelCharge(ctx, String(fd.get("id")));
  revalidatePath(String(fd.get("back") || "/"));
}
export async function splitFeeAction(fd: FormData) {
  const ctx = await requireStaff("billing.write");
  await splitWebsiteFee(ctx, String(fd.get("contractId")), Number(fd.get("percent")));
  revalidatePath(String(fd.get("back") || "/"));
}

export async function cancelPlanAction(fd: FormData) {
  const ctx = await requireStaff("billing.write");
  const back = String(fd.get("back") || "/");
  try { await cancelPlan(ctx, String(fd.get("id"))); } catch (e) { redirect(`${back}${back.includes("?") ? "&" : "?"}error=${encodeURIComponent(e instanceof DomainError ? e.message : "Couldn't cancel it in Stripe.")}`); }
  revalidatePath(back);
}

export async function setPlanOfferAction(fd: FormData) {
  const ctx = await requireStaff("billing.write");
  const back = String(fd.get("back") || "/");
  try { await setPlanOffer(ctx, String(fd.get("id")), Number(fd.get("months")), String(fd.get("label") ?? "")); }
  catch (e) { redirect(`${back}${back.includes("?") ? "&" : "?"}error=${encodeURIComponent(e instanceof DomainError ? e.message : "Couldn't save the offer.")}`); }
  revalidatePath(back);
}
