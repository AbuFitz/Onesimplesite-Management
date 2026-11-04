import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { twoStepRequired, mustSetUpTwoStep, saveSecuritySettings, securityFrom, resetTwoStep, noteDevice, forgetSecurityCache, twoStepStatus } from "@/modules/identity/security";
import { passkeyDomain, passkeyRpId } from "@/lib/auth";
import type { StaffCtx } from "@/modules/identity/session";

async function world() {
  const tag = Math.random().toString(36).slice(2, 8);
  const w = await db.workspace.create({ data: { name: `sec-${tag}` } });
  const mk = (id: string) => db.user.create({ data: { id: `${id}-${tag}`, name: id, email: `${id}-${tag}@x.test` } });
  const [staffU, otherU, clientU, testerU] = [await mk("staff"), await mk("other"), await mk("client"), await mk("tester")];
  const sm = await db.staffMembership.create({ data: { workspaceId: w.id, userId: staffU.id, email: staffU.email, displayName: "S", role: "owner", status: "active" } });
  await db.staffMembership.create({ data: { workspaceId: w.id, userId: otherU.id, email: otherU.email, displayName: "Other", role: "member", status: "active" } });
  const c = await db.customer.create({ data: { workspaceId: w.id, reference: `OSS-CU-${tag}`, displayName: "Co" } });
  await db.clientMembership.create({ data: { userId: clientU.id, customerId: c.id, role: "member" } });
  await db.clientMembership.create({ data: { userId: testerU.id, customerId: c.id, role: "member" } });
  const ctx: StaffCtx = { userId: staffU.id, staffId: sm.id, workspaceId: w.id, role: "owner", name: "S", email: staffU.email };
  const areas = { staff: [{ workspaceId: w.id, staff: true }], client: [{ workspaceId: w.id, staff: false }] };
  return { w, staffU, otherU, clientU, testerU, ctx, areas };
}

describe("two-step sign-in (staged rollout)", () => {
  it("is off by default, then widens: testers, team, everyone", async () => {
    const x = await world();
    expect(securityFrom((await db.workspace.findUniqueOrThrow({ where: { id: x.w.id } })).settings).codes).toBe("off");
    expect(await twoStepRequired(x.staffU.email, x.areas.staff)).toBe(false);
    await saveSecuritySettings(x.ctx, { codes: "testers", testers: `${x.testerU.email}\n${x.staffU.email.toUpperCase()}` });
    expect(await twoStepRequired(x.testerU.email, x.areas.client)).toBe(true); expect(await twoStepRequired(x.staffU.email, x.areas.staff)).toBe(true); expect(await twoStepRequired(x.clientU.email, x.areas.client)).toBe(false);
    await saveSecuritySettings(x.ctx, { codes: "team", testers: "" });
    expect(await twoStepRequired(x.otherU.email, x.areas.staff)).toBe(true); expect(await twoStepRequired(x.clientU.email, x.areas.client)).toBe(false);
    await saveSecuritySettings(x.ctx, { codes: "everyone", testers: "" });
    expect(await twoStepRequired(x.clientU.email, x.areas.client)).toBe(true);
    await expect(saveSecuritySettings(x.ctx, { codes: "testers", testers: "" })).rejects.toThrow(/at least one/);
    await expect(saveSecuritySettings(x.ctx, { codes: "nonsense", testers: "" })).rejects.toThrow();
  });
  it("someone required to, who hasn't set it up, must set it up; an authenticator app satisfies it", async () => {
    const x = await world();
    await saveSecuritySettings(x.ctx, { codes: "everyone", testers: "" });
    expect(await mustSetUpTwoStep(x.clientU.id, x.clientU.email, x.areas.client)).toBe(true);
    await db.twoFactor.create({ data: { id: `tf-${x.clientU.id}`, secret: "s", backupCodes: "b", userId: x.clientU.id, verified: true } });
    expect(await mustSetUpTwoStep(x.clientU.id, x.clientU.email, x.areas.client)).toBe(false);
    await saveSecuritySettings(x.ctx, { codes: "off", testers: "" });
    expect(await mustSetUpTwoStep(x.testerU.id, x.testerU.email, x.areas.client)).toBe(false);   // off: never required
  });
  it("support can reset a customer or a team member; not yourself; only owners reset the team", async () => {
    const x = await world();
    for (const u of [x.clientU, x.otherU]) {
      await db.twoFactor.create({ data: { id: `tf-${u.id}`, secret: "s", backupCodes: "b", userId: u.id, verified: true } });
      await db.passkey.create({ data: { id: `pk-${u.id}`, userId: u.id, publicKey: "k", credentialID: `c-${u.id}`, counter: 0, deviceType: "singleDevice", backedUp: false } });
      await db.verification.create({ data: { id: `v-${u.id}`, identifier: "trust-device-abc" + u.id, value: u.id, expiresAt: new Date(Date.now() + 1e6) } });
      await db.knownDevice.create({ data: { userId: u.id, deviceHash: "h", label: "Chrome on Windows" } });
      await db.user.update({ where: { id: u.id }, data: { twoFactorEnabled: true } });
    }
    await resetTwoStep(x.ctx, { userId: x.clientU.id, kind: "client" });
    await resetTwoStep(x.ctx, { userId: x.otherU.id, kind: "staff" });
    for (const u of [x.clientU, x.otherU]) {
      expect((await twoStepStatus([u.id])).get(u.id)).toEqual({ authenticator: false, passkeys: 0 });
      expect(await db.verification.count({ where: { value: u.id } })).toBe(0); expect(await db.knownDevice.count({ where: { userId: u.id } })).toBe(0);
      expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).twoFactorEnabled).toBe(false);
    }
    expect(await db.auditEvent.count({ where: { workspaceId: x.w.id, action: "security.two_step_reset" } })).toBe(2);
    await expect(resetTwoStep(x.ctx, { userId: x.staffU.id, kind: "staff" })).rejects.toThrow(/another owner/);
    await expect(resetTwoStep({ ...x.ctx, role: "member" } as never, { userId: x.otherU.id, kind: "staff" })).rejects.toThrow();
    await expect(resetTwoStep(x.ctx, { userId: "nobody", kind: "client" })).rejects.toThrow();
  });
  it("a new sign-in notice is only for a device we haven't seen, and not for the very first one", async () => {
    const x = await world();
    forgetSecurityCache();
    const u = { userId: x.staffU.id, email: x.staffU.email, name: "S" };
    const fresh = new Date();
    await noteDevice(u, fresh, "browser-1", "Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537");   // first device ever: remembered, no email
    await noteDevice(u, fresh, "browser-1", "Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537");   // same device: nothing
    await noteDevice(u, fresh, "browser-2", "Mozilla/5.0 (iPhone; CPU iPhone OS 17) Safari/604");     // a second, unseen device: notice
    await noteDevice(u, new Date(Date.now() - 3600_000), "browser-3", "x");                            // old session: not even looked at
    expect(await db.knownDevice.count({ where: { userId: x.staffU.id } })).toBe(2);
  });
  it("one passkey domain covers the team app and the portal", () => {
    expect(passkeyDomain("https://manage.onesimplesite.co.uk", "https://portal.onesimplesite.co.uk")).toBe("onesimplesite.co.uk");
    expect(passkeyRpId("https://manage.onesimplesite.co.uk", "https://portal.onesimplesite.co.uk", "https://portal.onesimplesite.co.uk")).toBe("onesimplesite.co.uk");
    expect(passkeyRpId("http://manage.localhost:3000", "http://portal.localhost:3000", "http://portal.localhost:3000")).toBe("portal.localhost");   // development only
  });
});
