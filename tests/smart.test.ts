import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { suggestionsFor } from "@/modules/smart/service";
import type { StaffCtx } from "@/modules/identity/session";

async function world(role: StaffCtx["role"] = "owner") {
  const w = await db.workspace.create({ data: { name: `sm-${Math.random()}` } });
  const m = await db.staffMembership.create({ data: { workspaceId: w.id, email: `s-${Math.random()}@example.test`, displayName: "Abukar", role, status: "active" } });
  const staff: StaffCtx = { userId: null as unknown as string, staffId: m.id, workspaceId: w.id, role, name: "Abukar", email: m.email };
  const c = await db.customer.create({ data: { workspaceId: w.id, reference: `OSS-CU-${Math.random().toString(36).slice(2, 8)}`, displayName: "Harbour Bakery", legalName: "Harbour Ltd", billingAddress: "1 Quay" } });
  return { w, staff, c };
}
const hoursAgo = (h: number) => new Date(Date.now() - h * 36e5);

describe("smart suggestions", () => {
  it("says nothing when nothing needs doing", async () => {
    const x = await world(); expect((await suggestionsFor(x.staff)).filter((s) => s.level !== "tip")).toEqual([]);
  });

  it("points at customers who have waited longer than we aim to, urgent for high priority, with the reason and a link", async () => {
    const x = await world();
    const t = await db.ticket.create({ data: { workspaceId: x.w.id, customerId: x.c.id, reference: `OSS-TK-${Math.random().toString(36).slice(2, 8)}`, title: "Form is broken", body: "x", priority: "high", status: "customer_replied", lastCustomerAt: hoursAgo(9) } });
    const fine = await db.ticket.create({ data: { workspaceId: x.w.id, customerId: x.c.id, reference: `OSS-TK-${Math.random().toString(36).slice(2, 8)}`, title: "Just asked", body: "x", priority: "normal", status: "open", lastCustomerAt: hoursAgo(1) } });
    const s = await suggestionsFor(x.staff);
    const wait = s.find((i) => i.id.startsWith("tk-wait:"))!;
    expect(wait).toMatchObject({ level: "urgent", action: { href: `/support/${t.id}` } });
    expect(wait.title).toContain("Harbour Bakery"); expect(wait.reason).toMatch(/waited 9 hours/);
    expect(s.some((i) => i.id.includes(fine.id))).toBe(false);          // inside its target: not nagged about
  });

  it("flags failed payments, quiet agreements, stale quotes, access requests and due projects, most urgent first", async () => {
    const x = await world();
    const k = await db.contract.create({ data: { workspaceId: x.w.id, customerId: x.c.id, reference: `OSS-OF-${Math.random().toString(36).slice(2, 8)}`, title: "Site", status: "awaiting_signature", scopeSnapshot: "x" } });
    await db.signingRequest.create({ data: { workspaceId: x.w.id, contractId: k.id, signerName: "Hana", signerEmail: "h@x.test", contentText: "x", contentSha256: "x", status: "pending", expiresAt: new Date(Date.now() + 864e5 * 10), createdAt: new Date(Date.now() - 864e5 * 5) } as never }).catch(() => undefined);
    await db.billingIntent.create({ data: { workspaceId: x.w.id, customerId: x.c.id, contractId: k.id, kind: "recurring_setup", amountMinor: 4900, status: "past_due" } });
    await db.accessRequest.create({ data: { workspaceId: x.w.id, customerId: x.c.id, requestedByUserId: "u", requestedByName: "Hana", requestedByEmail: "h@x.test", name: "Sam", email: "sam@x.test", role: "member" } });
    await db.proposal.create({ data: { workspaceId: x.w.id, customerId: x.c.id, reference: `OSS-QT-${Math.random().toString(36).slice(2, 8)}`, title: "Q", createdById: x.staff.staffId, createdAt: new Date(Date.now() - 864e5 * 5) } });
    await db.project.create({ data: { workspaceId: x.w.id, customerId: x.c.id, reference: `OSS-PJ-${Math.random().toString(36).slice(2, 8)}`, name: "Harbour site", stage: "design", scopeSnapshot: "x", dueDate: new Date(Date.now() + 864e5 * 2), ownerId: x.staff.staffId } });
    const s = await suggestionsFor(x.staff);
    const ids = s.map((i) => i.id.split(":")[0]);
    expect(ids).toEqual(expect.arrayContaining(["pay-failed", "access", "draft", "due"]));
    expect(s[0].level).toBe("urgent");                                   // the failed payment comes first
    expect(s.find((i) => i.id.startsWith("due:"))!.title).toMatch(/due in 2 days/);
    for (const i of s) { expect(i.reason.length).toBeGreaterThan(15); expect(i.action.href.startsWith("/")).toBe(true); }
  });

  it("delivery staff only hear about projects they own", async () => {
    const x = await world("delivery");
    const other = await db.staffMembership.create({ data: { workspaceId: x.w.id, email: `o-${Math.random()}@example.test`, displayName: "Other", role: "owner", status: "active" } });
    const mk = (name: string, ownerId: string) => db.project.create({ data: { workspaceId: x.w.id, customerId: x.c.id, reference: `OSS-PJ-${Math.random().toString(36).slice(2, 8)}`, name, stage: "design", scopeSnapshot: "x", dueDate: new Date(Date.now() + 864e5 * 2), ownerId } });
    await mk("Mine", x.staff.staffId); await mk("Theirs", other.id);
    const titles = (await suggestionsFor(x.staff)).filter((i) => i.id.startsWith("due:")).map((i) => i.title);
    expect(titles).toHaveLength(1); expect(titles[0]).toContain("Mine");
  });
});
