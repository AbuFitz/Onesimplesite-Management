"use server";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireStaff } from "@/modules/identity/session";
import { setPrimaryContact, addPerson, updatePerson, invitePerson, setAccess, sendPasswordReset, revokeAccess, removePerson, approveRequest, declineRequest } from "@/modules/people/service";
import { flushEmails } from "@/lib/flush-email";
import { DomainError } from "@/lib/errors";

const why = (e: unknown) => (e instanceof DomainError ? e.message : e instanceof ZodError ? e.issues.map((i) => i.message).join(" ") : "Something went wrong and nothing was changed.");
const to = (cid: string, q: string) => `/customers/${cid}?tab=people&${q}`;
const level = (fd: FormData) => ({ role: fd.get("role") || "member", billing: fd.get("billing") === "on" });

async function run(fd: FormData, ok: string, fn: (ctx: Awaited<ReturnType<typeof requireStaff>>) => Promise<unknown>) {
  const ctx = await requireStaff("customer.write");
  const cid = String(fd.get("customerId"));
  try { await fn(ctx); flushEmails(); } catch (e) { redirect(to(cid, `error=${encodeURIComponent(why(e))}`)); }
  redirect(to(cid, `done=${encodeURIComponent(ok)}`));
}

export async function addPersonAction(fd: FormData) {
  const invite = fd.get("invite") === "on";
  return run(fd, invite ? "Person added and invited to the portal." : "Person added.", async (c) => {
    const p = await addPerson(c, String(fd.get("customerId")), { name: fd.get("name"), email: fd.get("email"), phone: fd.get("phone") || undefined, position: fd.get("position") || undefined });
    if (invite) await invitePerson(c, p.id, level(fd));
  });
}
export async function makeMainContactAction(fd: FormData) { return run(fd, "Main contact changed.", (c) => setPrimaryContact(c, String(fd.get("contactId")))); }
export async function updatePersonAction(fd: FormData) { return run(fd, "Saved.", (c) => updatePerson(c, String(fd.get("contactId")), { name: fd.get("name"), email: fd.get("email"), phone: fd.get("phone") || undefined, position: fd.get("position") || undefined })); }
export async function invitePersonAction(fd: FormData) { return run(fd, "Invitation sent.", (c) => invitePerson(c, String(fd.get("contactId")), level(fd))); }
export async function setAccessAction(fd: FormData) { return run(fd, "Access updated.", (c) => setAccess(c, String(fd.get("contactId")), level(fd))); }
export async function resetPasswordAction(fd: FormData) { return run(fd, "Password reset email sent.", (c) => sendPasswordReset(c, String(fd.get("contactId")))); }
export async function revokeAccessAction(fd: FormData) { return run(fd, "Access removed. They are signed out.", (c) => revokeAccess(c, String(fd.get("contactId")))); }
export async function removePersonAction(fd: FormData) { return run(fd, "Person removed.", (c) => removePerson(c, String(fd.get("contactId")))); }
export async function approveRequestAction(fd: FormData) { return run(fd, "Approved. They've been invited.", (c) => approveRequest(c, String(fd.get("requestId")), level(fd))); }
export async function declineRequestAction(fd: FormData) { return run(fd, "Declined. The requester has been told.", (c) => declineRequest(c, String(fd.get("requestId")), String(fd.get("reason") ?? ""))); }
