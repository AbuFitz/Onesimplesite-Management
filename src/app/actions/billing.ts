"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireClient, requireStaff } from "@/modules/identity/session";
import { startPayment, openBillingPortal, markPaidManually, cancelCharge, splitWebsiteFee } from "@/modules/billing/service";
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
