import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { composeAgreement } from "@/modules/signing/service";
import { runCompletionWorkflow } from "@/modules/contracts/service";
import { SERVICES_AGREEMENT } from "@/modules/settings/legal-text";

const base = { reference: "OSS-OF-2026-001", title: "Website", dateLabel: "4 November 2026", validUntilLabel: "4 December 2026", currency: "GBP", oneOffMinor: 120000, recurringMinor: 2900, recurringPeriod: "month", lines: [{ description: "Website", quantity: 1, unitMinor: 120000, recurring: false }, { description: "Care Plan", quantity: 1, unitMinor: 2900, recurring: true }], scope: "A site", provider: { legalName: "OneSimpleSite LTD", companyNumber: "17552675", registeredAddress: "3F Foxhill", vatNumber: null }, client: { legalName: "Harbour Bakery Ltd", kind: "business", companyNumber: null, billingAddress: "1 Quay", vatNumber: null }, docs: { terms: { number: 2, body: SERVICES_AGREEMENT } }, vars: {} };

describe("deposit on signing", () => {
  it("is written into the agreement before it is signed, after any discount", () => {
    const t = composeAgreement({ ...base, requirements: { depositPercent: "50", promoDiscount: "200" } } as never);
    expect(t).toContain("a deposit of 50% (£500.00) is due when you sign"); expect(t).toContain("final payment of £500.00 is due before the website goes live");
    expect(composeAgreement({ ...base, requirements: {} } as never)).not.toContain("deposit of");
  });

  it("creates the deposit and final payment when the order completes, and no single website fee", async () => {
    const w = await db.workspace.create({ data: { name: `dp-${Math.random()}` } });
    const c = await db.customer.create({ data: { workspaceId: w.id, reference: `OSS-CU-${Math.random().toString(36).slice(2, 8)}`, displayName: "Harbour Bakery" } });
    const p = await db.proposal.create({ data: { workspaceId: w.id, customerId: c.id, reference: `OSS-QT-${Math.random().toString(36).slice(2, 8)}`, title: "Site", currentVersion: 1 } });
    const v = await db.proposalVersion.create({ data: { workspaceId: w.id, proposalId: p.id, number: 1, scope: "x", terms: "", currency: "GBP", oneOffMinor: 120000, recurringMinor: 0, requirements: { depositPercent: "30", promoDiscount: "200" } as never } });
    const k = await db.contract.create({ data: { workspaceId: w.id, customerId: c.id, reference: `OSS-OF-${Math.random().toString(36).slice(2, 8)}`, title: "Website", status: "completed", scopeSnapshot: "x", oneOffMinor: 120000, recurringMinor: 0, proposalVersionId: v.id } });
    await db.$transaction((tx) => runCompletionWorkflow(tx, k.id));
    await db.$transaction((tx) => runCompletionWorkflow(tx, k.id));                                     // safe to run twice
    const bills = await db.billingIntent.findMany({ where: { contractId: k.id }, orderBy: { kind: "asc" } });
    expect(bills.map((b) => [b.kind, b.amountMinor])).toEqual([["balance", 70000], ["deposit", 30000]]);
  });
});
