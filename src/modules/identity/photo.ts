import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import type { StaffCtx } from "./session";

const sniff = (b: Buffer) => (b[0] === 0xff && b[1] === 0xd8 ? "image/jpeg" : b.subarray(0, 4).toString("latin1") === "\x89PNG" ? "image/png" : b.subarray(8, 12).toString("latin1") === "WEBP" ? "image/webp" : null);

/** Everyone can set their own picture. It's shrunk in the browser first, so the limit here is a safety net. */
export async function setMyPhoto(ctx: StaffCtx, file: File | null) {
  if (!file || file.size === 0) throw new DomainError("validation", "Choose a picture first.");
  if (file.size > 400_000) throw new DomainError("validation", "That picture is too big. Try a smaller one.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const type = sniff(bytes);
  if (!type) throw new DomainError("validation", "Use a JPG, PNG or WebP picture.");
  await db.staffMembership.update({ where: { id: ctx.staffId }, data: { photo: new Uint8Array(bytes), photoType: type } });
}
export const removeMyPhoto = (ctx: StaffCtx) => db.staffMembership.update({ where: { id: ctx.staffId }, data: { photo: null, photoType: null } });

export async function staffPhoto(id: string, workspaceId?: string) {
  const m = await db.staffMembership.findFirst({ where: { id, ...(workspaceId ? { workspaceId } : {}), photo: { not: null } }, select: { photo: true, photoType: true } });
  return m?.photo ? { bytes: m.photo, type: m.photoType ?? "image/jpeg" } : null;
}
