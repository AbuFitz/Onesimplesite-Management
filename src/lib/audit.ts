import type { Tx } from "./db";

export type Actor = { userId: string | null; label: string; staffId?: string | null; workspaceId: string };

export async function audit(
  tx: Tx,
  a: { workspaceId: string; actor: { userId?: string | null; label: string } | null; action: string; targetType: string; targetId: string; customerId?: string | null; detail?: object; visibility?: "internal" | "client" },
) {
  await tx.auditEvent.create({
    data: {
      workspaceId: a.workspaceId,
      actorId: a.actor?.userId ?? null,
      actorLabel: a.actor?.label ?? "system",
      action: a.action,
      targetType: a.targetType,
      targetId: a.targetId,
      customerId: a.customerId ?? null,
      visibility: a.visibility ?? "internal",
      detail: a.detail ?? undefined,
    },
  });
}

/** Atomic reference allocation (never count+1). */
export async function nextReference(tx: Tx, workspaceId: string, name: string, prefix: string) {
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "SequenceCounter" ("workspaceId","name","value") VALUES (${workspaceId}::uuid, ${name}, 1)
    ON CONFLICT ("workspaceId","name") DO UPDATE SET "value" = "SequenceCounter"."value" + 1
    RETURNING "value"`;
  return `${prefix}-${String(rows[0].value).padStart(4, "0")}`;
}

export async function enqueue(tx: Tx, workspaceId: string, topic: string, dedupeKey: string, payload: object) {
  // Unique (workspace, dedupeKey): replay of the same business event is a no-op.
  await tx.outbox.upsert({
    where: { workspaceId_dedupeKey: { workspaceId, dedupeKey } },
    create: { workspaceId, topic, dedupeKey, payload },
    update: {},
  });
}
