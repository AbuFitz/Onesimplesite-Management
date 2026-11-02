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
    if (n.ownerId !== ctx.staffId && ctx.role !== "owner") throw forbidden("Only the person who posted this can edit it. You can comment instead.");
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


// ───────── Team Board: a feed of posts with comments ─────────
export type BoardFilter = "all" | "mine" | "pinned" | "private";

export async function listPosts(ctx: StaffCtx, o: { q?: string; filter?: BoardFilter }) {
  const f = o.filter ?? "all";
  const where = {
    AND: [
      visibleNotes(ctx),
      f === "mine" ? { ownerId: ctx.staffId } : f === "pinned" ? { pinned: true } : f === "private" ? { visibility: "private", ownerId: ctx.staffId } : {},
      o.q?.trim() ? { OR: [{ title: { contains: o.q.trim(), mode: "insensitive" as const } }, { body: { contains: o.q.trim(), mode: "insensitive" as const } }] } : {},
    ],
  };
  const posts = await db.note.findMany({ where, orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }], take: 100, include: { _count: { select: { comments: true } } } });
  const authors = await db.staffMembership.findMany({ where: { workspaceId: ctx.workspaceId, id: { in: [...new Set(posts.map((p) => p.ownerId))] } }, select: { id: true, displayName: true, jobTitle: true } });
  const by = new Map(authors.map((a) => [a.id, a]));
  return posts.map((p) => ({ ...p, author: by.get(p.ownerId) ?? { id: p.ownerId, displayName: "Former team member", jobTitle: null } }));
}

export async function getPostWithComments(ctx: StaffCtx, id: string) {
  const post = await getNote(ctx, id);
  if (!post) return null;
  const comments = await db.noteComment.findMany({ where: { noteId: id, workspaceId: ctx.workspaceId }, orderBy: { createdAt: "asc" } });
  const ids = [...new Set([post.ownerId, ...comments.map((c) => c.authorId)])];
  const people = await db.staffMembership.findMany({ where: { workspaceId: ctx.workspaceId, id: { in: ids } }, select: { id: true, displayName: true, jobTitle: true } });
  const by = new Map(people.map((a) => [a.id, a]));
  const who = (id: string) => by.get(id) ?? { id, displayName: "Former team member", jobTitle: null };
  return { post, author: who(post.ownerId), comments: comments.map((c) => ({ ...c, author: who(c.authorId) })) };
}

const postInput = z.object({ title: z.string().trim().max(200).optional().transform((v) => v || ""), body: z.string().trim().min(1, "Write something to post.").max(100_000), visibility: z.enum(["team", "private"]).default("team") });

/** A quick post from the feed. The title is optional: it falls back to the first line. */
export async function createPost(ctx: StaffCtx, raw: unknown) {
  if (!can(ctx.role, "notes.write")) throw forbidden();
  const i = postInput.parse(raw);
  const title = i.title || i.body.split("\n")[0].replace(/^[#>\-*\s]+/, "").slice(0, 80) || "Untitled";
  return db.note.create({ data: { workspaceId: ctx.workspaceId, ownerId: ctx.staffId, title, body: i.body, visibility: i.visibility } });
}

const canManage = (ctx: StaffCtx, ownerId: string) => ownerId === ctx.staffId || ctx.role === "owner";

export async function deletePost(ctx: StaffCtx, id: string) {
  const n = await getNote(ctx, id);
  if (!n) throw notFound();
  if (!canManage(ctx, n.ownerId)) throw forbidden("Only the person who posted this, or an owner, can delete it.");
  await db.$transaction(async (tx) => {
    await tx.note.delete({ where: { id } });
    await tx.auditEvent.create({ data: { workspaceId: ctx.workspaceId, actorId: ctx.userId, actorLabel: ctx.name, action: "board.post_deleted", targetType: "note", targetId: id, visibility: "internal", detail: { title: n.title } } });
  });
}

export async function setPinned(ctx: StaffCtx, id: string, pinned: boolean) {
  const n = await getNote(ctx, id);
  if (!n) throw notFound();
  if (!canManage(ctx, n.ownerId)) throw forbidden("Only the person who posted this, or an owner, can pin it.");
  await db.note.update({ where: { id }, data: { pinned } });
}

export async function addComment(ctx: StaffCtx, noteId: string, body: unknown) {
  if (!can(ctx.role, "notes.write")) throw forbidden();
  const text = z.string().trim().min(1, "Write a comment first.").max(5000).parse(body);
  if (!(await getNote(ctx, noteId))) throw notFound();
  return db.$transaction(async (tx) => {
    const c = await tx.noteComment.create({ data: { workspaceId: ctx.workspaceId, noteId, authorId: ctx.staffId, body: text } });
    await tx.note.update({ where: { id: noteId }, data: { updatedAt: new Date() } }); // a new comment brings the post back to the top
    return c;
  });
}

export async function deleteComment(ctx: StaffCtx, commentId: string) {
  const c = await db.noteComment.findFirst({ where: { id: commentId, workspaceId: ctx.workspaceId } });
  if (!c || !(await getNote(ctx, c.noteId))) throw notFound();
  if (!canManage(ctx, c.authorId)) throw forbidden("Only the author, or an owner, can delete a comment.");
  await db.noteComment.delete({ where: { id: commentId } });
}
