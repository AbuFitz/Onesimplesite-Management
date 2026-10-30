import { db } from "@/lib/db";
import { forbidden } from "@/lib/errors";

export type ClientCtx = { userId: string; memberships: { customerId: string; role: string; customer: { id: string; displayName: string; workspaceId: string } }[] };

/** Resolve the active account from explicit membership only; never from an unvalidated id. */
export function activeAccount(c: ClientCtx, requested?: string) {
  const m = (requested && c.memberships.find((x) => x.customerId === requested)) || c.memberships[0];
  if (!m) throw forbidden();
  return m;
}

export function clientProjects(c: ClientCtx, accountId?: string) {
  const a = activeAccount(c, accountId);
  return db.project.findMany({ where: { customerId: a.customerId, workspaceId: a.customer.workspaceId }, orderBy: { updatedAt: "desc" } });
}

/** Client view omits internal tasks, internal updates, scope margins and staff ids. */
export async function clientProject(c: ClientCtx, projectId: string) {
  const ids = c.memberships.map((m) => m.customerId);
  const p = await db.project.findFirst({
    where: { id: projectId, customerId: { in: ids } },
    select: {
      id: true, name: true, stage: true, dueDate: true, customerId: true,
      updates: { where: { clientVisible: true }, orderBy: { createdAt: "desc" }, select: { id: true, body: true, createdAt: true } },
      assetRequests: { select: { id: true, label: true, required: true, dueDate: true, receivedAt: true } },
    },
  });
  return p;
}

export const STAGE_COPY: Record<string, string> = {
  planned: "We are planning your project.",
  awaiting_assets: "We are waiting for material from you.",
  design: "We are designing your site.",
  development: "We are building your site.",
  qa: "We are testing everything before you review it.",
  client_review: "Your site is ready for your review.",
  ready_to_launch: "Approved and ready to launch.",
  launched: "Your site is live.",
  completed: "Project complete.",
  held: "This project is currently on hold.",
  cancelled: "This project was cancelled.",
};

/** Everything the overview needs, scoped to the client's own accounts. No internal notes, tasks or staff fields. */
export async function clientOverview(c: ClientCtx) {
  const ids = c.memberships.map((m) => m.customerId);
  const [projects, assets, updates, documents] = await Promise.all([
    db.project.findMany({ where: { customerId: { in: ids } }, orderBy: { updatedAt: "desc" }, select: { id: true, name: true, stage: true, dueDate: true } }),
    db.assetRequest.findMany({ where: { project: { customerId: { in: ids } }, receivedAt: null }, orderBy: { createdAt: "asc" }, select: { id: true, label: true, required: true, dueDate: true, projectId: true } }),
    db.projectUpdate.findMany({ where: { clientVisible: true, project: { customerId: { in: ids } } }, orderBy: { createdAt: "desc" }, take: 3, select: { id: true, body: true, createdAt: true, projectId: true } }),
    db.contract.findMany({ where: { customerId: { in: ids }, status: "completed", documents: { some: {} } }, orderBy: { completedAt: "desc" }, take: 3, select: { id: true, title: true, reference: true, completedAt: true } }),
  ]);
  return { projects, assets, updates, documents };
}
