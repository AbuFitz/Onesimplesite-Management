import { describe, it, expect } from "vitest";
import { hashPassword } from "better-auth/crypto";
import { db } from "@/lib/db";
import { updateProfile, changeOwnEmail, getMyProfile, profileMissing } from "@/modules/identity/profile";
import type { StaffCtx } from "@/modules/identity/session";

async function member(): Promise<StaffCtx> {
  const w = await db.workspace.create({ data: { name: `prof-${Math.random()}` } });
  const email = `p-${Math.random()}@example.test`;
  const u = await db.user.create({ data: { id: `u-${Math.random()}`, name: "Pat Lee", email, emailVerified: true } });
  await db.account.create({ data: { id: `a-${Math.random()}`, accountId: u.id, providerId: "credential", userId: u.id, password: await hashPassword("correct-password-1") } });
  const m = await db.staffMembership.create({ data: { workspaceId: w.id, userId: u.id, email, displayName: "Pat Lee", role: "member", status: "active" } });
  return { userId: u.id, staffId: m.id, workspaceId: w.id, role: "member", name: "Pat Lee", email };
}

describe("my account", () => {
  it("asks for a job title and signature until both are set; phone stays optional", async () => {
    const c = await member();
    expect(profileMissing(await getMyProfile(c))).toEqual(["job title", "email signature"]);
    await updateProfile(c, { name: "Pat Lee", jobTitle: "Designer", signature: "Kind regards,\r\nPat" });
    const me = await getMyProfile(c);
    expect(profileMissing(me)).toEqual([]);
    expect(me.phone).toBeNull();
    expect(me.signature).toBe("Kind regards,\nPat");
  });
  it("changing the email needs the right password, refuses duplicates, and keeps the username", async () => {
    const c = await member(), other = await member();
    await expect(changeOwnEmail(c, "new@example.test", "wrong-password")).rejects.toMatchObject({ code: "forbidden" });
    await expect(changeOwnEmail(c, other.email, "correct-password-1")).rejects.toMatchObject({ code: "conflict" });
    const newEmail = `New.${Math.random().toString(36).slice(2)}@Example.test`;
    await changeOwnEmail(c, newEmail, "correct-password-1");
    const me = await getMyProfile(c);
    expect(me.email).toBe(newEmail.toLowerCase());
    expect((await db.user.findUniqueOrThrow({ where: { id: c.userId } })).email).toBe(newEmail.toLowerCase());
  });
});
