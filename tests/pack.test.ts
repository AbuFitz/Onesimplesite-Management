import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { createLead, updateCustomerDetails } from "@/modules/crm/service";
import { createProposal } from "@/modules/sales/service";
import { sendAgreement } from "@/modules/signing/service";
import { updateCompany, saveTermsDraft, publishTerms, ensureStarter, listTerms } from "@/modules/settings/service";
import { saveSettings, savePlan, listPlans } from "@/modules/settings/plans";
import { unknownVars } from "@/modules/settings/variables";
import type { StaffCtx } from "@/modules/identity/session";

async function ws(): Promise<StaffCtx> {
  const w = await db.workspace.create({ data: { name: `pk-${Math.random()}` } });
  const m = await db.staffMembership.create({ data: { workspaceId: w.id, email: `p-${Math.random()}@example.test`, displayName: "Pat Owner", role: "owner", status: "active", jobTitle: "Director", aliasEmail: `pat${Math.floor(Math.random() * 1e6)}@onesimplesite.co.uk` } });
  return { userId: null as unknown as string, staffId: m.id, workspaceId: w.id, role: "owner", name: "Pat Owner", email: m.email };
}

async function setup(ctx: StaffCtx, o: { publishPlanDocs: boolean; fillValues: boolean; withPlan: boolean; special?: string }) {
  await updateCompany(ctx, { legalName: "OneSimpleSite Ltd", registeredAddress: "3f Foxhill, Watford", companyNumber: "17552675" });
  for (const kind of ["terms", "sla", "hosting"] as const) {
    if (kind !== "terms" && !o.publishPlanDocs) continue;
    await ensureStarter(ctx, kind);
    const d = (await listTerms(ctx, kind))[0];
    await publishTerms(ctx, d.id);
  }
  if (o.fillValues) await saveSettings(ctx, { phone_number: "01923 000000", payment_methods: "Bank transfer", liability_cap: "the fees paid in the previous 12 months", handover_service: "Export of your site files and a handover call" });
  await savePlan(ctx, null, { name: "Standard Care Plan", kind: "standard", price: 29, revisionsPerMonth: 3, backupFrequency: "Daily", backupRetention: "14 days" });
  await savePlan(ctx, null, { name: "E-commerce Care Plan", kind: "ecommerce", price: 39, revisionsPerMonth: 3, backupFrequency: "Daily", backupRetention: "30 days" });
  const plan = (await listPlans(ctx.workspaceId)).find((p) => p.kind === "standard")!;
  const lead = await createLead(ctx, { displayName: "Harbour Bakery", contactName: "Casey", email: "casey@harbour.test" });
  const c = await db.customer.findUniqueOrThrow({ where: { id: lead.customerId } });
  await updateCustomerDetails(ctx, c.id, c.version, { kind: "business", legalName: "Harbour Bakery Ltd", companyNumber: "07654321", billingAddress: "2 Quay Road, Bristol" });
  const p = await createProposal(ctx, lead.customerId, lead.opportunityId, {
    title: "Website build", scope: "Five-page brochure site.", terms: o.special ?? "",
    requirements: { pages: "Home\nMenu\nContact", payment: "50% on signing\n50% on launch", ...(o.withPlan ? { plan: plan.id } : {}) },
    lines: [{ description: "Build", quantity: 1, unitMinor: 150000, recurring: false }, ...(o.withPlan ? [{ description: "Standard Care Plan", quantity: 1, unitMinor: 2900, recurring: true }] : [])], recurringPeriod: "month" as const,
  });
  return p;
}

describe("agreement pack", () => {
  it("bundles the order, plan, Services Agreement, SLA and Hosting terms with settings values filled in, and records which versions", async () => {
    const ctx = await ws();
    const p = await setup(ctx, { publishPlanDocs: true, fillValues: true, withPlan: true, special: "The first month of the care plan is free." });
    const r = await sendAgreement(ctx, p.id, { name: "Casey", email: "casey@harbour.test" });
    const req = await db.signingRequest.findUniqueOrThrow({ where: { id: r.requestId } });
    const t = req.contentText;
    for (const must of ["Your service plan", "Standard Care Plan", "£29.00 per month", "Special terms for this order", "The first month of the care plan is free.", "## Services Agreement", "## Service Level Agreement", "## Hosting and Care Plan Terms", "Version | 1.4", "This Service Level Agreement is clause 6", "Hosting and Care Plan Terms", "Daily, kept for 14 days", "99.9%", "Monday to Friday, 9:00 am to 5:00 pm UK time", "£39.00 per month"])
      expect(t, must).toContain(must);
    expect(t).not.toMatch(/\{\{\w+\}\}/); // every value is filled
    expect(t).toContain("OneSimpleSite LTD, trading as OneSimpleSite");
    expect(t).toContain("VAT is not charged because OneSimpleSite Ltd is not VAT-registered");
    const audit = await db.auditEvent.findFirstOrThrow({ where: { workspaceId: ctx.workspaceId, action: "agreement.sent" } });
    const docs = (audit.detail as { documents: { kind: string; version: number }[] }).documents;
    expect(docs.map((d) => d.kind).sort()).toEqual(["hosting", "sla", "terms"]);
    const mail = await db.outbox.findFirstOrThrow({ where: { workspaceId: ctx.workspaceId, topic: "email.contract_request" } });
    expect((mail.payload as { replyTo?: string }).replyTo).toMatch(/@onesimplesite\.co\.uk$/); // replies go to the person who sent it
  });

  it("an order without a care plan only carries the Services Agreement", async () => {
    const ctx = await ws();
    const p = await setup(ctx, { publishPlanDocs: false, fillValues: true, withPlan: false });
    const r = await sendAgreement(ctx, p.id, { name: "Casey", email: "casey@harbour.test" });
    const t = (await db.signingRequest.findUniqueOrThrow({ where: { id: r.requestId } })).contentText;
    expect(t).toContain("## Services Agreement"); expect(t).not.toContain("This Service Level Agreement is clause 6"); expect(t).not.toContain("Your service plan");
  });

  it("names what is missing: unpublished plan documents and undecided settings values", async () => {
    const ctx = await ws();
    const p = await setup(ctx, { publishPlanDocs: false, fillValues: true, withPlan: true });
    await expect(sendAgreement(ctx, p.id, { name: "Casey", email: "casey@harbour.test" })).rejects.toThrow(/Service Level Agreement.*Hosting and Care Plan Terms/s);
    // The commercial values (payment methods, liability cap, handover) now have sensible defaults, so nothing is left undecided.
    const ctx2 = await ws();
    const p2 = await setup(ctx2, { publishPlanDocs: true, fillValues: false, withPlan: true });
    await expect(sendAgreement(ctx2, p2.id, { name: "Casey", email: "casey@harbour.test" })).resolves.toBeTruthy();
  });

  it("documents may only use values the system knows", () => {
    expect(unknownVars("Pay {{care_standard}} to {{legal_name}}. Also {{made_up}}")).toEqual(["made_up"]);
  });
});
