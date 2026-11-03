"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireStaff } from "@/modules/identity/session";
import { staffReply, updateSupportTicket, staffCreateTicket } from "@/modules/support/service";
import { quoteChange } from "@/modules/support/change";
import { readUploads } from "@/modules/files/service";
import { DomainError } from "@/lib/errors";
import { flushEmails } from "@/lib/flush-email";

const msg = (e: unknown) => (e instanceof DomainError ? e.message : e instanceof ZodError ? e.issues.map((i) => i.message).join(" ") : "Something went wrong and nothing was saved.");
const back = (path: string, e: unknown): never => redirect(`${path}?error=${encodeURIComponent(msg(e))}`);

export async function supportReplyAction(fd: FormData) {
  const ctx = await requireStaff("customer.read");
  const id = String(fd.get("id"));
  const mode = String(fd.get("mode") ?? "reply"); // reply | note
  try { await staffReply(ctx, id, { body: fd.get("body"), internal: mode === "note", filesInternal: fd.get("filesInternal") === "on" }, await readUploads(fd)); flushEmails(); } catch (e) { back(`/support/${id}`, e); }
  revalidatePath(`/support/${id}`);
  redirect(`/support/${id}?sent=${mode}`);
}

export async function supportUpdateAction(fd: FormData) {
  const ctx = await requireStaff("customer.read");
  const id = String(fd.get("id"));
  try { await updateSupportTicket(ctx, id, { status: fd.get("status") || undefined, priority: fd.get("priority") || undefined, assigneeId: fd.has("assigneeId") ? (String(fd.get("assigneeId")) || null) : undefined }); } catch (e) { back(`/support/${id}`, e); }
  revalidatePath(`/support/${id}`);
  redirect(`/support/${id}?saved=1`);
}

export async function supportCreateAction(fd: FormData) {
  const ctx = await requireStaff("customer.read");
  let id: string;
  try { id = (await staffCreateTicket(ctx, { customerId: fd.get("customerId"), contactId: fd.get("contactId") || "", kind: fd.get("kind") || "issue", title: fd.get("title"), body: fd.get("body"), priority: fd.get("priority") || "normal", projectId: fd.get("projectId") || "", assigneeId: fd.get("assigneeId") || "" })).id; } catch (e) { back(`/support/new?customerId=${String(fd.get("customerId") ?? "")}`, e); }
  redirect(`/support/${id!}`);
}

export async function quoteChangeAction(fd: FormData) {
  const ctx = await requireStaff("customer.write");
  const id = String(fd.get("id"));
  try { await quoteChange(ctx, id, { price: fd.get("included") ? 0 : fd.get("price"), note: fd.get("note") || undefined }); flushEmails(); } catch (e) { back(`/support/${id}`, e); }
  revalidatePath(`/support/${id}`);
  redirect(`/support/${id}?saved=1`);
}
