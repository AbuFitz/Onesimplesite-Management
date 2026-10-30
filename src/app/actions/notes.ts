"use server";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireStaff } from "@/modules/identity/session";
import { createNote, saveNote, archiveNote } from "@/modules/notes/service";
import { DomainError } from "@/lib/errors";

export async function newPageAction() {
  const ctx = await requireStaff("notes.write");
  const n = await createNote(ctx, { title: "Untitled", body: "", visibility: "team" });
  redirect(`/notes/${n.id}`);
}

export type AutosaveResult = { version: number } | { conflict: true } | { error: string };

/** Called by the editor as people type. Never overwrites a newer version: that is reported as a conflict. */
export async function autosaveNoteAction(id: string, expectedVersion: number, data: { title: string; body: string; visibility: "team" | "private" }): Promise<AutosaveResult> {
  const ctx = await requireStaff("notes.write");
  try {
    return { version: await saveNote(ctx, id, expectedVersion, { title: data.title.trim() || "Untitled", body: data.body, visibility: data.visibility }) };
  } catch (e) {
    if (e instanceof DomainError && e.code === "stale_version") return { conflict: true };
    if (e instanceof DomainError) return { error: e.message };
    if (e instanceof ZodError) return { error: "That page is too long to save." };
    return { error: "Could not save. Your text is still here." };
  }
}

export async function archivePageAction(fd: FormData) {
  const ctx = await requireStaff("notes.write");
  try { await archiveNote(ctx, String(fd.get("id"))); } catch { /* already gone */ }
  redirect("/notes");
}
