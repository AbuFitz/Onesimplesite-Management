"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireStaff } from "@/modules/identity/session";
import { setProjectType, seedStageTasks, setTaskDone, markAssetReceived, removeAssetRequest, addProjectFiles, setProjectFileShared, deleteProjectFile } from "@/modules/projects/service";
import { readUploads } from "@/modules/files/service";
import { DomainError } from "@/lib/errors";

const why = (e: unknown) => (e instanceof DomainError ? e.message : e instanceof ZodError ? e.issues.map((i) => i.message).join(" ") : "Something went wrong and nothing was saved.");
async function run(fd: FormData, fn: (ctx: Awaited<ReturnType<typeof requireStaff>>) => Promise<unknown>) {
  const ctx = await requireStaff("project.write");
  const id = String(fd.get("id"));
  // Stay on the section you were in: the tab is read from the page the form was sent from.
  let tab = ""; try { const t = new URL((await headers()).get("referer") ?? "").searchParams.get("tab"); if (t && /^[a-z]+$/.test(t)) tab = t; } catch { /* no referer */ }
  const back = `/projects/${id}${tab ? `?tab=${tab}` : ""}`;
  try { await fn(ctx); } catch (e) { redirect(`${back}${tab ? "&" : "?"}error=${encodeURIComponent(why(e))}`); }
  revalidatePath(`/projects/${id}`);
  redirect(back);
}
export async function seedTasksAction(fd: FormData) { return run(fd, (c) => seedStageTasks(c, String(fd.get("id")))); }
export async function toggleTaskAction(fd: FormData) { return run(fd, (c) => setTaskDone(c, String(fd.get("taskId")), fd.get("done") === "1")); }
export async function removeAssetAction(fd: FormData) { return run(fd, (c) => removeAssetRequest(c, String(fd.get("assetId")))); }
export async function receiveAssetAction(fd: FormData) { return run(fd, (c) => markAssetReceived(c, String(fd.get("assetId")), fd.get("received") === "1")); }
export async function uploadProjectFilesAction(fd: FormData) { return run(fd, async (c) => addProjectFiles(c, String(fd.get("id")), await readUploads(fd, "files", { extra: true }), { folder: String(fd.get("folder") ?? ""), shared: fd.get("shared") === "on" })); }
export async function shareFileAction(fd: FormData) { return run(fd, (c) => setProjectFileShared(c, String(fd.get("fileId")), fd.get("shared") === "1")); }
export async function deleteFileAction(fd: FormData) { return run(fd, (c) => deleteProjectFile(c, String(fd.get("fileId")))); }
export async function projectTypeAction(fd: FormData) { return run(fd, (c) => setProjectType(c, String(fd.get("id")), String(fd.get("type")))); }
