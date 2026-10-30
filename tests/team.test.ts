import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { CAPS, can } from "@/modules/identity/permissions";
import { inviteStaff, listTeam, changeRole, setActive } from "@/modules/identity/team";
import type { StaffCtx } from "@/modules/identity/session";

async function team() {
  const w = await db.workspace.create({ data: { name: `team-${Math.random()}` } });
  const mk = async (role: StaffCtx["role"], label: string, withUser = false) => {
    const email = `${label}-${Math.random()}@example.test`;
    let userId: string | null = null;
    if (withUser) { userId = `u${Math.random()}`.replace(".", ""); await db.user.create({ data: { id: userId, name: label, email, emailVerified: true } }); }
    const m = await db.staffMembership.create({ data: { workspaceId: w.id, email, displayName: label, role, status: "active", userId } });
    return { userId: userId as string, staffId: m.id, workspaceId: w.id, role, name: label, email } as StaffCtx;
  };
  return { w, owner: await mk("owner", "owner", true), member: await mk("member", "member", true), mk };
}

describe("team member level", () => {
  it("has every business capability except managing logins and settings", () => {
    const missing = CAPS.filter((c) => !can("member", c));
    expect(missing.sort()).toEqual(["settings.write", "staff.manage"]);
  });
  it("a member can't see or manage the team; an owner can", async () => {
    const { owner, member } = await team();
    await expect(listTeam(member)).rejects.toMatchObject({ code: "forbidden" });
    await expect(inviteStaff(member, { name: "X", email: "x@example.test", role: "owner" })).rejects.toMatchObject({ code: "forbidden" });
    expect((await listTeam(owner)).length).toBeGreaterThan(0);
  });
  it("invite returns a one-time link, stores only a hash, and re-invite revokes the old one", async () => {
    const { owner, w } = await team();
    const a = await inviteStaff(owner, { name: "New Person", email: "New.Person@Example.test", role: "member" });
    const token = a.link.split("/invite/")[1];
    expect(await db.invitation.count({ where: { tokenHash: token } })).toBe(0);
    await inviteStaff(owner, { name: "New Person", email: "new.person@example.test", role: "member" });
    const live = await db.invitation.count({ where: { workspaceId: w.id, email: "new.person@example.test", revokedAt: null, acceptedAt: null } });
    expect(live).toBe(1);
  });
  it("can't demote or deactivate yourself or the last owner; deactivation ends sessions", async () => {
    const { owner, member, w } = await team();
    await expect(changeRole(owner, owner.staffId, "member")).rejects.toMatchObject({ code: "validation" });
    await expect(setActive(owner, owner.staffId, false)).rejects.toMatchObject({ code: "validation" });
    await db.session.create({ data: { id: `s${Math.random()}`, token: `t${Math.random()}`, userId: member.userId, expiresAt: new Date(Date.now() + 1e6) } });
    await setActive(owner, member.staffId, false);
    expect(await db.session.count({ where: { userId: member.userId } })).toBe(0);
    expect((await db.staffMembership.findUniqueOrThrow({ where: { id: member.staffId } })).status).toBe("deactivated");
    const other = await db.staffMembership.create({ data: { workspaceId: w.id, email: `o2-${Math.random()}@example.test`, displayName: "o2", role: "owner", status: "active" } });
    await changeRole(owner, other.id, "member"); // allowed: owner remains
  });
});
