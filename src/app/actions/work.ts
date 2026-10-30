"use server";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireStaff } from "@/modules/identity/session";
import { transitionProject, postUpdate, requestAsset, addTask } from "@/modules/projects/service";
import { createEvent, cancelEvent } from "@/modules/calendar/service";
import { createNote, saveNote, archiveNote } from "@/modules/notes/service";
import { DomainError } from "@/lib/errors";
import { flushEmails } from "@/lib/flush-email";

const msg = (e: unknown) => (e instanceof DomainError ? e.message : e instanceof ZodError ? e.issues.map((i) => i.message).join("; ") : "Something went wrong. Nothing was changed.");
const back = (path: string, e: unknown): never => redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(msg(e))}`);

export async function transitionAction(fd: FormData) {
  const ctx = await requireStaff("project.write");
  const id = String(fd.get("id"));
  try { await transitionProject(ctx, id, fd.get("stage") as never, Number(fd.get("version")), String(fd.get("override") ?? "")); } catch (e) { return back(`/projects/${id}`, e); }
  redirect(`/projects/${id}`);
}
export async function updateAction(fd: FormData) {
  const ctx = await requireStaff("project.write");
  const id = String(fd.get("id"));
  try { await postUpdate(ctx, id, { body: fd.get("body"), clientVisible: fd.get("clientVisible") === "on" }); } catch (e) { return back(`/projects/${id}`, e); }
  redirect(`/projects/${id}`);
}
export async function assetAction(fd: FormData) {
  const ctx = await requireStaff("project.write");
  const id = String(fd.get("id"));
  try { await requestAsset(ctx, id, { label: fd.get("label"), required: fd.get("required") === "on", dueDate: fd.get("dueDate") || undefined }); } catch (e) { return back(`/projects/${id}`, e); }
  redirect(`/projects/${id}`);
}
export async function taskAction(fd: FormData) {
  const ctx = await requireStaff("project.write");
  const id = String(fd.get("id"));
  try { await addTask(ctx, id, String(fd.get("title")), String(fd.get("dueDate") || "") || undefined); } catch (e) { return back(`/projects/${id}`, e); }
  redirect(`/projects/${id}`);
}

export async function createEventAction(fd: FormData) {
  const ctx = await requireStaff("calendar.write");
  try {
    await createEvent(ctx, {
      title: fd.get("title"), type: fd.get("type"), startsAt: new Date(String(fd.get("startsAt"))), endsAt: new Date(String(fd.get("endsAt"))),
      location: fd.get("location") || undefined, description: fd.get("description") || undefined, customerId: fd.get("customerId") || undefined, attendeeIds: fd.getAll("attendee").map(String),
    });
  } catch (e) { return back("/calendar/new", e); }
  redirect("/calendar");
}
export async function cancelEventAction(fd: FormData) {
  const ctx = await requireStaff("calendar.write");
  try { await cancelEvent(ctx, String(fd.get("id")), Number(fd.get("version"))); } catch (e) { return back("/calendar", e); }
  redirect("/calendar");
}

export async function createNoteAction(fd: FormData) {
  const ctx = await requireStaff("notes.write");
  let id: string;
  try { id = (await createNote(ctx, { title: fd.get("title"), body: fd.get("body") ?? "", visibility: fd.get("visibility") ?? "team" }, { customerId: String(fd.get("customerId") || "") || undefined })).id; } catch (e) { return back("/notes", e); }
  redirect(`/notes/${id}`);
}
export async function saveNoteAction(fd: FormData) {
  const ctx = await requireStaff("notes.write");
  const id = String(fd.get("id"));
  try { await saveNote(ctx, id, Number(fd.get("version")), { title: fd.get("title"), body: fd.get("body"), visibility: fd.get("visibility") }); } catch (e) { return back(`/notes/${id}`, e); }
  redirect(`/notes/${id}?saved=1`);
}
export async function archiveNoteAction(fd: FormData) {
  const ctx = await requireStaff("notes.write");
  try { await archiveNote(ctx, String(fd.get("id"))); } catch (e) { return back("/notes", e); }
  redirect("/notes");
}

import { inviteStaff, changeRole, setActive } from "@/modules/identity/team";

export async function inviteStaffAction(_: unknown, fd: FormData): Promise<{ error?: string; link?: string; email?: string }> {
  const ctx = await requireStaff("staff.manage");
  try {
    const r = await inviteStaff(ctx, { name: fd.get("name"), email: fd.get("email"), role: fd.get("role") });
    flushEmails();
    return { link: r.link, email: r.email };
  } catch (e) { return { error: msg(e) }; }
}
export async function changeRoleAction(fd: FormData) {
  const ctx = await requireStaff("staff.manage");
  try { await changeRole(ctx, String(fd.get("id")), String(fd.get("role"))); } catch (e) { return back("/team", e); }
  redirect("/team");
}
export async function setActiveAction(fd: FormData) {
  const ctx = await requireStaff("staff.manage");
  try { await setActive(ctx, String(fd.get("id")), fd.get("active") === "1"); } catch (e) { return back("/team", e); }
  redirect("/team");
}

import { retryFailed } from "@/modules/outbox/drain";
export async function retryEmailsAction() {
  const ctx = await requireStaff("staff.manage");
  await retryFailed(ctx.workspaceId);
  flushEmails();
  redirect("/team");
}

import { updateCompany, saveTermsDraft, publishTerms } from "@/modules/settings/service";

export async function updateCompanyAction(fd: FormData) {
  const ctx = await requireStaff("settings.write");
  try { await updateCompany(ctx, { legalName: fd.get("legalName") || undefined, companyNumber: fd.get("companyNumber") || undefined, registeredAddress: fd.get("registeredAddress") || undefined, vatNumber: fd.get("vatNumber") || undefined }); } catch (e) { return back("/settings", e); }
  redirect("/settings?saved=1");
}
export async function saveTermsAction(fd: FormData) {
  const ctx = await requireStaff("settings.write");
  const id = String(fd.get("id") || "") || null;
  let nid: string;
  try { nid = (await saveTermsDraft(ctx, id, { title: fd.get("title"), body: fd.get("body") })).id; } catch (e) { return back(id ? `/settings/terms/${id}` : "/settings/terms", e); }
  redirect(`/settings/terms/${nid}?saved=1`);
}
export async function publishTermsAction(fd: FormData) {
  const ctx = await requireStaff("settings.write");
  const id = String(fd.get("id"));
  try { await publishTerms(ctx, id); } catch (e) { return back(`/settings/terms/${id}`, e); }
  redirect("/settings/terms?published=1");
}
