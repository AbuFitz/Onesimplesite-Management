import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { seedStageTasks, setTaskDone, markAssetReceived, addProjectFiles, setProjectFileShared, deleteProjectFile, STAGE_GUIDE, STAGE_ORDER } from "@/modules/projects/service";
import { projectFileList, readUploads, clientFile } from "@/modules/files/service";
import type { StaffCtx } from "@/modules/identity/session";
import type { ClientCtx } from "@/modules/portal/service";

const form = (files: [string, Buffer | string, string][]) => { const fd = new FormData(); for (const [n, b, t] of files) fd.append("files", new File([typeof b === "string" ? b : new Uint8Array(b)], n, { type: t })); return fd; };
async function world() {
  const w = await db.workspace.create({ data: { name: `pr-${Math.random()}` } });
  const m = await db.staffMembership.create({ data: { workspaceId: w.id, email: `s-${Math.random()}@example.test`, displayName: "Abukar", role: "owner", status: "active" } });
  const staff: StaffCtx = { userId: null as unknown as string, staffId: m.id, workspaceId: w.id, role: "owner", name: "Abukar", email: m.email };
  const mkC = async (n: string) => db.customer.create({ data: { workspaceId: w.id, reference: `OSS-CU-${Math.random().toString(36).slice(2, 8)}`, displayName: n } });
  const a = await mkC("Harbour"), b = await mkC("Quay");
  const project = await db.project.create({ data: { workspaceId: w.id, customerId: a.id, reference: `OSS-PJ-${Math.random().toString(36).slice(2, 8)}`, name: "Site", stage: "design", scopeSnapshot: "x" } });
  const client = (c: { id: string }): ClientCtx => ({ userId: `u-${c.id}`, name: "Hana", email: "h@x.test", memberships: [{ customerId: c.id, role: "admin", customer: { id: c.id, displayName: "x", workspaceId: w.id } }] });
  return { w, staff, a, b, project, ca: client(a), cb: client(b) };
}
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(30)]);
const ZIP = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(30)]);

describe("project delivery", () => {
  it("every stage has plain guidance and the stepper covers them in order", () => {
    for (const s of STAGE_ORDER) { expect(STAGE_GUIDE[s].now.length).toBeGreaterThan(20); expect(STAGE_GUIDE[s].tasks.length).toBeGreaterThan(1); }
  });
  it("adds the usual tasks for the stage once, never twice, and ticks them off", async () => {
    const x = await world();
    expect(await seedStageTasks(x.staff, x.project.id)).toBe(3);
    expect(await seedStageTasks(x.staff, x.project.id)).toBe(0);
    const t = await db.task.findFirstOrThrow({ where: { projectId: x.project.id } });
    await setTaskDone(x.staff, t.id, true); expect((await db.task.findUniqueOrThrow({ where: { id: t.id } })).doneAt).toBeTruthy();
    await setTaskDone(x.staff, t.id, false); expect((await db.task.findUniqueOrThrow({ where: { id: t.id } })).doneAt).toBeNull();
  });
  it("marks customer material received and back", async () => {
    const x = await world();
    const a = await db.assetRequest.create({ data: { workspaceId: x.w.id, projectId: x.project.id, label: "Logo", required: true } });
    await markAssetReceived(x.staff, a.id, true); expect((await db.assetRequest.findUniqueOrThrow({ where: { id: a.id } })).receivedAt).toBeTruthy();
    await markAssetReceived(x.staff, a.id, false); expect((await db.assetRequest.findUniqueOrThrow({ where: { id: a.id } })).receivedAt).toBeNull();
  });
});

