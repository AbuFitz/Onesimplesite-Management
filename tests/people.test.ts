import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { addPerson, listPeople, invitePerson, setAccess, revokeAccess, removePerson, clientRequestAccess, clientPeople, approveRequest, declineRequest, updatePerson } from "@/modules/people/service";
import { clientCreateTicket } from "@/modules/support/service";
import { startPayment, clientBilling } from "@/modules/billing/service";
import type { StaffCtx } from "@/modules/identity/session";
import type { ClientCtx } from "@/modules/portal/service";

async function world() {
  const w = await db.workspace.create({ data: { name: `pp-${Math.random()}` } });
  const m = await db.staffMembership.create({ data: { workspaceId: w.id, email: `s-${Math.random()}@example.test`, displayName: "Abukar", role: "owner", status: "active" } });
  const staff: StaffCtx = { userId: null as unknown as string, staffId: m.id, workspaceId: w.id, role: "owner", name: "Abukar", email: m.email };
  const c = await db.customer.create({ data: { workspaceId: w.id, reference: `OSS-CU-${Math.random().toString(36).slice(2, 8)}`, displayName: "Harbour Bakery" } });
  const mk = async (name: string, role: "admin" | "member" | "viewer", billing = false) => {
    const email = `${name.split(" ")[0].toLowerCase()}-${Math.random().toString(36).slice(2, 8)}@client.test`;
    const contact = await db.contact.create({ data: { workspaceId: w.id, customerId: c.id, name, email, position: "Staff", isPrimary: role === "admin" } });
    const u = await db.user.create({ data: { id: `u-${Math.random()}`, name, email } });
    await db.clientMembership.create({ data: { userId: u.id, customerId: c.id, role, billing } });
    const ctx: ClientCtx = { userId: u.id, name, email, memberships: [{ customerId: c.id, role, billing, customer: { id: c.id, displayName: "Harbour Bakery", workspaceId: w.id } }] };
    return { contact, u, ctx, email };
  };
  return { w, staff, c, owner: await mk("Olu Owner", "admin"), member: await mk("Mia Member", "member"), viewer: await mk("Vic Viewer", "viewer"), accountant: await mk("Ann Accountant", "viewer", true) };
}
const t0 = { kind: "issue", title: "Broken form", body: "It does not send.", urgency: "normal" };

describe("access levels", () => {
  it("owners and team members raise tickets, view-only cannot; billing is its own switch", async () => {
    const x = await world();
    await clientCreateTicket(x.owner.ctx, undefined, t0); await clientCreateTicket(x.member.ctx, undefined, t0);
    await expect(clientCreateTicket(x.viewer.ctx, undefined, t0)).rejects.toThrow(/view only/);
    await expect(clientCreateTicket(x.accountant.ctx, undefined, t0)).rejects.toThrow(/view only/);
    const one = await db.contract.create({ data: { workspaceId: x.w.id, customerId: x.c.id, reference: `OSS-OF-${Math.random().toString(36).slice(2, 8)}`, title: "Site", status: "completed", scopeSnapshot: "x", oneOffMinor: 5000 } });
    await db.billingIntent.create({ data: { workspaceId: x.w.id, customerId: x.c.id, contractId: one.id, kind: "one_off", amountMinor: 5000 } });
    expect(await clientBilling(x.owner.ctx)).toHaveLength(1);       // owner: always
    expect(await clientBilling(x.accountant.ctx)).toHaveLength(1);  // billing switch on
    expect(await clientBilling(x.member.ctx)).toHaveLength(0);      // team member without billing
    expect(await clientBilling(x.viewer.ctx)).toHaveLength(0);
    const bi = (await db.billingIntent.findFirstOrThrow({ where: { customerId: x.c.id } })).id;
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    await expect(startPayment(x.member.ctx, bi)).rejects.toMatchObject({ code: "not_found" });
    delete process.env.STRIPE_SECRET_KEY;
  });
});

