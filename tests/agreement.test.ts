import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { createLead, updateCustomerDetails } from "@/modules/crm/service";
import { createProposal, reviseProposal } from "@/modules/sales/service";
import { sendAgreement, submitSignature, viewSigning } from "@/modules/signing/service";
import { updateCompany, saveTermsDraft, publishTerms, STARTER_TERMS } from "@/modules/settings/service";
import type { StaffCtx } from "@/modules/identity/session";

async function ws(role: StaffCtx["role"] = "member"): Promise<StaffCtx> {
  const w = await db.workspace.create({ data: { name: `ag-${Math.random()}` } });
  const m = await db.staffMembership.create({ data: { workspaceId: w.id, email: `a-${Math.random()}@example.test`, displayName: "Agent", role, status: "active" } });
  return { userId: null as unknown as string, staffId: m.id, workspaceId: w.id, role, name: "Agent", email: m.email };
}
const draft = {
  title: "Website build", scope: "Five-page brochure site.", terms: "",
  requirements: { pages: "Home\nMenu\nContact", payment: "50% on signing\n50% on launch", domainHosting: "Client owns the domain" },
  lines: [{ description: "Build", quantity: 1, unitMinor: 150000, recurring: false }, { description: "Hosting", quantity: 1, unitMinor: 2500, recurring: true }], recurringPeriod: "month" as const,
};
const REAL_TERMS = "## The Services\n1.1 The Provider will deliver the website described in the Order Summary.\n\n## Payment\n2.1 The Client will pay the invoices issued for the amounts and dates in the Order Summary.";

async function ready(ctx: StaffCtx) {
  await updateCompany(ctx, { legalName: "OneSimpleSite Ltd", registeredAddress: "1 High Street, London", companyNumber: "01234567" });
  const t = await saveTermsDraft(ctx, null, { title: "Terms and Conditions", body: REAL_TERMS });
  await publishTerms(ctx, t.id);
  const lead = await createLead(ctx, { displayName: "Harbour Bakery", contactName: "Casey", email: "casey@harbour.test" });
  const c = await db.customer.findUniqueOrThrow({ where: { id: lead.customerId } });
  await updateCustomerDetails(ctx, c.id, c.version, { kind: "business", legalName: "Harbour Bakery Ltd", companyNumber: "07654321", billingAddress: "2 Quay Road, Bristol" });
  const p = await createProposal(ctx, lead.customerId, lead.opportunityId, draft);
  return { p, lead };
}

describe("single-step agreement", () => {
  it("is blocked until company details, customer details and published terms exist; names what is missing", async () => {
    const ctx = await ws();
    const lead = await createLead(ctx, { displayName: "Bare Ltd", contactName: "B" });
    const p = await createProposal(ctx, lead.customerId, lead.opportunityId, draft);
    await expect(sendAgreement(ctx, p.id, { name: "B", email: "b@x.test" })).rejects.toThrow(/legal company name.*registered address.*legal company name.*address.*published Terms/s);
  });

  it("terms can't be published while [TBC: ...] placeholders remain; published terms are immutable", async () => {
    const ctx = await ws();
    const t = await saveTermsDraft(ctx, null, { title: "Terms", body: STARTER_TERMS });
    await expect(publishTerms(ctx, t.id)).rejects.toThrow(/placeholder/);
    const ok = await saveTermsDraft(ctx, t.id, { title: "Terms", body: REAL_TERMS });
    const pub = await publishTerms(ctx, ok.id);
    await expect(db.termsVersion.update({ where: { id: pub.id }, data: { body: "changed" } })).rejects.toThrow(/immutable/);
    const next = await saveTermsDraft(ctx, pub.id, { title: "Terms", body: REAL_TERMS + "\n3.1 Added later." });
    expect(next.number).toBe(pub.number + 1);
    await publishTerms(ctx, next.id);
    expect((await db.termsVersion.findUniqueOrThrow({ where: { id: pub.id } })).status).toBe("retired");
    expect(await db.termsVersion.count({ where: { workspaceId: ctx.workspaceId, status: "published" } })).toBe(1);
  });

  it("one email and one signature: contains parties, requirements, price, payment schedule and terms; signing accepts, completes and creates the project once", async () => {
    const ctx = await ws();
    const { p } = await ready(ctx);
    const sent = await sendAgreement(ctx, p.id, { name: "Casey Morgan", email: "casey@harbour.test" });
    expect(await db.outbox.count({ where: { workspaceId: ctx.workspaceId, topic: "email.contract_request" } })).toBe(1);
    const v = await viewSigning(sent.token);
    if (!v.ok) throw new Error("expected open link");
    for (const needle of ["OneSimpleSite Ltd", "Harbour Bakery Ltd", "Company no. 07654321", "Home", "Client owns the domain", "50% on signing", "£1,500.00", "The Provider will deliver the website", "version 1"]) expect(v.contentText).toContain(needle);
    const res = await Promise.allSettled([1, 2, 3].map(() => submitSignature(sent.token, { name: "Casey Morgan", method: "typed", consent: true }, {})));
    expect(res.some((r) => r.status === "fulfilled")).toBe(true);
    expect((await db.proposal.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("accepted");
    expect((await db.contract.findUniqueOrThrow({ where: { id: sent.contractId } })).status).toBe("completed");
    expect(await db.project.count({ where: { contractId: sent.contractId } })).toBe(1);
    expect(await db.proposalAcceptance.count({ where: { workspaceId: ctx.workspaceId } })).toBe(1);
    expect(await db.billingIntent.count({ where: { contractId: sent.contractId } })).toBe(2);
  });

  it("handles Windows line endings from browser forms: terms are renumbered and shown as sections", async () => {
    const ctx = await ws();
    const crlf = "## Fees\r\n9.9 First clause.\r\n9.9 Second clause.\r\n\r\n## Liability\r\n7.7 Limit.";
    const t = await saveTermsDraft(ctx, null, { title: "T", body: crlf });
    expect(t.body).not.toContain("\r");
    const { renumberTerms, parseDoc } = await import("@/documents/parse");
    const out = renumberTerms(crlf);
    expect(out).toBe("### Fees\n1.1 First clause.\n1.2 Second clause.\n\n### Liability\n2.1 Limit.");
    expect(parseDoc(crlf).filter((b) => b.t === "tsec" || b.t === "h").length).toBeGreaterThan(0);
  });

  it("revising a sent proposal withdraws the agreement link", async () => {
    const ctx = await ws();
    const { p } = await ready(ctx);
    const sent = await sendAgreement(ctx, p.id, { name: "Casey", email: "casey@harbour.test" });
    await reviseProposal(ctx, p.id);
    expect((await viewSigning(sent.token)).ok).toBe(false);
    await expect(submitSignature(sent.token, { name: "Casey", method: "typed", consent: true }, {})).rejects.toMatchObject({ code: "expired_link" });
    expect((await db.contract.findUniqueOrThrow({ where: { id: sent.contractId } })).status).toBe("voided");
  });

  it("a role without settings permission can't change terms or company details", async () => {
    const ctx = await ws("delivery");
    await expect(saveTermsDraft(ctx, null, { title: "T", body: "x" })).rejects.toMatchObject({ code: "forbidden" });
    await expect(updateCompany(ctx, { legalName: "X" })).rejects.toMatchObject({ code: "forbidden" });
  });
});
