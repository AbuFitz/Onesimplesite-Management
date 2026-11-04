import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { clientSendToProject } from "@/modules/projects/client-input";
import type { ClientCtx } from "@/modules/portal/service";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
async function world() {
  const tag = Math.random().toString(36).slice(2, 8);
  const w = await db.workspace.create({ data: { name: `ci-${tag}` } });
  const m = await db.staffMembership.create({ data: { workspaceId: w.id, email: `s-${tag}@x.test`, displayName: "Abukar", role: "owner", status: "active" } });
  const mk = (n: string) => db.customer.create({ data: { workspaceId: w.id, reference: `OSS-CU-${Math.random().toString(36).slice(2, 8)}`, displayName: n, billingAddress: "1 Rd" } as never });
  const a = await mk("a"), b = await mk("b");
  const p = await db.project.create({ data: { workspaceId: w.id, customerId: a.id, reference: `OSS-PR-${tag}`, name: "Site", stage: "design", scopeSnapshot: "x", ownerId: m.id } as never });
  const asset = await db.assetRequest.create({ data: { workspaceId: w.id, projectId: p.id, label: "Logo" } });
  const cl = (c: { id: string; displayName: string }, role: string): ClientCtx => ({ userId: `u-${c.id}`, name: "Hana", email: "h@x.test", memberships: [{ customerId: c.id, role, customer: { id: c.id, displayName: c.displayName, workspaceId: w.id } }] });
  return { w, p, asset, ca: cl(a, "member"), cv: cl(a, "viewer"), cb: cl(b, "admin") };
}

describe("customer sends material into a project", () => {
  it("answers a request with text and a file: marked received, file shared, owner gets a to-do", async () => {
    const x = await world();
    await clientSendToProject(x.ca, x.p.id, x.asset.id, { text: "Opening hours 9-5", files: [{ name: "logo.png", type: "image/png", bytes: png }] });
    const a = await db.assetRequest.findUniqueOrThrow({ where: { id: x.asset.id } });
    expect(a.receivedAt).toBeTruthy(); expect(a.response).toBe("Opening hours 9-5");
    const f = await db.attachment.findMany({ where: { projectId: x.p.id } });
    expect(f).toHaveLength(1); expect(f[0].internal).toBe(false); expect(f[0].uploadedBy).toBe("client");
    expect(await db.task.count({ where: { projectId: x.p.id, title: { contains: "Logo" } } })).toBe(1);
  });
  it("rejects empty sends, passwords, viewers and other businesses", async () => {
    const x = await world();
    await expect(clientSendToProject(x.ca, x.p.id, null, { text: "", files: [] })).rejects.toThrow();
    await expect(clientSendToProject(x.ca, x.p.id, null, { text: "my password: hunter2", files: [] })).rejects.toThrow(/passwords/);
    await expect(clientSendToProject(x.cv, x.p.id, null, { text: "hi", files: [] })).rejects.toThrow();
    await expect(clientSendToProject(x.cb, x.p.id, null, { text: "hi", files: [] })).rejects.toThrow();
  });
});
