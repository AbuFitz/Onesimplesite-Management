"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireClient } from "@/modules/identity/session";
import { clientRequestAccess, updateMyDetails } from "@/modules/people/service";
import { flushEmails } from "@/lib/flush-email";
import { DomainError } from "@/lib/errors";

export async function requestAccessAction(_: unknown, fd: FormData): Promise<{ error?: string }> {
  const c = await requireClient();
  try {
    await clientRequestAccess(c, String(fd.get("customerId")), { name: fd.get("name"), email: fd.get("email"), phone: fd.get("phone") || undefined, position: fd.get("position") || undefined, role: fd.get("role") || "member", billing: fd.get("billing") === "on", reason: fd.get("reason") || undefined });
    flushEmails();
  } catch (e) { return { error: e instanceof DomainError ? e.message : e instanceof ZodError ? e.issues.map((i) => i.message).join(" ") : "We couldn't send that. Please try again." }; }
  redirect("/people?sent=1");
}

export async function updateMyDetailsAction(_: unknown, fd: FormData): Promise<{ error?: string; done?: boolean }> {
  const c = await requireClient();
  try { await updateMyDetails(c, { name: fd.get("name"), phone: fd.get("phone") || undefined, position: fd.get("position") || undefined }); }
  catch (e) { return { error: e instanceof DomainError ? e.message : e instanceof ZodError ? e.issues.map((i) => i.message).join(" ") : "We couldn't save that. Please try again." }; }
  revalidatePath("/account");
  return { done: true };
}
