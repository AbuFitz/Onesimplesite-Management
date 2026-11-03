"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireClient } from "@/modules/identity/session";
import { clientCreateTicket, clientReply, clientResolve } from "@/modules/support/service";
import { DomainError } from "@/lib/errors";
import { readUploads } from "@/modules/files/service";
import { flushEmails } from "@/lib/flush-email";

const msg = (e: unknown) => (e instanceof DomainError ? e.message : e instanceof ZodError ? e.issues.map((i) => i.message).join(" ") : "Something went wrong and nothing was sent. Please try again.");

export async function createTicketAction(_: unknown, fd: FormData): Promise<{ error?: string }> {
  const c = await requireClient();
  let id: string;
  try {
    id = (await clientCreateTicket(c, String(fd.get("customerId") || "") || undefined, { kind: fd.get("kind") || "issue", title: fd.get("title"), body: fd.get("body"), urgency: fd.get("urgency") || "normal", projectId: fd.get("projectId") || "" }, await readUploads(fd))).id;
    flushEmails();
  } catch (e) { return { error: msg(e) }; }
  redirect(`/help/${id}?new=1`);
}

export async function replyAction(_: unknown, fd: FormData): Promise<{ error?: string; done?: boolean }> {
  const c = await requireClient();
  const id = String(fd.get("id"));
  try { await clientReply(c, id, fd.get("body"), await readUploads(fd)); flushEmails(); } catch (e) { return { error: msg(e) }; }
  revalidatePath(`/help/${id}`);
  return { done: true };
}

export async function resolveAction(fd: FormData) {
  const c = await requireClient();
  const id = String(fd.get("id"));
  try { await clientResolve(c, id); } catch { /* not theirs, or already closed */ }
  redirect(`/help/${id}`);
}
