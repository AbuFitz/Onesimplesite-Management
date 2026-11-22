"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/modules/identity/session";
import { DomainError } from "@/lib/errors";
import * as R from "@/modules/referrals/service";

const back = (fd: FormData, fallback = "/referrals") => { const b = String(fd.get("back") ?? ""); return b.startsWith("/") && !b.startsWith("//") ? b : fallback; };
const go = (fd: FormData, ok?: string, err?: unknown) => {
  const to = new URL(back(fd), "http://x"); to.searchParams.delete("error"); to.searchParams.delete("done");
  if (err) to.searchParams.set("error", err instanceof DomainError ? err.message : "Something went wrong and nothing was changed.");
  else if (ok) to.searchParams.set("done", ok);
  revalidatePath("/referrals"); redirect(to.pathname + to.search);
};
async function run(fd: FormData, ok: string, fn: (ctx: Awaited<ReturnType<typeof requireStaff>>) => Promise<unknown>) {
  const ctx = await requireStaff("customer.read");
  try { await fn(ctx); } catch (e) { if (!(e instanceof DomainError)) console.error(e); return go(fd, undefined, e); }
  go(fd, ok);
}
const id = (fd: FormData) => String(fd.get("id") ?? "");

export async function approveReferralAction(fd: FormData) { return run(fd, "Approved.", async (c) => { await R.approve(c, id(fd)); }); }
export async function rejectReferralAction(fd: FormData) { return run(fd, "Rejected. No credit was given.", (c) => R.reject(c, id(fd), String(fd.get("note") ?? ""))); }
export async function reverseReferralAction(fd: FormData) { return run(fd, "Reversed. The credit was taken back.", (c) => R.reverse(c, id(fd), String(fd.get("note") ?? ""))); }
export async function useCreditAction(fd: FormData) { return run(fd, "Credit used.", (c) => R.useCredit(c, id(fd), Math.round(Number(fd.get("amount")) * 100), String(fd.get("note") ?? ""))); }
export async function attachReferrerAction(fd: FormData) { return run(fd, "Referrer saved.", (c) => R.attachReferrer(c, id(fd), String(fd.get("referrer") ?? ""))); }
export async function saveReferralSettingsAction(fd: FormData) { return run(fd, "Saved.", (c) => R.saveSettings(c, { enabled: fd.get("enabled") === "on", referrer: Number(fd.get("referrer")), referee: Number(fd.get("referee")), cap: Number(fd.get("cap")) })); }
