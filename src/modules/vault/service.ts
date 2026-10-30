import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { DomainError, forbidden, notFound } from "@/lib/errors";
import { encryptSecret, decryptSecret } from "@/lib/vault-crypto";
import { can } from "@/modules/identity/permissions";
import type { StaffCtx } from "@/modules/identity/session";

export const VAULT_CATEGORIES = ["general", "website", "email", "hosting", "social", "finance", "software"] as const;

const input = z.object({
  title: z.string().trim().min(1, "Enter a name for this login.").max(120),
  category: z.enum(VAULT_CATEGORIES).default("general"),
  username: z.string().trim().max(200).optional().transform((v) => v || null),
  url: z.string().trim().max(300).optional().transform((v) => v || null),
  notes: z.string().trim().max(2000).optional().transform((v) => v || null),
  secret: z.string().min(1, "Enter the password.").max(1000),
});

const guard = (ctx: StaffCtx) => { if (!can(ctx.role, "vault.use")) throw forbidden(); };
const actor = (ctx: StaffCtx) => ({ userId: ctx.userId, label: ctx.name });

/** Everything except the secret: the list never carries passwords, even encrypted. */
export async function listVault(ctx: StaffCtx) {
  guard(ctx);
  return db.vaultEntry.findMany({
    where: { workspaceId: ctx.workspaceId }, orderBy: { title: "asc" },
    select: { id: true, title: true, category: true, username: true, url: true, notes: true, createdBy: true, updatedBy: true, updatedAt: true },
  });
}

export async function createVaultEntry(ctx: StaffCtx, raw: unknown) {
  guard(ctx);
  const i = input.parse(raw);
  return db.$transaction(async (tx) => {
    const e = await tx.vaultEntry.create({ data: { workspaceId: ctx.workspaceId, ...i, secret: encryptSecret(i.secret), createdBy: ctx.name, updatedBy: ctx.name } });
    await audit(tx, { workspaceId: ctx.workspaceId, actor: actor(ctx), action: "vault.created", targetType: "vault", targetId: e.id, detail: { title: i.title } });
    return e.id;
  });
}

/** Leave the password blank to keep the current one. */
export async function updateVaultEntry(ctx: StaffCtx, id: string, raw: unknown) {
  guard(ctx);
  const i = input.extend({ secret: z.string().max(1000).optional() }).parse(raw);
  await db.$transaction(async (tx) => {
    const cur = await tx.vaultEntry.findFirst({ where: { id, workspaceId: ctx.workspaceId }, select: { id: true } });
    if (!cur) throw notFound();
    const { secret, ...rest } = i;
    await tx.vaultEntry.update({ where: { id }, data: { ...rest, ...(secret ? { secret: encryptSecret(secret) } : {}), updatedBy: ctx.name } });
    await audit(tx, { workspaceId: ctx.workspaceId, actor: actor(ctx), action: secret ? "vault.password_changed" : "vault.updated", targetType: "vault", targetId: id, detail: { title: i.title } });
  });
}

export async function deleteVaultEntry(ctx: StaffCtx, id: string) {
  guard(ctx);
  await db.$transaction(async (tx) => {
    const cur = await tx.vaultEntry.findFirst({ where: { id, workspaceId: ctx.workspaceId }, select: { title: true } });
    if (!cur) throw notFound();
    await tx.vaultEntry.delete({ where: { id } });
    await audit(tx, { workspaceId: ctx.workspaceId, actor: actor(ctx), action: "vault.deleted", targetType: "vault", targetId: id, detail: { title: cur.title } });
  });
}

/** Decrypts one password for one person and records who looked. */
export async function revealVaultSecret(ctx: StaffCtx, id: string) {
  guard(ctx);
  const e = await db.vaultEntry.findFirst({ where: { id, workspaceId: ctx.workspaceId }, select: { secret: true, title: true } });
  if (!e) throw notFound();
  let plain: string;
  try { plain = decryptSecret(e.secret); } catch { throw new DomainError("unavailable", "This password can't be decrypted. The vault key may have changed."); }
  await db.$transaction((tx) => audit(tx, { workspaceId: ctx.workspaceId, actor: actor(ctx), action: "vault.revealed", targetType: "vault", targetId: id, detail: { title: e.title } }));
  return plain;
}
