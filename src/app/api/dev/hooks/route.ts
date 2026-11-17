import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { drainOutbox } from "@/modules/outbox/drain";
import { runCompletionWorkflow } from "@/modules/contracts/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * DEV SITE (and local) ONLY: the few set-up jobs the automated tests used to do by reaching into the database directly, so they can run against the
 * dev server over HTTPS. It does not exist anywhere but the dev site (APP_ENV=staging answers; everywhere else this is a plain 404),
 * and it also needs the CRON_SECRET. It only ever touches the demo accounts' data. Nothing here takes SQL or code from the caller.
 */
const secretOk = (req: Request) => {
  const secret = process.env.CRON_SECRET;
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  return !!secret && got.length === secret.length && timingSafeEqual(Buffer.from(got), Buffer.from(secret));
};
const json = (x: unknown, status = 200) => Response.json(x, { status });

async function order(kind: "cancel" | "setup") {
  const u = await db.user.findFirstOrThrow({ where: { email: "client.b@example.test" } });
  const m = await db.clientMembership.findFirstOrThrow({ where: { userId: u.id } });
  const cu = await db.customer.findUniqueOrThrow({ where: { id: m.customerId } });
  const n = Date.now() % 1000000, tag = kind === "cancel" ? "CX" : "CS", title = kind === "cancel" ? `Cancel test ${n}` : `Setup test order ${n}`;
  const oneOff = kind === "cancel" ? 20000 : 34000, recurring = kind === "cancel" ? 0 : 2900;
  const requirements = kind === "cancel" ? { depositPercent: "50" } : { depositPercent: "50", promoFreeMonths: "1", promoFreeEnds: "stop", promoLabel: "New Customer" };
  const p = await db.proposal.create({ data: { workspaceId: cu.workspaceId, customerId: cu.id, reference: `OSS-QT-${tag}-${n}`, title, currentVersion: 1, status: "accepted" } });
  const v = await db.proposalVersion.create({ data: { workspaceId: cu.workspaceId, proposalId: p.id, number: 1, scope: "x", terms: "", currency: "GBP", oneOffMinor: oneOff, recurringMinor: recurring, ...(recurring ? { recurringPeriod: "month" } : {}), requirements } });
  const k = await db.contract.create({ data: { workspaceId: cu.workspaceId, customerId: cu.id, reference: `OSS-OF-${tag}-${n}`, title, status: "completed", scopeSnapshot: "x", oneOffMinor: oneOff, recurringMinor: recurring, proposalVersionId: v.id, completedAt: new Date() } });
  await db.$transaction((tx) => runCompletionWorkflow(tx, k.id));
  return { contract: k.id, title: k.title };
}

export async function POST(req: Request) {
  if (!["staging", "development"].includes(process.env.APP_ENV ?? "")) return new Response("Not found", { status: 404 });
  if (!secretOk(req)) return new Response("Unauthorised", { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { action?: string; kind?: string; codes?: string; testers?: string };

  switch (body.action) {
    case "ids": {   // the demo company client.b belongs to, and its first project, for suites that need to open them
      const u = await db.user.findFirstOrThrow({ where: { email: "client.b@example.test" } });
      const m = await db.clientMembership.findFirstOrThrow({ where: { userId: u.id } });
      const project = await db.project.findFirst({ where: { customerId: m.customerId }, orderBy: { createdAt: "asc" } });
      return json({ customer: m.customerId, project: project?.id ?? null });
    }
    case "drain": {   // send what is queued, then wait for any send already in flight (the app flushes mail itself too) so a test reads a settled inbox
      const result = await drainOutbox(200);
      for (let i = 0; i < 40; i++) {
        const [{ n }] = await db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM "Outbox" WHERE "status" IN ('pending', 'sending') AND "attempts" < 5`;
        if (!n) break;
        await new Promise((r) => setTimeout(r, 500));
        await drainOutbox(200);
      }
      return json(result);
    }
    case "mail": return json((await db.$queryRaw<{ mail: unknown }[]>`SELECT mail FROM dev_tools.mail_sink ORDER BY created_at`).map((r) => r.mail));
    case "clear-mail": await db.$executeRaw`DELETE FROM dev_tools.mail_sink`; return json({ ok: true });
    case "ensure-plan": {
      const m = await db.staffMembership.findFirstOrThrow({ where: { email: "demo.owner@example.test" } });
      if (!(await db.servicePlan.findFirst({ where: { workspaceId: m.workspaceId, active: true } }))) await db.servicePlan.create({ data: { workspaceId: m.workspaceId, key: "standard", name: "Standard Care Plan", kind: "standard", monthlyMinor: 2900 } });
      return json({ ok: true });
    }
    case "order": return body.kind === "cancel" || body.kind === "setup" ? json(await order(body.kind)) : json({ error: "kind must be cancel or setup" }, 400);
    case "reset-profile":
      await db.staffMembership.updateMany({ where: { email: "demo.owner@example.test" }, data: { jobTitle: null, signature: null } });
      return json({ ok: true });
    case "security-mode": {
      const codes = String(body.codes ?? "off");
      if (!["off", "testers", "all"].includes(codes)) return json({ error: "codes must be off, testers or all" }, 400);
      const testers = String(body.testers ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      const u = await db.user.findUniqueOrThrow({ where: { email: "demo.owner@example.test" }, include: { staffMemberships: true } });
      const ws = u.staffMemberships[0].workspaceId;
      const w = await db.workspace.findUniqueOrThrow({ where: { id: ws } });
      await db.workspace.update({ where: { id: ws }, data: { settings: { ...((w.settings as object | null) ?? {}), security: { codes, testers } } } });
      const ids = (await db.user.findMany({ where: { email: { in: ["demo.owner@example.test", "client.b@example.test"] } } })).map((x) => x.id);
      await db.twoFactor.deleteMany({ where: { userId: { in: ids } } });
      await db.knownDevice.deleteMany({ where: { userId: { in: ids } } });
      await db.verification.deleteMany({ where: { identifier: { startsWith: "trust-device-" } } });
      await db.user.updateMany({ where: { id: { in: ids } }, data: { twoFactorEnabled: false } });
      return json({ ok: true });
    }
    default: return json({ error: "unknown action" }, 400);
  }
}
