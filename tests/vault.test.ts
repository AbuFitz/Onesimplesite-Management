import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { createVaultEntry, listVault, revealVaultSecret, updateVaultEntry } from "@/modules/vault/service";
import type { StaffCtx } from "@/modules/identity/session";

async function ws(role: StaffCtx["role"] = "member"): Promise<StaffCtx> {
  const w = await db.workspace.create({ data: { name: `vault-${Math.random()}` } });
  const m = await db.staffMembership.create({ data: { workspaceId: w.id, email: `v-${Math.random()}@example.test`, displayName: "V Tester", role, status: "active" } });
  return { userId: null as unknown as string, staffId: m.id, workspaceId: w.id, role, name: "V Tester", email: m.email };
}

describe("team password vault", () => {
  it("stores the password encrypted, never lists it, and reveals it with an audit record", async () => {
    const a = await ws();
    const id = await createVaultEntry(a, { title: "Namecheap", username: "ops@x.co", secret: "correct-horse-9!" });
    const stored = await db.vaultEntry.findUniqueOrThrow({ where: { id } });
    expect(stored.secret).not.toContain("correct-horse");
    expect(stored.secret.startsWith("v1:")).toBe(true);
    const list = await listVault(a);
    expect(JSON.stringify(list)).not.toContain("correct-horse");
    expect(JSON.stringify(list)).not.toContain("v1:");
    expect(await revealVaultSecret(a, id)).toBe("correct-horse-9!");
    expect(await db.auditEvent.count({ where: { workspaceId: a.workspaceId, action: "vault.revealed" } })).toBe(1);
  });
  it("keeps the old password when the field is left blank, and changes it when given", async () => {
    const a = await ws();
    const id = await createVaultEntry(a, { title: "Xero", secret: "first-secret" });
    await updateVaultEntry(a, id, { title: "Xero (new)", secret: "" });
    expect(await revealVaultSecret(a, id)).toBe("first-secret");
    await updateVaultEntry(a, id, { title: "Xero (new)", secret: "second-secret" });
    expect(await revealVaultSecret(a, id)).toBe("second-secret");
  });
  it("is private to its own workspace", async () => {
    const a = await ws(), b = await ws();
    const id = await createVaultEntry(a, { title: "Hosting", secret: "s3cret" });
    await expect(revealVaultSecret(b, id)).rejects.toMatchObject({ code: "not_found" });
    expect(await listVault(b)).toHaveLength(0);
  });
  it("is open to every staff level", async () => {
    const d = await ws("delivery");
    await expect(createVaultEntry(d, { title: "Canva", secret: "x" })).resolves.toBeTruthy();
  });
});
