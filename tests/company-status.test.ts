import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { listCustomers, customerStatusCounts, setCustomerStatus, setCustomerArchived } from "@/modules/crm/service";
import type { StaffCtx } from "@/modules/identity/session";

async function world(role: StaffCtx["role"] = "owner") {
  const w = await db.workspace.create({ data: { name: `cs-${Math.random()}` } });
  const m = await db.staffMembership.create({ data: { workspaceId: w.id, email: `s-${Math.random()}@x.test`, displayName: "A", role, status: "active" } });
  const ctx: StaffCtx = { userId: null as unknown as string, staffId: m.id, workspaceId: w.id, role, name: "A", email: m.email };
  const mk = (n: string, lifecycle: "prospect" | "active" | "paused" | "former", extra: object = {}) => db.customer.create({ data: { workspaceId: w.id, reference: `OSS-CU-${Math.random().toString(36).slice(2, 8)}`, displayName: n, lifecycle, ...extra } });
  return { w, ctx, mk };
}

describe("company status, archive and filters", () => {
  it("counts and filters by status; archived are hidden by default but counted", async () => {
    const { ctx, mk } = await world();
    const a = await mk("Alpha", "active"), b = await mk("Beta", "active", { atRisk: true }); await mk("Gamma", "prospect"); await mk("Delta", "paused"); const e = await mk("Echo", "former");
    await setCustomerArchived(ctx, e.id, true);
    expect(await customerStatusCounts(ctx)).toMatchObject({ all: 4, active: 2, prospect: 1, paused: 1, former: 0, archived: 1, atRisk: 1 });
    expect((await listCustomers(ctx, {})).total).toBe(4);
    expect((await listCustomers(ctx, { status: "active" })).rows.map((r) => r.displayName).sort()).toEqual(["Alpha", "Beta"]);
    expect((await listCustomers(ctx, { status: "archived" })).rows.map((r) => r.displayName)).toEqual(["Echo"]);
    expect((await listCustomers(ctx, { atRisk: true })).rows.map((r) => r.displayName)).toEqual(["Beta"]);
    expect((await listCustomers(ctx, { status: "active", sort: "name" })).rows.map((r) => r.displayName)).toEqual(["Alpha", "Beta"]);
    expect((await listCustomers(ctx, { search: "gam" })).total).toBe(1);
    void a;
  });
  it("changing status is recorded, archive can be restored, and the wrong people can't", async () => {
    const { ctx, w, mk } = await world();
    const c = await mk("Zed", "prospect");
    await setCustomerStatus(ctx, c.id, "active", true);
    expect(await db.customer.findUniqueOrThrow({ where: { id: c.id } })).toMatchObject({ lifecycle: "active", atRisk: true });
    expect(await db.auditEvent.count({ where: { workspaceId: w.id, action: "customer.status_changed", customerId: c.id } })).toBe(1);
    await expect(setCustomerStatus(ctx, c.id, "nonsense", false)).rejects.toThrow(/Pick a status/);
    await setCustomerArchived(ctx, c.id, true); await expect(setCustomerArchived(ctx, c.id, true)).rejects.toThrow(/already archived/);
    await setCustomerArchived(ctx, c.id, false); expect((await db.customer.findUniqueOrThrow({ where: { id: c.id } })).archivedAt).toBeNull();
    const support = await world("support"); const o = await support.mk("Other", "active");
    await expect(setCustomerStatus(support.ctx, o.id, "paused", false)).rejects.toThrow();
    await expect(setCustomerArchived(support.ctx, o.id, true)).rejects.toThrow();
  });
});
