// Local-only: fills the dev database with a believable business so the portal and team screens can be reviewed.
import { db } from "@/lib/db";
import { provisioningAuth } from "@/lib/auth";
import { createTestClient, TEST_CLIENT_NAME } from "@/modules/crm/test-client";
import { addPerson } from "@/modules/people/service";
import { clientCreateTicket, staffReply, staffCreateTicket } from "@/modules/support/service";
import { quoteChange } from "@/modules/support/change";
import type { StaffCtx } from "@/modules/identity/session";
import type { ClientCtx } from "@/modules/portal/service";

const PW = "demo-password-123";
async function main() {
  const m = await db.staffMembership.findFirstOrThrow({ where: { email: "demo.owner@example.test" } });
  const ctx: StaffCtx = { userId: m.userId as string, staffId: m.id, workspaceId: m.workspaceId, role: m.role, name: m.displayName, email: m.email };
  await db.customer.findFirst({ where: { workspaceId: ctx.workspaceId, displayName: TEST_CLIENT_NAME } }).then(async (c) => { if (c) { const { resetTestClient } = await import("@/modules/crm/test-client"); await resetTestClient(ctx); } });
  for (const e of ["hana.demo@example.test", "mia.demo@example.test", "vic.demo@example.test"]) await db.user.deleteMany({ where: { email: e } });
  const cid = await createTestClient(ctx, "hana.demo@example.test");
  await db.customer.update({ where: { id: cid }, data: { displayName: TEST_CLIENT_NAME, town: "Bristol", businessType: "Food and drink" } });
  await db.contact.updateMany({ where: { customerId: cid }, data: { name: "Hana Baker", position: "Owner" } });
  const people = [["Hana Baker", "hana.demo@example.test", "admin", true, "Owner"], ["Mia Chen", "mia.demo@example.test", "member", false, "Manager"], ["Vic Okoro", "vic.demo@example.test", "viewer", false, "Accountant"]] as const;
  const ctxs: Record<string, ClientCtx> = {};
  for (const [name, email, role, billing, pos] of people) {
    if (name !== "Hana Baker") await addPerson(ctx, cid, { name, email, position: pos });
    await db.invitation.updateMany({ where: { customerId: cid, email }, data: { acceptedAt: new Date() } });
    const r = await provisioningAuth().api.signUpEmail({ body: { email, password: PW, name } });
    await db.clientMembership.create({ data: { userId: r.user.id, customerId: cid, role, billing: role === "viewer" ? true : billing } });
    ctxs[name] = { userId: r.user.id, name, email, memberships: [{ customerId: cid, role, billing, customer: { id: cid, displayName: TEST_CLIENT_NAME, workspaceId: ctx.workspaceId } }] };
  }
  const hana = ctxs["Hana Baker"];
  const project = await db.project.findFirstOrThrow({ where: { customerId: cid } });
  await db.projectUpdate.createMany({ data: [{ workspaceId: ctx.workspaceId, projectId: project.id, body: "Homepage design is ready for your look. We've used your logo colours and the photo of the shopfront.", clientVisible: true }, { workspaceId: ctx.workspaceId, projectId: project.id, body: "Booking page built and tested on phone and desktop.", clientVisible: true }] }).catch(() => undefined);
  await db.assetRequest.create({ data: { workspaceId: ctx.workspaceId, projectId: project.id, label: "Your logo as a PNG or SVG", required: true } }).catch(() => undefined);
  const t1 = await clientCreateTicket(hana, undefined, { kind: "issue", title: "Contact form isn't sending", body: "Since Monday nothing arrives when someone fills in the form on the contact page.", urgency: "high" });
  await staffReply(ctx, t1.id, { body: "Thanks Hana, found it. A setting got switched off when we moved your email. I've fixed it, could you send a test message and tell me it arrives?" });
  const t2 = await clientCreateTicket(hana, undefined, { kind: "request", title: "Add an online booking page for catering", body: "We'd like customers to be able to book catering orders for events, with a date and number of people.", urgency: "normal" });
  await quoteChange(ctx, t2.id, { price: 180, note: "Includes setup and testing." });
  const person = await db.contact.findFirstOrThrow({ where: { customerId: cid, email: "mia.demo@example.test" } });
  await staffCreateTicket(ctx, { customerId: cid, contactId: person.id, category: "support", kind: "question", title: "Can we change the opening hours ourselves?", body: "Mia asked on the phone.", priority: "normal" });
  const t3 = await clientCreateTicket(hana, undefined, { kind: "question", title: "Where do I find last month's receipt?", body: "Need it for my accountant.", urgency: "low" });
  await db.ticket.update({ where: { id: t3.id }, data: { status: "customer_replied" } });
  console.log("seeded", cid);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
