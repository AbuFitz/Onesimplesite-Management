import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import type { StaffCtx } from "./session";
import { can } from "./permissions";

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

/* Customers: one picture per person (not per company). Stored on the login, so it follows them everywhere. */
export async function setClientPhoto(userId: string, file: File | null) {
  if (!file || file.size === 0) throw new DomainError("validation", "Choose a picture first.");
  if (file.size > 400_000) throw new DomainError("validation", "That picture is too big. Try a smaller one.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const type = sniff(bytes);
  if (!type) throw new DomainError("validation", "Use a JPG, PNG or WebP picture.");
  await db.user.update({ where: { id: userId }, data: { photo: new Uint8Array(bytes), photoType: type } });
}
export const removeClientPhoto = (userId: string) => db.user.update({ where: { id: userId }, data: { photo: null, photoType: null } });

/** Team can see a customer's picture if that person belongs to one of this workspace's companies. */
export async function clientPhotoForStaff(userId: string, workspaceId: string) {
  const u = await db.user.findFirst({ where: { id: userId, photo: { not: null }, clientMemberships: { some: { customer: { workspaceId } } } }, select: { photo: true, photoType: true } });
  return u?.photo ? { bytes: u.photo, type: u.photoType ?? "image/jpeg" } : null;
}
/** A customer sees their own picture and those of people in the same company. */
export async function clientPhotoForClient(userId: string, viewerId: string, customerIds: string[]) {
  const u = await db.user.findFirst({ where: { id: userId, photo: { not: null }, OR: [{ id: viewerId }, { clientMemberships: { some: { customerId: { in: customerIds }, revokedAt: null } } }] }, select: { photo: true, photoType: true } });
  return u?.photo ? { bytes: u.photo, type: u.photoType ?? "image/jpeg" } : null;
}

/* Company logos: the team's own visibility, uploaded by anyone who can edit a company. */
export async function setCompanyLogo(ctx: StaffCtx, customerId: string, file: File | null) {
  if (!can(ctx.role, "customer.write")) throw new DomainError("forbidden", "You can't change company details.");
  if (!file || file.size === 0) throw new DomainError("validation", "Choose a logo first.");
  if (file.size > 400_000) throw new DomainError("validation", "That logo is too big. Try a smaller one.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const type = sniff(bytes);
  if (!type) throw new DomainError("validation", "Use a JPG, PNG or WebP logo.");
  if (!(await db.customer.findFirst({ where: { id: customerId, workspaceId: ctx.workspaceId }, select: { id: true } }))) throw new DomainError("not_found", "Company not found.");
  const data = { workspaceId: ctx.workspaceId, bytes: new Uint8Array(bytes), type };
  await db.companyLogo.upsert({ where: { customerId }, create: { customerId, ...data }, update: data });
}
export async function removeCompanyLogo(ctx: StaffCtx, customerId: string) {
  if (!can(ctx.role, "customer.write")) throw new DomainError("forbidden", "You can't change company details.");
  await db.companyLogo.deleteMany({ where: { customerId, workspaceId: ctx.workspaceId } });
}
export async function companyLogo(customerId: string, workspaceId: string) {
  const l = await db.companyLogo.findFirst({ where: { customerId, workspaceId }, select: { bytes: true, type: true } });
  return l ? { bytes: l.bytes, type: l.type } : null;
}
