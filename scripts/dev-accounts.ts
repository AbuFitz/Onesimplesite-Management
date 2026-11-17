import "dotenv/config";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { db } from "../src/lib/db";

/**
 * Test logins for the DEV site (safe to run again and again; only adds what is missing). Dev only: it refuses to run unless APP_ENV=staging.
 * Everyone uses the DEMO_PASSWORD from the dev settings. Staff sign in with the username, customers with the email.
 */
if (process.env.APP_ENV !== "staging") { console.error("REFUSING: dev accounts are for the dev site only (APP_ENV=staging)."); process.exit(1); }
const pw = process.env.DEMO_PASSWORD || "demo-password-123";

async function user(email: string, name: string) {
  const u = (await db.user.findUnique({ where: { email } })) ?? (await db.user.create({ data: { id: randomUUID().replaceAll("-", ""), email, name, emailVerified: true } }));
  if (!(await db.account.findFirst({ where: { userId: u.id, providerId: "credential" } }))) {
    await db.account.create({ data: { id: randomUUID(), accountId: u.id, providerId: "credential", userId: u.id, password: await hashPassword(pw) } });
  }
  return u;
}

const STAFF = [
  ["abukar.sharif", "Abukar Sharif (dev)", "owner"],
  ["dev.director", "Dev Client Director", "client_director"],
  ["dev.delivery", "Dev Delivery", "delivery"],
  ["dev.sales", "Dev Sales", "sales"],
  ["dev.support", "Dev Support", "support"],
  ["dev.finance", "Dev Finance", "finance"],
  ["dev.member", "Dev Team Member", "member"],
] as const;
// [email, name, role at Harbour Bakery, also at Northside Physio?]
const CLIENTS = [
  ["portal.abukar.sharif@example.test", "Abukar Sharif (dev customer)", "admin", "admin"],
  ["portal.admin@example.test", "Portal Admin", "admin", null],
  ["portal.member@example.test", "Portal Member", "member", null],
  ["portal.viewer@example.test", "Portal Viewer", "viewer", null],
] as const;

async function main() {
  const ws = await db.workspace.findFirst({ where: { name: "OneSimpleSite" } });
  if (!ws) throw new Error("No workspace yet. Run the dev seed first.");
  for (const [username, displayName, role] of STAFF) {
    const email = `${username}@example.test`;
    const u = await user(email, displayName);
    await db.staffMembership.upsert({
      where: { workspaceId_email: { workspaceId: ws.id, email } },
      create: { workspaceId: ws.id, userId: u.id, email, displayName, username, role, status: "active" },
      update: { userId: u.id, username, role, status: "active" },
    });
  }
  const harbour = await db.customer.findFirst({ where: { workspaceId: ws.id, displayName: "Harbour Bakery" } });
  const northside = await db.customer.findFirst({ where: { workspaceId: ws.id, displayName: "Northside Physio" } });
  for (const [email, name, r1, r2] of CLIENTS) {
    const u = await user(email, name);
    for (const [c, role] of [[harbour, r1], [northside, r2]] as const) {
      if (!c || !role) continue;
      await db.clientMembership.upsert({ where: { userId_customerId: { userId: u.id, customerId: c.id } }, create: { userId: u.id, customerId: c.id, role }, update: { role } });
    }
  }
  console.log("Dev logins ready (password = DEMO_PASSWORD). Team (username): " + STAFF.map((s) => s[0]).join(", ") + ". Customers (email): " + CLIENTS.map((c) => c[0]).join(", "));
}
main().then(() => db.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
