"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireStaff } from "@/modules/identity/session";
import { updateProfile, changeOwnEmail } from "@/modules/identity/profile";
import { DomainError } from "@/lib/errors";

const msg = (e: unknown) => (e instanceof DomainError ? e.message : e instanceof ZodError ? e.issues.map((i) => i.message).join("; ") : "Something went wrong. Nothing was changed.");

export async function saveProfileAction(_: unknown, fd: FormData): Promise<{ error?: string; done?: boolean }> {
  const ctx = await requireStaff();
  try { await updateProfile(ctx, { name: fd.get("name"), jobTitle: fd.get("jobTitle") ?? undefined, phone: fd.get("phone") ?? undefined, signature: fd.get("signature") ?? undefined }); }
  catch (e) { return { error: msg(e) }; }
  revalidatePath("/", "layout");
  return { done: true };
}
export async function changeEmailAction(_: unknown, fd: FormData): Promise<{ error?: string; done?: boolean }> {
  const ctx = await requireStaff();
  try { await changeOwnEmail(ctx, String(fd.get("email") ?? ""), String(fd.get("password") ?? "")); }
  catch (e) { return { error: msg(e) }; }
  revalidatePath("/", "layout");
  return { done: true };
}
