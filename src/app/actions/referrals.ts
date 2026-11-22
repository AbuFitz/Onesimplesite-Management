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
const num = (fd: FormData, k: string) => Number(fd.get(k));
const txt = (fd: FormData, k: string) => String(fd.get(k) ?? "");

export async function approveReferralAction(fd: FormData) { return run(fd, "Approved.", async (c) => { await R.approve(c, id(fd)); }); }
export async function rejectReferralAction(fd: FormData) { return run(fd, "Rejected. Nothing is owed for this one.", (c) => R.reject(c, id(fd), txt(fd, "note"))); }
export async function reverseReferralAction(fd: FormData) { return run(fd, "Reversed. The reward was taken back.", (c) => R.reverse(c, id(fd), txt(fd, "note"))); }
export async function markPaidAction(fd: FormData) { return run(fd, "Payout recorded.", (c) => R.markPaid(c, id(fd), Math.round(num(fd, "amount") * 100), txt(fd, "note"))); }
export async function attachReferrerAction(fd: FormData) { return run(fd, "Saved.", (c) => { const s = R.parseSource(txt(fd, "referrer")); if (!s) throw new DomainError("validation", "Choose who recommended them."); return R.attachReferrer(c, id(fd), s); }); }
export async function saveReferralSettingsAction(fd: FormData) { return run(fd, "Saved.", (c) => R.saveSettings(c, { enabled: fd.get("enabled") === "on", trigger: txt(fd, "trigger"), cash: num(fd, "cash"), cap: num(fd, "cap"), stdMonths: num(fd, "stdMonths"), stdLabel: txt(fd, "stdLabel"), ecoMonths: num(fd, "ecoMonths"), ecoLabel: txt(fd, "ecoLabel") })); }
export async function createPartnerAction(fd: FormData) { return run(fd, "Partner added.", (c) => R.createPartner(c, { name: txt(fd, "name"), kind: txt(fd, "kind"), email: txt(fd, "email"), type: txt(fd, "type"), value: num(fd, "value"), notes: txt(fd, "notes") })); }
export async function togglePartnerAction(fd: FormData) { return run(fd, "Saved.", (c) => R.setPartnerActive(c, id(fd), fd.get("active") === "1")); }
