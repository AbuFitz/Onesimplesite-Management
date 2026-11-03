import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { DomainError, forbidden, notFound, stale } from "@/lib/errors";
import { can } from "@/modules/identity/permissions";
import type { StaffCtx } from "@/modules/identity/session";
import type { ProjectStage } from "@/generated/prisma/enums";

export const ALLOWED: Record<ProjectStage, ProjectStage[]> = {
  planned: ["awaiting_assets", "design", "held", "cancelled"],
  awaiting_assets: ["design", "held", "cancelled"],
  design: ["development", "awaiting_assets", "held", "cancelled"],
  development: ["qa", "design", "held", "cancelled"],
  qa: ["client_review", "development", "held", "cancelled"],
  client_review: ["ready_to_launch", "design", "development", "held", "cancelled"],
  ready_to_launch: ["launched", "client_review", "held", "cancelled"],
  launched: ["completed", "held"],
  completed: [],
  held: ["planned", "awaiting_assets", "design", "development", "qa", "client_review", "ready_to_launch", "cancelled"],
  cancelled: [],
};

/** Project access: all-project capability or ownership; delivery staff see assigned work only. */
export function projectWhere(ctx: StaffCtx) {
  if (can(ctx.role, "project.read_all")) return { workspaceId: ctx.workspaceId };
  if (can(ctx.role, "project.read_assigned")) return { workspaceId: ctx.workspaceId, ownerId: ctx.staffId };
  throw forbidden();
}

export async function getProject(ctx: StaffCtx, id: string) {
  return db.project.findFirst({
    where: { id, ...projectWhere(ctx) },
    include: { customer: true, updates: { orderBy: { createdAt: "desc" } }, assetRequests: { orderBy: { createdAt: "asc" } }, tasks: { orderBy: { createdAt: "asc" } } },
  });
}

export async function transitionProject(ctx: StaffCtx, id: string, to: ProjectStage, expectedVersion: number, overrideReason?: string) {
  if (!can(ctx.role, "project.write")) throw forbidden();
  return db.$transaction(async (tx) => {
    const p = await tx.project.findFirst({ where: { id, ...projectWhere(ctx) } });
    if (!p) throw notFound();
    const allowed = ALLOWED[p.stage].includes(to);
    if (!allowed && !(ctx.role === "owner" && overrideReason?.trim())) throw new DomainError("validation", `Cannot move from ${p.stage} to ${to}. An owner can override with a reason.`);
    const r = await tx.project.updateMany({ where: { id, version: expectedVersion }, data: { stage: to, version: { increment: 1 } } });
    if (r.count === 0) throw stale();
    await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "project.stage", targetType: "project", targetId: id, customerId: p.customerId, detail: { from: p.stage, to, override: allowed ? undefined : overrideReason } });
  });
}

const updateInput = z.object({ body: z.string().trim().min(1).max(5000), clientVisible: z.boolean() });
export async function postUpdate(ctx: StaffCtx, projectId: string, raw: unknown) {
  if (!can(ctx.role, "project.write")) throw forbidden();
  const i = updateInput.parse(raw);
  const p = await db.project.findFirst({ where: { id: projectId, ...projectWhere(ctx) } });
  if (!p) throw notFound();
  await db.$transaction(async (tx) => {
    await tx.projectUpdate.create({ data: { workspaceId: ctx.workspaceId, projectId, body: i.body, clientVisible: i.clientVisible, authorId: ctx.staffId } });
    await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: i.clientVisible ? "project.update_client_visible" : "project.update_internal", targetType: "project", targetId: projectId, customerId: p.customerId });
  });
}

const assetInput = z.object({ label: z.string().trim().min(1).max(120), required: z.boolean(), dueDate: z.coerce.date().optional() });
const FORBIDDEN_ASSET = /password|passcode|secret|api key/i;
export async function requestAsset(ctx: StaffCtx, projectId: string, raw: unknown) {
  if (!can(ctx.role, "project.write")) throw forbidden();
  const i = assetInput.parse(raw);
  if (FORBIDDEN_ASSET.test(i.label)) throw new DomainError("validation", "Never request passwords or secrets here. Use an approved secret-sharing route.");
  const p = await db.project.findFirst({ where: { id: projectId, ...projectWhere(ctx) } });
  if (!p) throw notFound();
  await db.assetRequest.create({ data: { workspaceId: ctx.workspaceId, projectId, label: i.label, required: i.required, dueDate: i.dueDate ?? null } });
}

export async function addTask(ctx: StaffCtx, projectId: string, title: string, dueDate?: string) {
  if (!can(ctx.role, "project.write")) throw forbidden();
  const p = await db.project.findFirst({ where: { id: projectId, ...projectWhere(ctx) } });
  if (!p) throw notFound();
  z.string().trim().min(1).max(200).parse(title);
  await db.task.create({ data: { workspaceId: ctx.workspaceId, projectId, customerId: p.customerId, title, assigneeId: p.ownerId ?? ctx.staffId, dueDate: dueDate ? new Date(dueDate) : null } });
}

