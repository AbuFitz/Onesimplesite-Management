import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { createLead } from "@/modules/crm/service";
import { buildBackup, lastExport, isBackupDue } from "@/modules/export/service";
import type { StaffCtx } from "@/modules/identity/session";

async function ws(role: StaffCtx["role"] = "member"): Promise<StaffCtx> {
  const w = await db.workspace.create({ data: { name: `exp-${Math.random()}` } });
  const m = await db.staffMembership.create({ data: { workspaceId: w.id, email: `e-${Math.random()}@example.test`, displayName: "E", role, status: "active" } });
  return { userId: null as unknown as string, staffId: m.id, workspaceId: w.id, role, name: "E", email: m.email };
}

describe("backup export", () => {
  it("includes this workspace's data only, never credentials, and is recorded", async () => {
    const a = await ws(), b = await ws("owner");
    await createLead(a, { displayName: "Mine Ltd", contactName: "M" });
    await createLead(b, { displayName: "Theirs Ltd", contactName: "T" });
    const { data, counts } = await buildBackup(a);
    expect(data.customers.map((c) => c.displayName)).toEqual(["Mine Ltd"]);
    expect(counts.customers).toBe(1);
    const keys = Object.keys(data).join(",");
    for (const banned of ["session", "account", "password", "tokenHash", "verification", "outbox"]) expect(keys.toLowerCase()).not.toContain(banned.toLowerCase());
    expect(JSON.stringify(data)).not.toMatch(/tokenHash|"password"/);
    expect((await lastExport(a.workspaceId))?.actorLabel).toBe("E");
    expect(isBackupDue(await lastExport(a.workspaceId))).toBe(false);
  });
  it("is denied to roles without export permission and shows 'due' before any backup", async () => {
    const d = await ws("delivery");
    await expect(buildBackup(d)).rejects.toMatchObject({ code: "forbidden" });
    expect(isBackupDue(await lastExport(d.workspaceId))).toBe(true);
  });
});
