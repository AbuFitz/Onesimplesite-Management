import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { db } from "@/lib/db";
import { sendTestEmails } from "@/modules/settings/email-test";
import type { StaffCtx } from "@/modules/identity/session";

async function ctx(role: StaffCtx["role"]): Promise<StaffCtx> {
  const w = await db.workspace.create({ data: { name: `et-${Math.random()}`, legalName: "Test Ltd", registeredAddress: "1 Road" } });
  const m = await db.staffMembership.create({ data: { workspaceId: w.id, email: `t-${Math.random()}@example.test`, displayName: "T", role, status: "active" } });
  return { userId: null as unknown as string, staffId: m.id, workspaceId: w.id, role, name: "T", email: m.email };
}

describe("test emails", () => {
  it("sends every template to hello@ only, marked [TEST], with a sample PDF on the signing emails", async () => {
    const c = await ctx("owner");
    const before = new Set(readdirSync(".mail-sink").filter((f) => f.endsWith(".json")));
    const results = await sendTestEmails(c);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(results).toHaveLength(25);
    const mails = readdirSync(".mail-sink").filter((f) => f.endsWith(".json") && !before.has(f)).map((f) => JSON.parse(readFileSync(`.mail-sink/${f}`, "utf8")));
    expect(mails).toHaveLength(25);
    expect(new Set(mails.map((m) => m.to))).toEqual(new Set(["hello@onesimplesite.co.uk"]));
    expect(mails.every((m) => m.subject.startsWith("[TEST] "))).toBe(true);
    expect(mails.filter((m) => m.attachments?.length).length).toBe(2);
    expect(mails.every((m) => /<img/.test(m.html) && (m.html.includes("#0C6A49") || m.html.includes("#4FD9A0")))).toBe(true); // wordmark and brand green are in every one
    expect(await db.auditEvent.count({ where: { workspaceId: c.workspaceId, action: "email.test_sent" } })).toBe(1);
  });
  it("can send just one, and is refused to roles without settings access", async () => {
    const c = await ctx("owner");
    expect(await sendTestEmails(c, "password_reset")).toHaveLength(1);
    await expect(sendTestEmails(await ctx("delivery"))).rejects.toMatchObject({ code: "forbidden" });
  });
});