// ───────── Delivery: what to do at each stage, the checklist, and files ─────────
/** What the team does at each stage, in plain words. The suggested tasks are added with one button and never duplicated. */
export const STAGE_GUIDE: Record<string, { label: string; now: string; tasks: string[] }> = {
  planned: { label: "Planning", now: "Get the project ready to start: confirm what we're building and when, and ask for what we need.", tasks: ["Send the welcome email and book the kick-off call", "Confirm the domain and hosting plan", "Ask for logo, colours and photos"] },
  awaiting_assets: { label: "Waiting for their material", now: "We can't design without their content. Chase what's missing and check it's usable.", tasks: ["Chase the outstanding material", "Check the logo and photos are good enough quality"] },
  design: { label: "Design", now: "Design the pages and share them for feedback before building.", tasks: ["Design the homepage", "Share the design with the customer", "Make changes from their feedback"] },
  development: { label: "Build", now: "Build the site, set up forms and email, and connect the domain.", tasks: ["Build the pages", "Set up the contact form and email", "Connect the domain and hosting", "Add privacy and cookie pages"] },
  qa: { label: "Testing", now: "Check everything works before the customer sees it.", tasks: ["Test on a phone and a desktop", "Test every form and link", "Check page speed and basic SEO"] },
  client_review: { label: "Customer review", now: "The customer checks the site. Collect their feedback and get a clear yes.", tasks: ["Send the review link", "Make the changes they ask for", "Get their written approval"] },
  ready_to_launch: { label: "Ready to launch", now: "Take the final payment and put the site live.", tasks: ["Confirm the final payment is in", "Switch the domain over", "Check the live site", "Tell the customer it's live"] },
  launched: { label: "Live", now: "It's live. Make sure it's looked after, then hand over.", tasks: ["Add it to backups and monitoring", "Hand over logins safely", "Confirm the care plan is running"] },
};
export const STAGE_ORDER = ["planned", "awaiting_assets", "design", "development", "qa", "client_review", "ready_to_launch", "launched"] as const;

const own = async (ctx: StaffCtx, id: string) => { if (!can(ctx.role, "project.write")) throw forbidden(); const p = await db.project.findFirst({ where: { id, ...projectWhere(ctx) } }); if (!p) throw notFound(); return p; };

export async function seedStageTasks(ctx: StaffCtx, projectId: string) {
  const p = await own(ctx, projectId);
  const guide = STAGE_GUIDE[p.stage];
  if (!guide) return 0;
  const have = new Set((await db.task.findMany({ where: { projectId }, select: { title: true } })).map((t) => t.title));
  const fresh = guide.tasks.filter((t) => !have.has(t));
  if (fresh.length) await db.task.createMany({ data: fresh.map((title) => ({ workspaceId: ctx.workspaceId, projectId, customerId: p.customerId, title, assigneeId: p.ownerId ?? ctx.staffId })) });
  return fresh.length;
}

export async function setTaskDone(ctx: StaffCtx, taskId: string, done: boolean) {
  if (!can(ctx.role, "project.write")) throw forbidden();
  const t = await db.task.findFirst({ where: { id: taskId, workspaceId: ctx.workspaceId }, select: { id: true, projectId: true } });
  if (!t?.projectId) throw notFound();
  await own(ctx, t.projectId);
  await db.task.update({ where: { id: taskId }, data: { doneAt: done ? new Date() : null } });
}

export async function markAssetReceived(ctx: StaffCtx, assetId: string, received: boolean) {
  if (!can(ctx.role, "project.write")) throw forbidden();
  const a = await db.assetRequest.findFirst({ where: { id: assetId, workspaceId: ctx.workspaceId }, select: { id: true, projectId: true } });
  if (!a) throw notFound();
  await own(ctx, a.projectId);
  await db.assetRequest.update({ where: { id: assetId }, data: { receivedAt: received ? new Date() : null } });
}

/** Upload files to a project. Internal by default; tick "share" and the customer sees them in their portal. */
export async function addProjectFiles(ctx: StaffCtx, projectId: string, files: import("@/modules/files/service").Upload[], o: { folder?: string; shared: boolean }) {
  const p = await own(ctx, projectId);
  if (!files.length) throw new DomainError("validation", "Choose a file first.");
  const folder = (o.folder ?? "").trim().slice(0, 60) || null;
  const { saveUploads } = await import("@/modules/files/service");
  await db.$transaction(async (tx) => {
    await saveUploads(tx, { workspaceId: ctx.workspaceId, customerId: p.customerId, projectId, folder, internal: !o.shared, by: "staff", name: ctx.name }, files);
    await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "project.files_added", targetType: "project", targetId: projectId, customerId: p.customerId, detail: { count: files.length, shared: o.shared, folder } });
  });
}

export async function setProjectFileShared(ctx: StaffCtx, fileId: string, shared: boolean) {
  if (!can(ctx.role, "project.write")) throw forbidden();
  const f = await db.attachment.findFirst({ where: { id: fileId, workspaceId: ctx.workspaceId, projectId: { not: null } }, select: { id: true, projectId: true } });
  if (!f?.projectId) throw notFound();
  await own(ctx, f.projectId);
  await db.attachment.update({ where: { id: fileId }, data: { internal: !shared } });
}

export async function deleteProjectFile(ctx: StaffCtx, fileId: string) {
  if (!can(ctx.role, "project.write")) throw forbidden();
  const f = await db.attachment.findFirst({ where: { id: fileId, workspaceId: ctx.workspaceId, projectId: { not: null } }, select: { id: true, projectId: true } });
  if (!f?.projectId) throw notFound();
  await own(ctx, f.projectId);
  await db.attachment.delete({ where: { id: fileId } });
}
