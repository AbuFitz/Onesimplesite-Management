"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireStaff } from "@/modules/identity/session";
import { createVaultEntry, updateVaultEntry, deleteVaultEntry, revealVaultSecret } from "@/modules/vault/service";
import { DomainError } from "@/lib/errors";

const msg = (e: unknown) => (e instanceof DomainError ? e.message : e instanceof ZodError ? e.issues.map((i) => i.message).join("; ") : "Something went wrong. Nothing was changed.");
const fields = (fd: FormData) => ({
  title: fd.get("title"), category: fd.get("category") || undefined, username: fd.get("username") || undefined,
  url: fd.get("url") || undefined, notes: fd.get("notes") || undefined, secret: fd.get("secret") || undefined,
});

export async function saveVaultAction(_: unknown, fd: FormData): Promise<{ error?: string; done?: boolean }> {
  const ctx = await requireStaff("vault.use");
  const id = String(fd.get("id") ?? "");
  try {
    if (id) await updateVaultEntry(ctx, id, fields(fd)); else await createVaultEntry(ctx, fields(fd));
  } catch (e) { return { error: msg(e) }; }
  revalidatePath("/vault");
  return { done: true };
}
export async function deleteVaultAction(fd: FormData) {
  const ctx = await requireStaff("vault.use");
  try { await deleteVaultEntry(ctx, String(fd.get("id"))); } catch { /* already gone */ }
  revalidatePath("/vault");
}
export async function revealVaultAction(id: string): Promise<{ secret?: string; error?: string }> {
  const ctx = await requireStaff("vault.use");
  try { return { secret: await revealVaultSecret(ctx, id) }; } catch (e) { return { error: msg(e) }; }
}