describe("project files", () => {
  it("accepts office/zip/text files for projects only, and still refuses HTML and unknown types", async () => {
    expect((await readUploads(form([["brief.docx", ZIP, "application/octet-stream"]]), "files", { extra: true }))[0]).toMatchObject({ type: "application/zip", name: "brief.docx" });
    expect((await readUploads(form([["notes.txt", "Opening hours: 9 to 5", "text/plain"]]), "files", { extra: true }))[0].type).toBe("text/plain");
    await expect(readUploads(form([["x.docx", ZIP, "application/zip"]]))).rejects.toThrow(/PNG, JPG/);                          // tickets still image/PDF only
    await expect(readUploads(form([["page.html", "<html><script>alert(1)</script></html>", "text/html"]]), "files", { extra: true })).rejects.toThrow(/can accept/);
    await expect(readUploads(form([["blob.bin", Buffer.from([0, 1, 2, 3, 0, 5]), "application/octet-stream"]]), "files", { extra: true })).rejects.toThrow(/can accept/);
  });
  it("team-only by default; sharing makes it visible to that customer and nobody else; unsharing and deleting work; folders are kept", async () => {
    const x = await world();
    await addProjectFiles(x.staff, x.project.id, await readUploads(form([["design.png", PNG, "image/png"]]), "files", { extra: true }), { folder: "Design", shared: false });
    await addProjectFiles(x.staff, x.project.id, await readUploads(form([["menu.pdf", "%PDF-1.4 hello", "application/pdf"]]), "files", { extra: true }), { shared: true });
    const all = await projectFileList(x.project.id, true);
    expect(all).toHaveLength(2); expect(all.find((f) => f.filename === "design.png")).toMatchObject({ internal: true, folder: "Design" });
    expect((await projectFileList(x.project.id, false)).map((f) => f.filename)).toEqual(["menu.pdf"]);
    const design = all.find((f) => f.filename === "design.png")!, menu = all.find((f) => f.filename === "menu.pdf")!;
    await expect(clientFile(x.ca, design.id)).rejects.toMatchObject({ code: "not_found" });         // team-only
    expect((await clientFile(x.ca, menu.id)).id).toBe(menu.id);                                       // shared, their own business
    await expect(clientFile(x.cb, menu.id)).rejects.toMatchObject({ code: "not_found" });            // another business can't open it
    await setProjectFileShared(x.staff, design.id, true); expect((await clientFile(x.ca, design.id)).id).toBe(design.id);
    await setProjectFileShared(x.staff, design.id, false); await expect(clientFile(x.ca, design.id)).rejects.toThrow();
    await deleteProjectFile(x.staff, menu.id); expect(await db.attachment.count({ where: { projectId: x.project.id } })).toBe(1);
    await expect(addProjectFiles(x.staff, x.project.id, [], { shared: false })).rejects.toThrow(/Choose a file/);
  });
});

import { transitionProject, setProjectType, typeOf, PROJECT_TYPES, ALLOWED } from "@/modules/projects/service";
describe("flexible project flow", () => {
  it("any stage can move to any other, forwards, backwards or skipping; only reopening a finished project needs a reason", async () => {
    const x = await world();
    const stage = async () => (await db.project.findUniqueOrThrow({ where: { id: x.project.id } }));
    const go = async (to: string, reason?: string) => transitionProject(x.staff, x.project.id, to as never, (await stage()).version, reason);
    await go("launched");                                         // skipped everything in between
    await go("design");                                           // and straight back
    await go("held"); await go("development");                    // pause and resume
    await go("completed");
    await expect(go("qa")).rejects.toThrow(/Say why/);            // finished: needs a reason
    await go("qa", "Customer found a bug after launch");
    expect((await stage()).stage).toBe("qa");
    await expect(go("qa")).rejects.toThrow(/already at that stage/);
    const log = await db.auditEvent.findMany({ where: { targetId: x.project.id, action: "project.stage" }, orderBy: { createdAt: "asc" } });
    expect(log).toHaveLength(6); expect((log.at(-1)!.detail as { reason?: string }).reason).toMatch(/bug/);
    expect(Object.values(ALLOWED).every((t) => t.length === 10)).toBe(true);
  });
  it("project types change the steps and the usual tasks, never delete anything", async () => {
    const x = await world();
    expect(typeOf("hosting_only").stages).not.toContain("design"); expect(typeOf("nonsense").label).toBe("New website");
    await setProjectType(x.staff, x.project.id, "revamp");
    await db.project.update({ where: { id: x.project.id }, data: { stage: "planned" } });
    await seedStageTasks(x.staff, x.project.id);
    const titles = (await db.task.findMany({ where: { projectId: x.project.id } })).map((t) => t.title);
    expect(titles).toContain("Back up the current site"); expect(titles).toContain("Send the welcome email and book the kick-off call");
    await setProjectType(x.staff, x.project.id, "hosting_only");
    expect((await db.task.count({ where: { projectId: x.project.id } }))).toBe(titles.length);
    await expect(setProjectType(x.staff, x.project.id, "bogus")).rejects.toThrow(/Pick a type/);
    for (const t of Object.values(PROJECT_TYPES)) expect(t.stages.length).toBeGreaterThan(1);
  });
});
