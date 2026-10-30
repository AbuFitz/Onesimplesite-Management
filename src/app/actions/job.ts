"use server";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/modules/identity/session";
import { createLead } from "@/modules/crm/service";
import { createProposal } from "@/modules/sales/service";
import { composeJob } from "@/modules/sales/job";
import { DomainError } from "@/lib/errors";

const msg = (e: unknown) => (e instanceof DomainError ? e.message : e instanceof ZodError ? e.issues.map((i) => i.message).join("; ") : "Something went wrong. Nothing was saved.");

/** One popup, one save: the customer (new or existing) and a draft quote with everything answered so far. */
export async function createJobAction(_: unknown, fd: FormData): Promise<{ error?: string }> {
  const ctx = await requireStaff("proposal.write");
  const j = composeJob(fd);
  let proposalId: string;
  try {
    let customerId = String(fd.get("customerId") ?? "");
    let opportunityId: string | null = null;
    if (fd.get("who") === "existing" && customerId) {
      const c = await db.customer.findFirst({ where: { id: customerId, workspaceId: ctx.workspaceId }, select: { id: true } });
      if (!c) throw new DomainError("not_found", "Pick a customer from the list.");
      const opp = await db.opportunity.findFirst({ where: { customerId, workspaceId: ctx.workspaceId, stage: { notIn: ["won", "lost"] } }, orderBy: { updatedAt: "desc" }, select: { id: true } });
      opportunityId = opp?.id ?? null;
    } else {
      const lead = await createLead(ctx, {
        displayName: fd.get("displayName"), contactName: fd.get("contactName"), email: fd.get("email") || "", phone: fd.get("phone") || undefined,
        opportunityTitle: j.proposal.title, note: j.leadNote || undefined, source: j.source,
      });
      customerId = lead.customerId; opportunityId = lead.opportunityId;
    }
    if (opportunityId) {
      const assignee = j.assigneeId ? await db.staffMembership.findFirst({ where: { id: j.assigneeId, workspaceId: ctx.workspaceId, status: "active" }, select: { id: true } }) : null;
      await db.opportunity.updateMany({ where: { id: opportunityId, workspaceId: ctx.workspaceId }, data: { priority: j.priority, dueDate: j.due, ...(assignee ? { ownerId: assignee.id } : {}) } });
    }
    if (!j.proposal.lines.length) throw new DomainError("validation", "Add at least one price on the last step.");
    proposalId = (await createProposal(ctx, customerId, opportunityId, j.proposal)).id;
  } catch (e) { return { error: msg(e) }; }
  redirect(`/proposals/${proposalId}`);
}
