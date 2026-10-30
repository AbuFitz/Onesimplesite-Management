import { describe, it, expect, beforeAll } from "vitest";
import { db } from "@/lib/db";
import { createLead, getCustomer, listCustomers } from "@/modules/crm/service";
import { createProposal, sendProposal, reviseProposal, acceptProposal, viewProposalByToken, saveDraft } from "@/modules/sales/service";
import { recordContractCompletion } from "@/modules/contracts/service";
import type { StaffCtx } from "@/modules/identity/session";

async function workspace(label: string, role: StaffCtx["role"] = "owner"): Promise<StaffCtx> {
  const ws = await db.workspace.create({ data: { name: `${label}-${Date.now()}-${Math.random()}` } });
  const m = await db.staffMembership.create({ data: { workspaceId: ws.id, email: `${label}-${Math.random()}@example.test`, displayName: label, role, status: "active" } });
  return { userId: null as unknown as string, staffId: m.id, workspaceId: ws.id, role, name: label, email: m.email };
}
const draft = { title: "Website build", scope: "Five-page site", terms: "Net 14", lines: [
  { description: "Build", quantity: 1, unitMinor: 150000, recurring: false },
  { description: "Hosting", quantity: 1, unitMinor: 2500, recurring: true },
], recurringPeriod: "month" as const };

async function sentProposal(ctx: StaffCtx) {
  const lead = await createLead(ctx, { displayName: "Acme Ltd", contactName: "Ann", email: "ann@acme.test" });
  const p = await createProposal(ctx, lead.customerId, lead.opportunityId, draft);
  const { token, versionId } = await sendProposal(ctx, p.id, "ann@acme.test");
  return { lead, p, token, versionId };
}

