import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { needsEmailCode, syncCodeRequirement, saveSecuritySettings, securityFrom } from "@/modules/identity/security";
import { passkeyDomain, passkeyRpId } from "@/lib/auth";
import type { StaffCtx } from "@/modules/identity/session";

async function world() {
  const tag = Math.random().toString(36).slice(2, 8);
  const w = await db.workspace.create({ data: { name: `sec-${tag}` } });
  const mk = (id: string) => db.user.create({ data: { id: `${id}-${tag}`, name: id, email: `${id}-${tag}@x.test` } });
  const [staffU, clientU, testerU] = [await mk("staff"), await mk("client"), await mk("tester")];
  const sm = await db.staffMembership.create({ data: { workspaceId: w.id, userId: staffU.id, email: staffU.email, displayName: "S", role: "owner", status: "active" } });
  const c = await db.customer.create({ data: { workspaceId: w.id, reference: `OSS-CU-${tag}`, displayName: "Co" } });
  await db.clientMembership.create({ data: { userId: clientU.id, customerId: c.id, role: "member" } });
  await db.clientMembership.create({ data: { userId: testerU.id, customerId: c.id, role: "member" } });
  const ctx: StaffCtx = { userId: staffU.id, staffId: sm.id, workspaceId: w.id, role: "owner", name: "S", email: staffU.email };
  return { w, staffU, clientU, testerU, ctx };
}

describe("one-time codes on new devices (staged rollout)", () => {
  it("is off by default, then widens: testers, team, everyone", async () => {
    const x = await world();
    expect(securityFrom((await db.workspace.findUniqueOrThrow({ where: { id: x.w.id } })).settings).codes).toBe("off");
    for (const u of [x.staffU, x.clientU]) expect(await needsEmailCode(u.email)).toBe(false);
    await saveSecuritySettings(x.ctx, { codes: "testers", testers: `${x.testerU.email}\n${x.staffU.email.toUpperCase()}` });
    expect(await needsEmailCode(x.testerU.email)).toBe(true); expect(await needsEmailCode(x.staffU.email)).toBe(true); expect(await needsEmailCode(x.clientU.email)).toBe(false);
    await saveSecuritySettings(x.ctx, { codes: "team", testers: "" });
    expect(await needsEmailCode(x.staffU.email)).toBe(true); expect(await needsEmailCode(x.clientU.email)).toBe(false);
    await saveSecuritySettings(x.ctx, { codes: "everyone", testers: "" });
    expect(await needsEmailCode(x.clientU.email)).toBe(true);
    await expect(saveSecuritySettings(x.ctx, { codes: "testers", testers: "" })).rejects.toThrow(/at least one/);
    await expect(saveSecuritySettings(x.ctx, { codes: "nonsense", testers: "" })).rejects.toThrow();
  });
  it("sync flips the account flag with the setting, and leaves authenticator-app users alone", async () => {
    const x = await world();
    await saveSecuritySettings(x.ctx, { codes: "everyone", testers: "" });
    expect(await syncCodeRequirement(x.clientU.email)).toBe(true);
    expect((await db.user.findUniqueOrThrow({ where: { id: x.clientU.id } })).twoFactorEnabled).toBe(true);
    await saveSecuritySettings(x.ctx, { codes: "off", testers: "" });
    expect(await syncCodeRequirement(x.clientU.email)).toBe(false);
    expect((await db.user.findUniqueOrThrow({ where: { id: x.clientU.id } })).twoFactorEnabled).toBe(false);
    await db.twoFactor.create({ data: { id: `tf-${x.staffU.id}`, secret: "s", backupCodes: "b", userId: x.staffU.id, verified: true } });
    await db.user.update({ where: { id: x.staffU.id }, data: { twoFactorEnabled: true } });
    await saveSecuritySettings(x.ctx, { codes: "off", testers: "" });
    await syncCodeRequirement(x.staffU.email);
    expect((await db.user.findUniqueOrThrow({ where: { id: x.staffU.id } })).twoFactorEnabled).toBe(true);   // their authenticator app stays on
  });
  it("one passkey domain covers the team app and the portal", () => {
    expect(passkeyDomain("https://manage.onesimplesite.co.uk", "https://portal.onesimplesite.co.uk")).toBe("onesimplesite.co.uk");
    expect(passkeyDomain("http://manage.localhost:3000", "http://portal.localhost:3000")).toBe("localhost");
    expect(passkeyRpId("https://manage.onesimplesite.co.uk", "https://portal.onesimplesite.co.uk", "https://portal.onesimplesite.co.uk")).toBe("onesimplesite.co.uk");
    expect(passkeyRpId("http://manage.localhost:3000", "http://portal.localhost:3000", "http://portal.localhost:3000")).toBe("portal.localhost");   // development only
  });
});
