import type { Tx } from "./db";
import { resolveDelivery, prefsFrom } from "@/modules/settings/notifications";

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

/**
 * OneSimpleSite references: OSS-<TYPE>-<YEAR>-<NNN>, for example OSS-QT-2026-047. Customers have no year (OSS-CU-0001).
 * Allocated atomically in the database, one counter per type and year, never "count + 1".
 */
const REFS = {
  customer: { code: "CU", yearly: false, pad: 4 },
  quotation: { code: "QT", yearly: true, pad: 3 },
  order: { code: "OF", yearly: true, pad: 3 },
  project: { code: "PJ", yearly: true, pad: 3 },
  ticket: { code: "TK", yearly: true, pad: 4 },
  dpa: { code: "DP", yearly: true, pad: 3 },
  change: { code: "CR", yearly: true, pad: 3 },
  receipt: { code: "RC", yearly: true, pad: 4 },
} as const;
export type RefKind = keyof typeof REFS;
export const londonYear = (d = new Date()) => Number(new Intl.DateTimeFormat("en-GB", { year: "numeric", timeZone: "Europe/London" }).format(d));

export async function nextRef(tx: Tx, workspaceId: string, kind: RefKind) {
  const r = REFS[kind], year = londonYear();
  const name = r.yearly ? `${kind}:${year}` : kind;
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "SequenceCounter" ("workspaceId","name","value") VALUES (${workspaceId}::uuid, ${name}, 1)
    ON CONFLICT ("workspaceId","name") DO UPDATE SET "value" = "SequenceCounter"."value" + 1
    RETURNING "value"`;
  const n = String(rows[0].value).padStart(r.pad, "0");
  return r.yearly ? `OSS-${r.code}-${year}-${n}` : `OSS-${r.code}-${n}`;
}

/** Atomic reference allocation (never count+1). Older style, kept for any caller not yet moved to nextRef. */
export async function nextReference(tx: Tx, workspaceId: string, name: string, prefix: string) {
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "SequenceCounter" ("workspaceId","name","value") VALUES (${workspaceId}::uuid, ${name}, 1)
    ON CONFLICT ("workspaceId","name") DO UPDATE SET "value" = "SequenceCounter"."value" + 1
    RETURNING "value"`;
  return `${prefix}-${String(rows[0].value).padStart(4, "0")}`;
}

export async function enqueue(tx: Tx, workspaceId: string, topic: string, dedupeKey: string, payload: object) {
  // Some notices can be switched off or bundled into a daily summary (Settings, Notifications). Everything customers need is always sent.
  let status = "pending";
  if (topic.startsWith("email.")) {
    const w = await tx.workspace.findUnique({ where: { id: workspaceId }, select: { settings: true } });
    const mode = resolveDelivery(prefsFrom(w?.settings), topic, payload as Record<string, unknown>);
    if (mode === "off") return;
    if (mode === "digest") status = "held";
  }
  // Unique (workspace, dedupeKey): replay of the same business event is a no-op.
  await tx.outbox.upsert({
    where: { workspaceId_dedupeKey: { workspaceId, dedupeKey } },
    create: { workspaceId, topic, dedupeKey, payload, status },
    update: {},
  });
}