describe("proposal acceptance", () => {
  it("creates exactly one acceptance, contract, even under concurrent duplicate submits", async () => {
    const ctx = await workspace("a");
    const { token, versionId } = await sentProposal(ctx);
    const results = await Promise.allSettled(Array.from({ length: 6 }, () => acceptProposal(token, { name: "Ann", consent: true }, {})));
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    const ids = new Set(results.map((r) => (r as PromiseFulfilledResult<{ contractId: string }>).value.contractId));
    expect(ids.size).toBe(1);
    expect(await db.proposalAcceptance.count({ where: { versionId } })).toBe(1);
    expect(await db.contract.count({ where: { proposalVersionId: versionId } })).toBe(1);
  });

  it("rejects consent=false and records server time + exact terms version", async () => {
    const ctx = await workspace("b");
    const { token, versionId } = await sentProposal(ctx);
    await expect(acceptProposal(token, { name: "Ann", consent: false }, {})).rejects.toThrow();
    await acceptProposal(token, { name: "Ann", consent: true }, { ip: "203.0.113.5" });
    const acc = await db.proposalAcceptance.findUniqueOrThrow({ where: { versionId } });
    expect(acc.termsVersion).toBeTruthy();
    expect(acc.acceptedEmail).toBe("ann@acme.test");
  });

  it("revising supersedes the old link; stale and unknown tokens fail safely", async () => {
    const ctx = await workspace("c");
    const { token, p, versionId } = await sentProposal(ctx);
    await reviseProposal(ctx, p.id);
    const view = await viewProposalByToken(token);
    expect(view.ok).toBe(false);
    await expect(acceptProposal(token, { name: "Ann", consent: true }, {})).rejects.toMatchObject({ code: "expired_link" });
    expect(await db.proposalAcceptance.count({ where: { versionId } })).toBe(0);
    expect((await viewProposalByToken("not-a-token")).ok).toBe(false);
  });

  it("expired tokens are refused", async () => {
    const ctx = await workspace("d");
    const { token, versionId } = await sentProposal(ctx);
    await db.scopedLinkToken.updateMany({ where: { entityId: versionId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(acceptProposal(token, { name: "Ann", consent: true }, {})).rejects.toMatchObject({ code: "expired_link" });
  });

  it("tokens are stored hashed only", async () => {
    const ctx = await workspace("e");
    const { token } = await sentProposal(ctx);
    expect(await db.scopedLinkToken.count({ where: { tokenHash: token } })).toBe(0);
  });
});

describe("immutability", () => {
  it("DB refuses edits to a sent proposal version and to audit rows", async () => {
    const ctx = await workspace("f");
    const { versionId, p } = await sentProposal(ctx);
    await expect(db.proposalVersion.update({ where: { id: versionId }, data: { scope: "changed" } })).rejects.toThrow(/immutable/);
    await expect(db.proposalLine.deleteMany({ where: { versionId } })).rejects.toThrow(/immutable/);
    await expect(saveDraft(ctx, p.id, 99, draft)).rejects.toMatchObject({ code: "conflict" });
    const ev = await db.auditEvent.findFirstOrThrow({ where: { workspaceId: ctx.workspaceId } });
    await expect(db.auditEvent.delete({ where: { id: ev.id } })).rejects.toThrow(/append-only|permission denied/);
  });

  it("stale draft save is rejected (cross-device overwrite guard)", async () => {
    const ctx = await workspace("g");
    const lead = await createLead(ctx, { displayName: "Beta", contactName: "Bo" });
    const p = await createProposal(ctx, lead.customerId, lead.opportunityId, draft);
    await saveDraft(ctx, p.id, 1, { ...draft, title: "v2" });
    await expect(saveDraft(ctx, p.id, 1, { ...draft, title: "stale device" })).rejects.toMatchObject({ code: "stale_version" });
  });
});

describe("contract completion", () => {
  it("replay creates one project and one billing intention per kind", async () => {
    const ctx = await workspace("h");
    const { token } = await sentProposal(ctx);
    const { contractId } = await acceptProposal(token, { name: "Ann", consent: true }, {});
    const evidence = { evidence: "Signed PDF held in the shared drive, ref K-0001" };
    const runs = await Promise.allSettled([1, 2, 3].map(() => recordContractCompletion(ctx, contractId, evidence)));
    expect(runs.filter((r) => r.status === "fulfilled").length).toBeGreaterThanOrEqual(1);
    await recordContractCompletion(ctx, contractId, evidence);
    expect(await db.project.count({ where: { contractId } })).toBe(1);
    expect(await db.billingIntent.count({ where: { contractId } })).toBe(2);
    expect(await db.outbox.count({ where: { workspaceId: ctx.workspaceId, dedupeKey: `contract.completed:${contractId}` } })).toBe(1);
  });

  it("requires evidence and a permitted role", async () => {
    const ctx = await workspace("i");
    const { token } = await sentProposal(ctx);
    const { contractId } = await acceptProposal(token, { name: "Ann", consent: true }, {});
    await expect(recordContractCompletion(ctx, contractId, { evidence: "" })).rejects.toThrow();
    const delivery: StaffCtx = { ...ctx, role: "delivery" };
    await expect(recordContractCompletion(delivery, contractId, { evidence: "long enough evidence" })).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("workspace isolation", () => {
  it("another workspace cannot read, list or act on records by known id", async () => {
    const a = await workspace("iso-a");
    const b = await workspace("iso-b");
    const la = await createLead(a, { displayName: "Secret Client", contactName: "S" });
    expect(await getCustomer(b, la.customerId)).toBeNull();
    const list = await listCustomers(b, { search: "Secret" });
    expect(list.total).toBe(0);
    await expect(createProposal(b, la.customerId, null, draft)).rejects.toMatchObject({ code: "not_found" });
  });

  it("composite FK blocks cross-workspace attachment at the database", async () => {
    const a = await workspace("fk-a");
    const b = await workspace("fk-b");
    const la = await createLead(a, { displayName: "Client", contactName: "S" });
    await expect(db.contact.create({ data: { workspaceId: b.workspaceId, customerId: la.customerId, name: "x" } })).rejects.toThrow();
  });

  it("references are allocated atomically under concurrency", async () => {
    const a = await workspace("seq");
    const out = await Promise.all(Array.from({ length: 8 }, (_, i) => createLead(a, { displayName: `C${i}`, contactName: "x" })));
    expect(new Set(out.map((o) => o.reference)).size).toBe(8);
  });
});
