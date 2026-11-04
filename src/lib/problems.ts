import { randomUUID } from "node:crypto";
import { db } from "./db";
import { audit } from "./audit";

/** Where things can go wrong, in plain words. The team sees these on the Testing page and in the smart bubble. */
export const PROBLEM_LABEL: Record<string, string> = {
  payment_start: "A customer couldn't start a payment",
  billing_portal: "A customer couldn't open card settings",
  invite_accept: "Someone couldn't finish setting up their login",
  stripe_webhook: "A Stripe payment update couldn't be applied",
  company_delete: "A company couldn't be deleted",
  test_client: "The test client couldn't be created or reset",
  email_failed: "An email couldn't be sent",
};

/** Records a failure so it is seen instead of guessed at. Never throws and never stores secrets: pass the error's message only. */
export async function reportProblem(p: { workspaceId: string; area: keyof typeof PROBLEM_LABEL | string; error: unknown; customerId?: string | null; ref?: string }) {
  const message = (p.error instanceof Error ? p.error.message : String(p.error)).slice(0, 400);
  console.error(`[problem:${p.area}]`, p.ref ?? "", message);
  try {
    await db.$transaction((tx) => audit(tx, { workspaceId: p.workspaceId, actor: null, action: `problem.${p.area}`, targetType: "problem", targetId: randomUUID(), customerId: p.customerId ?? null, detail: { message, ref: p.ref ?? null } }));
  } catch { /* reporting must never break the thing being reported */ }
}

export const recentProblems = (workspaceId: string, since = new Date(Date.now() - 7 * 864e5)) =>
  db.auditEvent.findMany({ where: { workspaceId, action: { startsWith: "problem." }, createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take: 25, select: { id: true, action: true, createdAt: true, customerId: true, detail: true } });
