import type { Prisma } from "@/generated/prisma/client";

const letters = (s: string) =>
  s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");

/** "Jane Mary Smith" -> "jane.smith". Needs a first name and a surname. */
export function baseUsername(displayName: string): string | null {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  const first = letters(parts[0]);
  const last = letters(parts[parts.length - 1]);
  return first && last ? `${first}.${last}` : null;
}

/** Unique within the workspace; a clash (two people with the same name) gets a number on the end. */
export async function allocateUsername(tx: Prisma.TransactionClient, workspaceId: string, displayName: string, selfId?: string) {
  const base = baseUsername(displayName);
  if (!base) return null;
  for (let n = 1; n < 100; n++) {
    const candidate = n === 1 ? base : `${base}${n}`;
    const taken = await tx.staffMembership.findFirst({ where: { workspaceId, username: candidate, ...(selfId ? { NOT: { id: selfId } } : {}) }, select: { id: true } });
    if (!taken) return candidate;
  }
  return null;
}
