"use server";
import { ZodError } from "zod";
import { requireStaff } from "@/modules/identity/session";
import { saveNote } from "@/modules/notes/service";
import { DomainError } from "@/lib/errors";

export type AutosaveResult = { version: number } | { conflict: true } | { error: string };

/** Called by the post editor as people type. Never overwrites a newer version: that is reported as a conflict. */
export async function autosaveNoteAction(id: string, expectedVersion: number, data: { title: string; body: string; visibility: "team" | "private" }): Promise<AutosaveResult> {
  const ctx = await requireStaff("notes.write");
  try {
    return { version: await saveNote(ctx, id, expectedVersion, { title: data.title.trim() || "Untitled", body: data.body, visibility: data.visibility }) };
  } catch (e) {
    if (e instanceof DomainError && e.code === "stale_version") return { conflict: true };
    if (e instanceof DomainError) return { error: e.message };
    if (e instanceof ZodError) return { error: "That post is too long to save." };
    return { error: "Could not save. Your text is still here." };
  }
}
