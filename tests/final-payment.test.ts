import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { runCompletionWorkflow } from "@/modules/contracts/service";
import { startPayment, requestFinalPayment, isScheduled } from "@/modules/billing/service";
import { transitionProject } from "@/modules/projects/service";
import type { StaffCtx } from "@/modules/identity/session";
import type { ClientCtx } from "@/modules/portal/service";

async function world() {
  const w = await db.workspace.create({ data: { name: `fp-${Math.random()}` } });
  const m = await db.staffMembership.create({ data: { workspaceId: w.id, email: `s-${Math.random()}@x.test`, displayName: "A", role: "owner", status: "active" } });
  const staff: StaffCtx = { userId: null as unknown as string, staffId: m.id, workspaceId: w.id, role: "owner", name: "A", email: m.email };
  const c = await db.customer.create({ data: { workspaceId: w.id, reference: `OSS-CU-${Math.random().toString(36).slice(2, 8)}`, displayName: "Harbour Bakery" } });
  await db.contact.create({ data: { workspaceId: w.id, customerId: c.id, name: "Hana Lee", email: "hana@client.test", isPrimary: true } });
  const p = await db.proposal.create({ data: { workspaceId: w.id, customerId: c.id, reference: `OSS-QT-${Math.random().toString(36).slice(2, 8)}`, title: "Site", currentVersion: 1 } });
  const v = await db.proposalVersion.create({ data: { workspaceId: w.id, proposalId: p.id, number: 1, scope: "x", terms: "", currency: "GBP", oneOffMinor: 100000, recurringMinor: 0, requirements: { depositPercent: "40", promoPercent: "10" } as never } });
  const k = await db.contract.create({ data: { workspaceId: w.id, customerId: c.id, reference: `OSS-OF-${Math.random().toString(36).slice(2, 8)}`, title: "Website", status: "completed", scopeSnapshot: "x", oneOffMinor: 100000, recurringMinor: 0, proposalVersionId: v.id } });
  const project = await db.$transaction((tx) => runCompletionWorkflow(tx, k.id));
  const client: ClientCtx = { userId: "u", name: "Hana", email: "hana@client.test", memberships: [{ customerId: c.id, role: "admin", customer: { id: c.id, displayName: c.displayName, workspaceId: w.id } }] };
  return { w, staff, c, k, client, project };
}

describe("deposit and final payment", () => {
  it("takes the percentage off first, then splits what is left", async () => {
    const x = await world();
    const bills = await db.billingIntent.findMany({ where: { contractId: x.k.id }, orderBy: { kind: "asc" } });
    expect(bills.map((b) => [b.kind, b.amountMinor])).toEqual([["balance", 54000], ["deposit", 36000]]);   // £1,000 - 10% = £900: 40% now, 60% later
  });

  it("the final payment cannot be paid until it is asked for, then the customer is emailed and can pay", async () => {
    const x = await world();
    const bal = await db.billingIntent.findFirstOrThrow({ where: { contractId: x.k.id, kind: "balance" } });
    expect(isScheduled(bal)).toBe(true);
    await expect(startPayment(x.client, bal.id)).rejects.toThrow(/isn't due yet|aren't switched on/);
    await requestFinalPayment(x.staff, x.k.id);
    const after = await db.billingIntent.findUniqueOrThrow({ where: { id: bal.id } });
    expect(after.requestedAt).toBeTruthy(); expect(isScheduled(after)).toBe(false);
    const mail = await db.outbox.findMany({ where: { workspaceId: x.w.id, topic: "email.balance_requested" } });
    expect(mail).toHaveLength(1); expect(mail[0].payload).toMatchObject({ to: "hana@client.test", amount: "£540.00" });
    await expect(requestFinalPayment(x.staff, x.k.id)).rejects.toThrow(/no final payment waiting/);      // asking twice is safe, and says so
    expect(await db.outbox.count({ where: { workspaceId: x.w.id, topic: "email.balance_requested" } })).toBe(1);
  });

  it("asks for it by itself when the project is ready to launch", async () => {
    const x = await world();
    const p = await db.project.findFirstOrThrow({ where: { contractId: x.k.id } });
    await transitionProject(x.staff, p.id, "ready_to_launch", p.version);
    const bal = await db.billingIntent.findFirstOrThrow({ where: { contractId: x.k.id, kind: "balance" } });
    expect(bal.requestedAt).toBeTruthy();
    expect(await db.outbox.count({ where: { workspaceId: x.w.id, topic: "email.balance_requested" } })).toBe(1);
  });
});
