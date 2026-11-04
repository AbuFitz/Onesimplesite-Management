"use server";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/modules/identity/session";
import { createProposal } from "@/modules/sales/service";
import { staffCreateTicket } from "@/modules/support/service";
import { quoteChange } from "@/modules/support/change";
import { addPerson } from "@/modules/people/service";
import { WORK_TYPES } from "@/modules/sales/job-options";
import { DomainError } from "@/lib/errors";
import { flushEmails } from "@/lib/flush-email";

const why = (e: unknown) => (e instanceof DomainError ? e.message : e instanceof ZodError ? e.issues.map((i) => i.message).join(" ") : "Something went wrong and nothing was saved.");

/** One form for every kind of ticket. What it asks depends on the type, and what it does afterwards does too. */
export async function createTicketStaffAction(_: unknown, fd: FormData): Promise<{ error?: string }> {
  const ctx = await requireStaff("customer.write");
  const g = (k: string) => String(fd.get(k) ?? "").trim();
  const customerId = g("customerId"), type = g("type");
  let to: string;
  try {
    const cu = await db.customer.findFirst({ where: { id: customerId, workspaceId: ctx.workspaceId }, select: { id: true, displayName: true } });
    if (!cu) throw new DomainError("not_found", "Pick the company first.");
    let contactId = g("contactId");
    if (contactId === "new") contactId = (await addPerson(ctx, cu.id, { name: g("newName"), email: g("newEmail"), position: g("newPosition") || undefined })).id;
    if (type === "onboarding") redirect(`/agreements/new?business=${cu.id}`);
    if (false as boolean) {
      const work = WORK_TYPES.find((w) => w.id === g("work")) ?? WORK_TYPES[0];
      const title = g("title") || `${work.label} for ${cu.displayName}`;
      const opp = await db.opportunity.create({ data: { workspaceId: ctx.workspaceId, customerId: cu.id, title, ownerId: g("assigneeId") || ctx.staffId, priority: g("priority") || "normal" } });
      if (g("details")) await db.note.create({ data: { workspaceId: ctx.workspaceId, title: "What they want", body: g("details"), ownerId: ctx.staffId, customerId: cu.id, visibility: "team" } });
      const p = await createProposal(ctx, cu.id, opp.id, { title, scope: g("details") || `${work.label}. ${work.hint}`, terms: "", lines: [{ description: "Website design and build", quantity: 1, unitMinor: 0, recurring: false }], requirements: { projectType: ({ simple: "new_site", shop: "shop", booking: "new_site", redesign: "revamp", onepage: "new_site", care: "care", other: "custom" } as Record<string, string>)[work.id] ?? "new_site" } });
      to = `/proposals/${p.id}`;
    } else if (type === "change_request" || type === "support") {
      const t = await staffCreateTicket(ctx, { customerId: cu.id, contactId, category: type, kind: type === "change_request" ? "request" : g("kind") || "issue", title: g("title"), body: g("details"), priority: g("priority") || "normal", assigneeId: g("assigneeId") });
      if (type === "change_request" && g("cost") === "charge") await quoteChange(ctx, t.id, { price: g("price") || "0", note: g("costNote") });
      if (type === "change_request" && g("cost") === "included") await quoteChange(ctx, t.id, { price: 0 });
      flushEmails();
      to = `/support/${t.id}`;
    } else throw new DomainError("validation", "Choose what kind of ticket this is.");
  } catch (e) { return { error: why(e) }; }
  redirect(to);
}
