import { z } from "zod";
import { db } from "@/lib/db";
import { DomainError, forbidden, notFound, stale } from "@/lib/errors";
import { can } from "@/modules/identity/permissions";
import type { StaffCtx } from "@/modules/identity/session";

/** Team-visible notes or my own private ones. Private titles/snippets never leak to others. */
export const visibleNotes = (ctx: StaffCtx) => ({ workspaceId: ctx.workspaceId, archivedAt: null, OR: [{ visibility: "team" }, { ownerId: ctx.staffId }] });

export async function getNote(ctx: StaffCtx, id: string) {
  return db.note.findFirst({ where: { id, ...visibleNotes(ctx) } });
}

const noteInput = z.object({ title: z.string().trim().min(1).max(200), body: z.string().max(100_000), visibility: z.enum(["team", "private"]).default("team") });

export async function createNote(ctx: StaffCtx, raw: unknown, link?: { customerId?: string; projectId?: string }) {
  if (!can(ctx.role, "notes.write")) throw forbidden();
  const i = noteInput.parse(raw);
  if (link?.customerId && !(await db.customer.findFirst({ where: { id: link.customerId, workspaceId: ctx.workspaceId } }))) throw notFound("Customer not found.");
  return db.note.create({ data: { workspaceId: ctx.workspaceId, ownerId: ctx.staffId, ...i, customerId: link?.customerId ?? null, projectId: link?.projectId ?? null } });
}

/** Optimistic version check plus a revision per save; never silently overwrites another editor. */
export async function saveNote(ctx: StaffCtx, id: string, expectedVersion: number, raw: unknown) {
  if (!can(ctx.role, "notes.write")) throw forbidden();
  const i = noteInput.parse(raw);
  return db.$transaction(async (tx) => {
    const n = await tx.note.findFirst({ where: { id, ...visibleNotes(ctx) } });
    if (!n) throw notFound();
    if (n.visibility === "private" && n.ownerId !== ctx.staffId) throw forbidden();
    const r = await tx.note.updateMany({ where: { id, version: expectedVersion }, data: { title: i.title, body: i.body, visibility: n.ownerId === ctx.staffId ? i.visibility : n.visibility, version: { increment: 1 } } });
    if (r.count === 0) throw stale();
    await tx.noteRevision.create({ data: { noteId: id, version: expectedVersion, title: n.title, body: n.body, actorId: ctx.staffId } });
    return expectedVersion + 1;
  });
}

export async function archiveNote(ctx: StaffCtx, id: string) {
  const n = await getNote(ctx, id);
  if (!n) throw notFound();
  if (n.ownerId !== ctx.staffId && ctx.role !== "owner") throw new DomainError("forbidden", "Only the owner can archive this note.");
  await db.note.update({ where: { id }, data: { archivedAt: new Date() } });
}
