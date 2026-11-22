"use server";
import { redirect } from "next/navigation";
import { submitReferralLead } from "@/modules/referrals/public";
import { flushEmails } from "@/lib/flush-email";

export async function referralLeadAction(fd: FormData) {
  const code = String(fd.get("code") ?? "");
  const r = await submitReferralLead({ code, business: fd.get("business"), name: fd.get("name"), email: fd.get("email"), phone: fd.get("phone") || undefined, website: fd.get("website") || undefined });
  if (r.ok) flushEmails();
  redirect(`/r/${encodeURIComponent(code)}?${r.ok ? "sent=1" : `error=${encodeURIComponent(r.error)}`}`);
}
