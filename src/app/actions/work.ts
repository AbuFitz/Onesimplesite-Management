"use server";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireStaff } from "@/modules/identity/session";
import { transitionProject, postUpdate, requestAsset, addTask } from "@/modules/projects/service";
import { createEvent, cancelEvent, updateEvent } from "@/modules/calendar/service";
import { createNote, saveNote, archiveNote } from "@/modules/notes/service";
import { DomainError } from "@/lib/errors";
import { londonToUtc } from "@/lib/london";
import { flushEmails } from "@/lib/flush-email";

const msg = (e: unknown) => (e instanceof DomainError ? e.message : e instanceof ZodError ? e.issues.map((i) => i.message).join("; ") : "Something went wrong. Nothing was changed.");
const back = (path: string, e: unknown): never => redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(msg(e))}`);

export async function transitionAction(fd: FormData) {
  const ctx = await requireStaff("project.write");
  const id = String(fd.get("id"));
  try { await transitionProject(ctx, id, fd.get("stage") as never, Number(fd.get("version")), String(fd.get("reason") ?? "")); } catch (e) { return back(`/projects/${id}`, e); }
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
const EVENT_TYPES = ["internal_meeting", "client_call", "review", "focus", "other"] as const;
export async function updateEventAction(fd: FormData) {
  const ctx = await requireStaff("calendar.write");
  const id = String(fd.get("id")), date = String(fd.get("date") ?? ""), allDay = fd.get("allDay") === "on";
  const time = allDay ? "00:00" : String(fd.get("time") ?? "09:00"), mins = allDay ? 1440 : Math.min(1440, Math.max(5, Number(fd.get("minutes")) || 60));
  const view = ["week", "month"].includes(String(fd.get("view"))) ? `&view=${fd.get("view")}` : "", scope = fd.get("scope") === "team" ? "&scope=team" : "";
  const to = (q = "") => `/calendar?day=${date}${view}${scope}${q}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return redirect(`/calendar?error=${encodeURIComponent("Pick a date and time.")}`);
  const type = (EVENT_TYPES as readonly string[]).includes(String(fd.get("type"))) ? String(fd.get("type")) : "internal_meeting";
  try {
    const start = londonToUtc(date, time);
    await updateEvent(ctx, id, Number(fd.get("version")), { title: fd.get("title"), type, startsAt: start, endsAt: new Date(start.getTime() + mins * 60_000), location: fd.get("location") || undefined, customerId: String(fd.get("customerId") ?? "") || "" });
  } catch (e) { return redirect(to(`&edit=${id}&error=${encodeURIComponent(msg(e))}`)); }
  redirect(to(`&updated=1`));
}
export async function quickEventAction(fd: FormData) {
  const ctx = await requireStaff("calendar.write");
  const date = String(fd.get("date") ?? ""), allDay = fd.get("allDay") === "on";
  const time = allDay ? "00:00" : String(fd.get("time") ?? "09:00"), mins = allDay ? 1440 : Math.min(1440, Math.max(5, Number(fd.get("minutes")) || 60));
  const view = ["agenda", "week", "month"].includes(String(fd.get("view"))) ? `&view=${fd.get("view")}` : "", scope = fd.get("scope") === "team" ? "&scope=team" : "";
  const to = (q = "") => `/calendar?day=${date}${view}${scope}${q}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return redirect(`/calendar?add=1&error=${encodeURIComponent("Pick a date and time.")}`);
  const type = (EVENT_TYPES as readonly string[]).includes(String(fd.get("type"))) ? String(fd.get("type")) : "internal_meeting";
  try {
    const start = londonToUtc(date, time);
    await createEvent(ctx, { title: fd.get("title"), type, startsAt: start, endsAt: new Date(start.getTime() + mins * 60_000), location: fd.get("location") || undefined, customerId: String(fd.get("customerId") ?? "") || "", attendeeIds: [] });
  } catch (e) { return redirect(to(`&add=1&error=${encodeURIComponent(msg(e))}`)); }
  redirect(to(`&added=1`));
}
export async function cancelEventAction(fd: FormData) {
  const ctx = await requireStaff("calendar.write");
  const back2 = /^\/calendar[?\w=&-]*$/.test(String(fd.get("back") ?? "")) ? String(fd.get("back")) : "/calendar";
  try { await cancelEvent(ctx, String(fd.get("id")), Number(fd.get("version"))); } catch (e) { return back(back2, e); }
  redirect(back2);
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

import { inviteStaff, changeRole, setActive, setAlias } from "@/modules/identity/team";

export async function inviteStaffAction(_: unknown, fd: FormData): Promise<{ error?: string; link?: string; email?: string }> {
  const ctx = await requireStaff("staff.manage");
  try {
    const r = await inviteStaff(ctx, { name: fd.get("name"), email: fd.get("email"), role: fd.get("role") });
    flushEmails();
    return { link: r.link, email: r.email };
  } catch (e) { return { error: msg(e) }; }
}
export async function setAliasAction(fd: FormData) {
  const ctx = await requireStaff("staff.manage");
  try { await setAlias(ctx, String(fd.get("id")), String(fd.get("alias") ?? "")); } catch (e) { return back("/team", e); }
  redirect("/team");
}
export async function saveSettingsAction(fd: FormData) {
  const ctx = await requireStaff("settings.write");
  try { await saveSettings(ctx, Object.fromEntries([...fd.entries()].filter(([k]) => !k.startsWith("$")))); } catch (e) { return back("/settings/plans", e); }
  redirect("/settings/plans?saved=1");
}
export async function savePlanAction(fd: FormData) {
  const ctx = await requireStaff("settings.write");
  try { await savePlan(ctx, String(fd.get("id") || "") || null, { name: fd.get("name"), kind: fd.get("kind"), price: fd.get("price"), revisionsPerMonth: fd.get("revisionsPerMonth"), backupFrequency: fd.get("backupFrequency") ?? undefined, backupRetention: fd.get("backupRetention") ?? undefined, summary: fd.get("summary") ?? undefined, active: fd.get("active") === "on" }); } catch (e) { return back("/settings/plans", e); }
  redirect("/settings/plans?saved=1");
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
import { isLegalKind } from "@/modules/settings/legal-docs";
import { saveSettings, savePlan } from "@/modules/settings/plans";

export async function updateCompanyAction(fd: FormData) {
  const ctx = await requireStaff("settings.write");
  try { await updateCompany(ctx, { legalName: fd.get("legalName") || undefined, companyNumber: fd.get("companyNumber") || undefined, registeredAddress: fd.get("registeredAddress") || undefined, vatNumber: fd.get("vatNumber") || undefined }); } catch (e) { return back("/settings", e); }
  redirect("/settings?saved=1");
}
export async function saveLegalAction(_: unknown, fd: FormData): Promise<{ error?: string }> {
  const ctx = await requireStaff("settings.write");
  const kind = String(fd.get("kind") ?? "");
  if (!isLegalKind(kind)) return { error: "Unknown document." };
  const id = String(fd.get("id") || "") || null;
  let nid: string;
  try { nid = (await saveTermsDraft(ctx, id, { title: fd.get("title"), body: fd.get("body") }, kind)).id; } catch (e) { return { error: msg(e) }; }
  redirect(`/settings/legal/${kind}/${nid}?saved=1`);
}
export async function publishLegalAction(fd: FormData) {
  const ctx = await requireStaff("settings.write");
  const id = String(fd.get("id")), kind = String(fd.get("kind") ?? "terms");
  try { await publishTerms(ctx, id); } catch (e) { return back(`/settings/legal/${kind}/${id}`, e); }
  redirect(`/settings/legal/${kind}?published=1`);
}

