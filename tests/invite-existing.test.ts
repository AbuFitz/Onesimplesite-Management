import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/tokens";

vi_placeholder();
function vi_placeholder() {}
describe("inviting someone who already has a login", () => {
  it("a client invitation for an existing login adds the company without touching the password", async () => {
    const { acceptInvitation } = await import("@/app/actions/auth");
    const tag = Math.random().toString(36).slice(2, 8);
    const w = await db.workspace.create({ data: { name: `iv-${tag}` } });
    const c = await db.customer.create({ data: { workspaceId: w.id, reference: `OSS-CU-${tag}`, displayName: "Matt's Test Co" } });
    const u = await db.user.create({ data: { id: `u-${tag}`, name: "Matt", email: `matt-${tag}@x.test` } });
    await db.account.create({ data: { id: `a-${tag}`, accountId: u.id, providerId: "credential", userId: u.id, password: "HASH-UNCHANGED" } });
    const token = `tok-${tag}`;
    await db.invitation.create({ data: { workspaceId: w.id, kind: "client", email: u.email, customerId: c.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 864e5), clientRole: "admin", clientBilling: true } as never });
    const fd = new FormData(); fd.set("token", token); fd.set("name", "Matt"); fd.set("password", "a-new-password-123");
    await expect(acceptInvitation(undefined, fd)).rejects.toThrow(/NEXT_REDIRECT/);
    const m = await db.clientMembership.findUniqueOrThrow({ where: { userId_customerId: { userId: u.id, customerId: c.id } } });
    expect(m.role).toBe("admin"); expect(m.billing).toBe(true);
    expect((await db.account.findFirstOrThrow({ where: { userId: u.id } })).password).toBe("HASH-UNCHANGED");
    expect((await db.invitation.findFirstOrThrow({ where: { tokenHash: sha256(token) } })).acceptedAt).toBeTruthy();
  });

  it("a customer who was named when added is not asked for their name again", async () => {
    const { acceptInvitation } = await import("@/app/actions/auth");
    const tag = Math.random().toString(36).slice(2, 8);
    const w = await db.workspace.create({ data: { name: `iv2-${tag}` } });
    const c = await db.customer.create({ data: { workspaceId: w.id, reference: `OSS-CU-${tag}`, displayName: "Harbour Bakery" } });
    const email = `hana-${tag}@x.test`;
    await db.contact.create({ data: { workspaceId: w.id, customerId: c.id, name: "Hana Baker", email, isPrimary: true } });
    const token = `tok2-${tag}`;
    await db.invitation.create({ data: { workspaceId: w.id, kind: "client", email, customerId: c.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 864e5), clientRole: "member" } as never });
    const fd = new FormData(); fd.set("token", token); fd.set("password", "a-long-enough-password-1");   // no name field
    await expect(acceptInvitation(undefined, fd)).rejects.toThrow(/NEXT_REDIRECT/);
    expect((await db.user.findUniqueOrThrow({ where: { email } })).name).toBe("Hana Baker");
    expect(await db.clientMembership.count({ where: { customerId: c.id } })).toBe(1);
  });
});
