import "dotenv/config";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { db } from "../src/lib/db";
import { newToken } from "../src/lib/tokens";

/** Synthetic data only. Dev accounts are created only when APP_ENV=development. */
async function user(email: string, name: string, password: string) {
  const id = randomUUID().replaceAll("-", "");
  const u = await db.user.upsert({ where: { email }, create: { id, email, name, emailVerified: true }, update: {} });
  if (!(await db.account.findFirst({ where: { userId: u.id, providerId: "credential" } }))) {
    await db.account.create({ data: { id: randomUUID(), accountId: u.id, providerId: "credential", userId: u.id, password: await hashPassword(password) } });
  }
  return u;
}

async function main() {
  const ws = (await db.workspace.findFirst({ where: { name: "OneSimpleSite" } })) ?? (await db.workspace.create({ data: { name: "OneSimpleSite" } }));
  const pending = [
    ["abukar.sharif@onesimplesite.co.uk", "Abukar Sharif", "owner"],
    ["farhan.mahmood@onesimplesite.co.uk", "Farhan Mahmood", "client_director"],
    ["matthew.redican@onesimplesite.co.uk", "Matthew Redican", "delivery"],
  ] as const;
  for (const [email, displayName, role] of pending) {
    await db.staffMembership.upsert({ where: { workspaceId_email: { workspaceId: ws.id, email } }, create: { workspaceId: ws.id, email, displayName, role, status: "pending" }, update: {} });
    const { token, hash } = newToken();
    await db.invitation.create({ data: { workspaceId: ws.id, kind: "staff", email, tokenHash: hash, staffRole: role, expiresAt: new Date(Date.now() + 7 * 864e5) } });
    console.log(`Pending invitation (${role}) ${email}: /invite/${token}`);
  }
  if (process.env.APP_ENV !== "development") return;

  const pw = "demo-password-123";
  const owner = await user("demo.owner@example.test", "Demo Owner", pw);
  const delivery = await user("demo.delivery@example.test", "Demo Delivery", pw);
  const om = await db.staffMembership.upsert({ where: { workspaceId_email: { workspaceId: ws.id, email: owner.email } }, create: { workspaceId: ws.id, userId: owner.id, email: owner.email, displayName: "Demo Owner", role: "owner", status: "active" }, update: { status: "active", userId: owner.id } });
  const dm = await db.staffMembership.upsert({ where: { workspaceId_email: { workspaceId: ws.id, email: delivery.email } }, create: { workspaceId: ws.id, userId: delivery.id, email: delivery.email, displayName: "Demo Delivery", role: "delivery", status: "active" }, update: { status: "active", userId: delivery.id } });

  for (const [n, who] of [["Harbour Bakery", "client.a@example.test"], ["Northside Physio", "client.b@example.test"]] as const) {
    let c = await db.customer.findFirst({ where: { workspaceId: ws.id, displayName: n } });
    if (!c) {
      c = await db.customer.create({ data: { workspaceId: ws.id, reference: `C-S${n.length}`, displayName: n, lifecycle: "active", ownerId: om.id } });
      await db.contact.create({ data: { workspaceId: ws.id, customerId: c.id, name: `${n} contact`, email: who, isPrimary: true } });
      const p = await db.project.create({ data: { workspaceId: ws.id, customerId: c.id, reference: `PR-S${n.length}`, name: `${n} website`, scopeSnapshot: "Synthetic scope", stage: "awaiting_assets", ownerId: dm.id } });
      await db.assetRequest.create({ data: { workspaceId: ws.id, projectId: p.id, label: "Logo (SVG or PNG)" } });
      await db.projectUpdate.createMany({ data: [{ workspaceId: ws.id, projectId: p.id, body: "Kick-off complete. We need your logo to start design.", clientVisible: true }, { workspaceId: ws.id, projectId: p.id, body: "INTERNAL: client slow to reply, margin tight.", clientVisible: false }] });
    }
    const cu = await user(who, `${n} user`, pw);
    await db.clientMembership.upsert({ where: { userId_customerId: { userId: cu.id, customerId: c.id } }, create: { userId: cu.id, customerId: c.id, role: "admin" }, update: {} });
  }
  console.log("Dev accounts (password demo-password-123): demo.owner@example.test, demo.delivery@example.test, client.a@example.test, client.b@example.test");
}
main().then(() => db.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