describe("team controls for people", () => {
  it("lists access state, changes level, removes access and signs them out, and removes a person who left", async () => {
    const x = await world();
    await db.session.create({ data: { id: `s-${Math.random()}`, token: `t-${Math.random()}`, userId: x.member.u.id, expiresAt: new Date(Date.now() + 1e7) } });
    let me = (await listPeople(x.staff, x.c.id)).find((p) => p.id === x.member.contact.id)!;
    expect(me).toMatchObject({ access: "active", role: "member", billing: false });
    await setAccess(x.staff, me.id, { role: "viewer", billing: true });
    me = (await listPeople(x.staff, x.c.id)).find((p) => p.id === x.member.contact.id)!;
    expect(me).toMatchObject({ role: "viewer", billing: true });
    await revokeAccess(x.staff, me.id);
    expect((await listPeople(x.staff, x.c.id)).find((p) => p.id === me.id)!.access).toBe("revoked");
    expect(await db.session.count({ where: { userId: x.member.u.id } })).toBe(0);
    await expect(setAccess(x.staff, me.id, { role: "member" })).rejects.toThrow(/Give access again/);
    await invitePerson(x.staff, me.id, { role: "member", billing: false });   // gives it back without a link that can't create a second account
    expect((await listPeople(x.staff, x.c.id)).find((p) => p.id === me.id)!.access).toBe("active");
    await removePerson(x.staff, x.owner.contact.id);
    expect((await listPeople(x.staff, x.c.id)).some((p) => p.id === x.owner.contact.id)).toBe(false);
    expect((await listPeople(x.staff, x.c.id)).filter((p) => p.isPrimary)).toHaveLength(1);   // someone else becomes the main contact
    expect(await db.clientMembership.count({ where: { userId: x.owner.u.id, revokedAt: null } })).toBe(0);
  });

  it("adds a person, blocks duplicates, and an invitation carries the level chosen", async () => {
    const x = await world();
    const p = await addPerson(x.staff, x.c.id, { name: "Nina New", email: "Nina@Client.test", position: "Manager" });
    await expect(addPerson(x.staff, x.c.id, { name: "Nina Again", email: "nina@client.test" })).rejects.toThrow(/already on this business/);
    await invitePerson(x.staff, p.id, { role: "viewer", billing: true });
    const inv = await db.invitation.findFirstOrThrow({ where: { customerId: x.c.id, email: "nina@client.test" } });
    expect(inv).toMatchObject({ clientRole: "viewer", clientBilling: true });
    await setAccess(x.staff, p.id, { role: "member", billing: false });     // changes the waiting invitation
    expect(await db.invitation.findUniqueOrThrow({ where: { id: inv.id } })).toMatchObject({ clientRole: "member", clientBilling: false });
    await updatePerson(x.staff, p.id, { name: "Nina N", email: "nina@client.test", position: "Owner" });
  });
});

describe("clients asking for another person", () => {
  it("only owners can ask; the team is emailed; approve creates the person and invites at the level; the requester is told", async () => {
    const x = await world();
    await expect(clientRequestAccess(x.member.ctx, x.c.id, { name: "Sam S", email: "sam@client.test" })).rejects.toThrow(/Only the business owner/);
    await expect(clientPeople(x.member.ctx, x.c.id)).rejects.toMatchObject({ code: "forbidden" });
    const r = await clientRequestAccess(x.owner.ctx, x.c.id, { name: "Sam S", email: "sam@client.test", position: "Bookings", role: "member", billing: false, reason: "Looks after bookings" });
    await expect(clientRequestAccess(x.owner.ctx, x.c.id, { name: "Sam S", email: "SAM@client.test" })).rejects.toThrow(/already asked/);
    await expect(clientRequestAccess(x.owner.ctx, x.c.id, { name: "Mia", email: x.member.email })).rejects.toThrow(/already on your business/);
    expect((await clientPeople(x.owner.ctx, x.c.id)).pending).toHaveLength(1);
    expect(await db.outbox.count({ where: { workspaceId: x.w.id, topic: "email.access_request_notice" } })).toBe(1);
    await approveRequest(x.staff, r.id, { role: "viewer", billing: true });             // the team can change the level before approving
    const inv = await db.invitation.findFirstOrThrow({ where: { customerId: x.c.id, email: "sam@client.test" } });
    expect(inv).toMatchObject({ clientRole: "viewer", clientBilling: true });
    expect(await db.contact.count({ where: { customerId: x.c.id, email: "sam@client.test" } })).toBe(1);
    expect((await db.outbox.findMany({ where: { workspaceId: x.w.id, topic: "email.access_request_decision" } }))[0].payload).toMatchObject({ approved: true, to: x.owner.email });
    await expect(approveRequest(x.staff, r.id)).rejects.toThrow(/already been answered/);
  });
  it("decline tells the requester and adds nobody", async () => {
    const x = await world();
    const r = await clientRequestAccess(x.owner.ctx, x.c.id, { name: "Stranger", email: "stranger@elsewhere.test", role: "admin" });
    await declineRequest(x.staff, r.id, "We couldn't verify them");
    expect(await db.contact.count({ where: { customerId: x.c.id, email: "stranger@elsewhere.test" } })).toBe(0);
    expect((await db.outbox.findFirstOrThrow({ where: { workspaceId: x.w.id, topic: "email.access_request_decision" } })).payload).toMatchObject({ approved: false, note: "We couldn't verify them" });
  });
  it("one business can't touch another's people", async () => {
    const x = await world(); const y = await world();
    await expect(clientRequestAccess(x.owner.ctx, y.c.id, { name: "Intruder", email: "i@x.test" })).rejects.toMatchObject({ code: "forbidden" });
    await expect(setAccess(x.staff, y.owner.contact.id, { role: "viewer" })).rejects.toMatchObject({ code: "not_found" });
  });
});
