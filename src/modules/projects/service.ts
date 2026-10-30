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
