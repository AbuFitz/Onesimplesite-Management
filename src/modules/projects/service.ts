import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { DomainError, forbidden, notFound, stale } from "@/lib/errors";
import { can } from "@/modules/identity/permissions";
import { requestBalance } from "@/modules/billing/service";
import type { StaffCtx } from "@/modules/identity/session";
import type { ProjectStage } from "@/generated/prisma/enums";

const ALL_STAGES: ProjectStage[] = ["planned", "awaiting_assets", "design", "development", "qa", "client_review", "ready_to_launch", "launched", "completed", "held", "cancelled"];
/**
 * Every real project is different (a Shopify storefront revamp has no brand-new design, a hosting move has no review), so a project can move
 * to ANY other stage, forwards, backwards or sideways. The only rule: bringing back a finished or cancelled project needs a reason.
 */
export const ALLOWED: Record<ProjectStage, ProjectStage[]> = Object.fromEntries(ALL_STAGES.map((s) => [s, ALL_STAGES.filter((t) => t !== s)])) as Record<ProjectStage, ProjectStage[]>;
const TERMINAL: ProjectStage[] = ["completed", "cancelled"];

/** The kinds of project we run. Each decides which stages show on the progress bar and which usual tasks are suggested. */
export const PROJECT_TYPES: Record<string, { label: string; hint: string; stages: ProjectStage[]; extra: Partial<Record<ProjectStage, string[]>> }> = {
  new_site: { label: "New website", hint: "A brand-new site, from brief to launch.", stages: ["planned", "awaiting_assets", "design", "development", "qa", "client_review", "ready_to_launch", "launched"], extra: {} },
  revamp: { label: "Revamp an existing site", hint: "A new look or rebuild of something they already have, such as a Shopify storefront.", stages: ["planned", "awaiting_assets", "design", "development", "qa", "client_review", "ready_to_launch", "launched"],
    extra: { planned: ["Review the current site and what to keep", "Back up the current site", "Get access to their current platform (never by email)"], development: ["Move over content and products worth keeping", "Set up redirects from the old pages"], ready_to_launch: ["Check the old links redirect properly"] } },
  shop: { label: "Online shop", hint: "A site that sells things, with payments.", stages: ["planned", "awaiting_assets", "design", "development", "qa", "client_review", "ready_to_launch", "launched"],
    extra: { awaiting_assets: ["Collect product photos, names and prices"], development: ["Set up the shop and payments", "Add delivery and returns details", "Test a real order from start to finish"], qa: ["Test checkout on a phone"] } },
  hosting_only: { label: "Hosting and move-over", hint: "We host or move an existing site. No design stage.", stages: ["planned", "development", "qa", "ready_to_launch", "launched"],
    extra: { planned: ["Get the site files and access safely"], development: ["Move the site to our hosting", "Set up backups and monitoring"], ready_to_launch: ["Point the domain at the new hosting"] } },
  care: { label: "Ongoing care only", hint: "No build. Just looking after a site.", stages: ["planned", "launched"], extra: { planned: ["Add the site to monitoring and backups", "Confirm the care plan and what's included"] } },
  custom: { label: "Something else", hint: "Use whichever stages you need. Everything is available.", stages: ["planned", "awaiting_assets", "design", "development", "qa", "client_review", "ready_to_launch", "launched"], extra: {} },
};
export const typeOf = (t?: string | null) => PROJECT_TYPES[t ?? ""] ?? PROJECT_TYPES.new_site;

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

export async function transitionProject(ctx: StaffCtx, id: string, to: ProjectStage, expectedVersion: number, reason?: string) {
  if (!can(ctx.role, "project.write")) throw forbidden();
  if (!ALL_STAGES.includes(to)) throw new DomainError("validation", "Pick a stage.");
  return db.$transaction(async (tx) => {
    const p = await tx.project.findFirst({ where: { id, ...projectWhere(ctx) } });
    if (!p) throw notFound();
    if (p.stage === to) throw new DomainError("validation", "It's already at that stage.");
    if (TERMINAL.includes(p.stage) && !reason?.trim()) throw new DomainError("validation", "This project is finished. Say why you're reopening it.");
    const r = await tx.project.updateMany({ where: { id, version: expectedVersion }, data: { stage: to, version: { increment: 1 } } });
    if (r.count === 0) throw stale();
    // When the site is ready to launch, the final payment is asked for automatically.
    if (to === "ready_to_launch" && p.contractId) await requestBalance(tx, ctx.workspaceId, p.contractId, { userId: ctx.userId, label: ctx.name });
    const order = typeOf(p.workType).stages;
    await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "project.stage", targetType: "project", targetId: id, customerId: p.customerId, detail: { from: p.stage, to, reason: reason?.trim() || undefined, skipped: order.slice(order.indexOf(p.stage) + 1, order.indexOf(to)).length > 0 && order.indexOf(to) > order.indexOf(p.stage) ? order.slice(order.indexOf(p.stage) + 1, order.indexOf(to)) : undefined } });
  });
}

export async function setProjectType(ctx: StaffCtx, id: string, type: string) {
  if (!can(ctx.role, "project.write")) throw forbidden();
  if (!PROJECT_TYPES[type]) throw new DomainError("validation", "Pick a type of project.");
  const p = await db.project.findFirst({ where: { id, ...projectWhere(ctx) } });
  if (!p) throw notFound();
  await db.$transaction(async (tx) => {
    await tx.project.update({ where: { id }, data: { workType: type } });
    await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "project.type", targetType: "project", targetId: id, customerId: p.customerId, detail: { from: p.workType, to: type } });
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
  const fresh = [...guide.tasks, ...(typeOf(p.workType).extra[p.stage] ?? [])].filter((t) => !have.has(t));
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

export async function removeAssetRequest(ctx: StaffCtx, assetId: string) {
  if (!can(ctx.role, "project.write")) throw forbidden();
  const a = await db.assetRequest.findFirst({ where: { id: assetId, workspaceId: ctx.workspaceId }, select: { projectId: true } });
  if (!a) throw notFound();
  await own(ctx, a.projectId);
  await db.assetRequest.delete({ where: { id: assetId } });
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
