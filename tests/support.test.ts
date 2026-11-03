import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { clientCreateTicket, clientTickets, clientTicket, clientReply, clientResolve, staffCreateTicket, staffReply, updateSupportTicket, listSupportTickets, getSupportTicket } from "@/modules/support/service";
import type { StaffCtx } from "@/modules/identity/session";
import type { ClientCtx } from "@/modules/portal/service";

async function world() {
  const w = await db.workspace.create({ data: { name: `sup-${Math.random()}` } });
  const m = await db.staffMembership.create({ data: { workspaceId: w.id, email: `s-${Math.random()}@example.test`, displayName: "Abukar Sharif", role: "owner", status: "active", aliasEmail: `abukar${Math.floor(Math.random() * 1e6)}@onesimplesite.co.uk` } });
  const staff: StaffCtx = { userId: null as unknown as string, staffId: m.id, workspaceId: w.id, role: "owner", name: "Abukar Sharif", email: m.email };
  const mk = async (name: string) => {
    const c = await db.customer.create({ data: { workspaceId: w.id, reference: `OSS-CU-${Math.random().toString(36).slice(2, 8)}`, displayName: name } });
    const email = `${name.split(" ")[0].toLowerCase()}-${Math.floor(Math.random() * 1e6)}@client.test`;
    const person = await db.contact.create({ data: { workspaceId: w.id, customerId: c.id, name: `${name} Owner`, email, position: "Owner", isPrimary: true } });
    const client: ClientCtx = { userId: `u-${c.id}`, name: person.name, email, memberships: [{ customerId: c.id, role: "admin", customer: { id: c.id, displayName: name, workspaceId: w.id } }] };
    return { c, person, client };
  };
  return { w, staff, a: await mk("Harbour Bakery"), b: await mk("Quay Plumbing") };
}
const ticket = { kind: "issue", title: "Contact form not sending", body: "Nothing arrives when someone fills it in.", urgency: "high" };

describe("support tickets", () => {
  it("a client raises a ticket in one go: reference, priority from urgency, linked to the person, team and client both emailed", async () => {
    const { w, a } = await world();
    const t = await clientCreateTicket(a.client, undefined, ticket);
    expect(t.reference).toMatch(/^OSS-TK-\d{4}-\d{4}$/);
    expect(t.priority).toBe("high"); expect(t.source).toBe("portal"); expect(t.contactId).toBe(a.person.id);
    const topics = (await db.outbox.findMany({ where: { workspaceId: w.id } })).map((o) => o.topic).sort();
    expect(topics).toEqual(["email.ticket_notice", "email.ticket_received"]);
  });

  it("a client nobody added as a contact still gets a person record", async () => {
    const { a } = await world();
    const newcomer: ClientCtx = { ...a.client, name: "New Colleague", email: `new-${Math.random()}@client.test` };
    const t = await clientCreateTicket(newcomer, undefined, ticket);
    const p = await db.contact.findUniqueOrThrow({ where: { id: t.contactId! } });
    expect(p.name).toBe("New Colleague"); expect(p.customerId).toBe(a.c.id);
  });

  it("one customer can never see or touch another's tickets", async () => {
    const { a, b } = await world();
    const t = await clientCreateTicket(a.client, undefined, ticket);
    expect(await clientTickets(b.client)).toHaveLength(0);
    expect(await clientTicket(b.client, t.id)).toBeNull();
    await expect(clientReply(b.client, t.id, "hello")).rejects.toMatchObject({ code: "not_found" });
    await expect(clientResolve(b.client, t.id)).rejects.toMatchObject({ code: "not_found" });
    await expect(clientCreateTicket(b.client, a.c.id, ticket)).rejects.toMatchObject({ code: "forbidden" }); // cannot raise on someone else's account
  });

  it("a project from another customer is refused", async () => {
    const { w, a, b } = await world();
    const proj = await db.project.create({ data: { workspaceId: w.id, customerId: b.c.id, reference: `OSS-PJ-${Math.random().toString(36).slice(2, 8)}`, name: "Not yours", scopeSnapshot: "" } });
    await expect(clientCreateTicket(a.client, undefined, { ...ticket, projectId: proj.id })).rejects.toThrow(/own projects/);
  });

  it("team replies reach the client as the named person, internal notes never do, and a client reply reopens the ticket", async () => {
    const { w, staff, a } = await world();
    const t = await clientCreateTicket(a.client, undefined, ticket);
    await staffReply(staff, t.id, { body: "Looking at it now. Note to self: check the form plugin", internal: true });
    expect((await clientTicket(a.client, t.id))!.comments).toHaveLength(0);
    const r = await staffReply(staff, t.id, { body: "Found it and fixed it. Can you test?" });
    expect(r.emailed).toBe(true);
    const mail = await db.outbox.findFirstOrThrow({ where: { workspaceId: w.id, topic: "email.ticket_reply" } });
    const p = mail.payload as { fromPerson: string; replyTo: string; to: string };
    expect(p.fromPerson).toMatch(/^Abukar at OneSimpleSite <abukar\d+@onesimplesite\.co\.uk>$/); expect(p.replyTo).toMatch(/^abukar\d+@/); expect(p.to).toBe(a.person.email);
    const seen = await clientTicket(a.client, t.id);
    expect(seen!.status).toBe("waiting_customer"); expect(seen!.comments.map((c) => c.body)).toEqual(["Found it and fixed it. Can you test?"]);
    await clientReply(a.client, t.id, "Works now, thank you!");
    expect((await clientTicket(a.client, t.id))!.status).toBe("open");
    expect(await db.outbox.count({ where: { workspaceId: w.id, topic: "email.ticket_notice" } })).toBe(2); // new ticket + reply
    await clientResolve(a.client, t.id);
    expect((await clientTicket(a.client, t.id))!.status).toBe("resolved");
  });

  it("closed tickets can't be replied to by the client; the team can close and reopen", async () => {
    const { staff, a } = await world();
    const t = await clientCreateTicket(a.client, undefined, ticket);
    await updateSupportTicket(staff, t.id, { status: "closed" });
    await expect(clientReply(a.client, t.id, "one more thing")).rejects.toThrow(/closed/);
    await updateSupportTicket(staff, t.id, { status: "open" });
    const again = await getSupportTicket(staff, t.id);
    expect(again!.resolvedAt).toBeNull();
  });

  it("limits how many tickets one person can raise in an hour", async () => {
    const { a } = await world();
    for (let i = 0; i < 8; i++) await clientCreateTicket(a.client, undefined, { ...ticket, title: `Ticket number ${i}` });
    await expect(clientCreateTicket(a.client, undefined, ticket)).rejects.toThrow(/lot of tickets/);
  });

  it("the team raises a ticket for whoever got in touch, assigned to themselves by default, and finds it in the list", async () => {
    const { staff, a } = await world();
    const t = await staffCreateTicket(staff, { customerId: a.c.id, contactId: a.person.id, title: "Wants a new gallery page", body: "Rang this morning", kind: "request" });
    expect(t.assigneeId).toBe(staff.staffId); expect(t.source).toBe("staff");
    const open = await listSupportTickets(staff, { filter: "mine" });
    expect(open.map((x) => x.id)).toContain(t.id);
    await expect(staffCreateTicket(staff, { customerId: a.c.id, contactId: "00000000-0000-4000-8000-000000000000", title: "x y z", body: "abc" })).rejects.toThrow(/isn't on this account/);
  });
});
