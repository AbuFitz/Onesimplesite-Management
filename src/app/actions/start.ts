"use server";
import { redirect } from "next/navigation";
import { submitEnquiry } from "@/modules/referrals/public";
import { flushEmails } from "@/lib/flush-email";

export async function startAction(fd: FormData) {
  const r = await submitEnquiry({ business: fd.get("business"), name: fd.get("name"), email: fd.get("email"), phone: fd.get("phone") || undefined, website: fd.get("website") || undefined });
  if (r.ok) flushEmails();
  redirect(`/start?${r.ok ? "sent=1" : `error=${encodeURIComponent(r.error)}`}`);
}
