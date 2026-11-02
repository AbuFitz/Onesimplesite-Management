"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireStaff } from "@/modules/identity/session";
import { createPost, deletePost, setPinned, addComment, deleteComment } from "@/modules/notes/service";
import { DomainError } from "@/lib/errors";

const msg = (e: unknown) => (e instanceof DomainError ? e.message : e instanceof ZodError ? e.issues.map((i) => i.message).join("; ") : "Something went wrong. Nothing was changed.");

export async function postAction(_: unknown, fd: FormData): Promise<{ error?: string; done?: boolean }> {
  const ctx = await requireStaff("notes.write");
  try { await createPost(ctx, { title: fd.get("title") ?? undefined, body: fd.get("body"), visibility: fd.get("visibility") ?? "team" }); }
  catch (e) { return { error: msg(e) }; }
  revalidatePath("/board");
  return { done: true };
}
export async function deletePostAction(fd: FormData) {
  const ctx = await requireStaff("notes.write");
  try { await deletePost(ctx, String(fd.get("id"))); } catch { /* already gone, or not allowed: the board shows the truth */ }
  redirect("/board");
}
export async function pinAction(fd: FormData) {
  const ctx = await requireStaff("notes.write");
  const id = String(fd.get("id"));
  try { await setPinned(ctx, id, fd.get("pin") === "1"); } catch { /* not allowed */ }
  revalidatePath("/board"); revalidatePath(`/board/${id}`);
}
export async function commentAction(_: unknown, fd: FormData): Promise<{ error?: string; done?: boolean }> {
  const ctx = await requireStaff("notes.write");
  const id = String(fd.get("id"));
  try { await addComment(ctx, id, fd.get("body")); } catch (e) { return { error: msg(e) }; }
  revalidatePath(`/board/${id}`);
  return { done: true };
}
export async function deleteCommentAction(fd: FormData) {
  const ctx = await requireStaff("notes.write");
  const id = String(fd.get("id"));
  try { await deleteComment(ctx, String(fd.get("commentId"))); } catch { /* not allowed */ }
  revalidatePath(`/board/${id}`);
}
