"use server";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/modules/identity/session";
import { createProposal } from "@/modules/sales/service";
import { addPerson } from "@/modules/people/service";
import { WORK_TYPES } from "@/modules/sales/job-options";
import { DomainError } from "@/lib/errors";
import { listPlans } from "@/modules/settings/plans";

const why = (e: unknown) => (e instanceof DomainError ? e.message : e instanceof ZodError ? e.issues.map((i) => i.message).join(" ") : "Something went wrong and nothing was saved.");
const PROJECT_OF: Record<string, string> = { simple: "new_site", shop: "shop", booking: "new_site", redesign: "revamp", onepage: "new_site", care: "care", other: "custom" };

/** Starts the agreement for a new job. One at a time per company: if one is still being written or waiting for a signature, we open that instead of making a second. */
export async function createAgreementAction(_: unknown, fd: FormData): Promise<{ error?: string }> {
  const ctx = await requireStaff("customer.write");
  const g = (k: string) => String(fd.get(k) ?? "").trim();
  let to: string;
  try {
    const cu = await db.customer.findFirst({ where: { id: g("customerId"), workspaceId: ctx.workspaceId }, select: { id: true, displayName: true } });
    if (!cu) throw new DomainError("not_found", "Pick the company first.");
    const open = await db.proposal.findFirst({ where: { workspaceId: ctx.workspaceId, customerId: cu.id, status: { in: ["draft", "sent"] } }, orderBy: { updatedAt: "desc" }, select: { id: true } });
    if (open && g("another") !== "1") redirect(`/proposals/${open.id}?existing=1`);
    let contactId = g("contactId");
    if (contactId === "new") contactId = (await addPerson(ctx, cu.id, { name: g("newName"), email: g("newEmail"), position: g("newPosition") || undefined })).id;
    const work = WORK_TYPES.find((w) => w.id === g("work")) ?? WORK_TYPES[0];
    const title = g("title") || `${work.label} for ${cu.displayName}`;
    const opp = await db.opportunity.create({ data: { workspaceId: ctx.workspaceId, customerId: cu.id, title, ownerId: ctx.staffId, priority: "normal" } });
    if (g("details")) await db.note.create({ data: { workspaceId: ctx.workspaceId, title: "What they want", body: g("details"), ownerId: ctx.staffId, customerId: cu.id, visibility: "team" } });
    // Hosting and upkeep only is a care plan job: the care plan is chosen for them, and the one-off line is named for what it is.
    const careOnly = work.id === "care";
    const plan = careOnly ? (await listPlans(ctx.workspaceId, true))[0] : undefined;
    const p = await createProposal(ctx, cu.id, opp.id, { title, scope: g("details") || `${work.label}. ${work.hint}`, terms: "", lines: [{ description: careOnly ? "Hosting set-up and move-over" : "Website design and build", quantity: 1, unitMinor: 0, recurring: false }], requirements: { projectType: PROJECT_OF[work.id] ?? "new_site", ...(plan ? { plan: plan.id } : {}) } });
    to = `/proposals/${p.id}`;
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw e;
    return { error: why(e) };
  }
  redirect(to);
}
