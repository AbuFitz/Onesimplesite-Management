import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { ensureStarter, legalOverview, publishTerms, saveTermsDraft, listTerms } from "@/modules/settings/service";
import { LEGAL_KINDS } from "@/modules/settings/legal-docs";
import { parseDoc } from "@/documents/parse";
import type { StaffCtx } from "@/modules/identity/session";

async function owner(): Promise<StaffCtx> {
  const w = await db.workspace.create({ data: { name: `legal-${Math.random()}`, legalName: "Test Ltd", companyNumber: "12345678", registeredAddress: "1 Test Road\nWatford" } });
  const m = await db.staffMembership.create({ data: { workspaceId: w.id, email: `l-${Math.random()}@example.test`, displayName: "L Owner", role: "owner", status: "active" } });
  return { userId: null as unknown as string, staffId: m.id, workspaceId: w.id, role: "owner", name: "L Owner", email: m.email };
}

describe("legal documents", () => {
  it("creates a starter draft for every document, with our company details filled in and decisions marked TBC", async () => {
    const c = await owner();
    const overview = await legalOverview(c);
    expect(overview.map((o) => o.kind)).toEqual([...LEGAL_KINDS]);
    const privacy = (await listTerms(c, "privacy"))[0];
    expect(privacy.body).toContain("Test Ltd");
    expect(privacy.body).toContain("12345678");
    expect(privacy.body).toContain("1 Test Road, Watford");
    expect(privacy.body).toMatch(/\[TBC:/);
    expect(privacy.status).toBe("draft");
  });
  it("cannot publish while TBC markers remain, and publishing one document never retires another", async () => {
    const c = await owner();
    await ensureStarter(c, "terms"); await ensureStarter(c, "cookies");
    const terms = (await listTerms(c, "terms"))[0], cookies = (await listTerms(c, "cookies"))[0];
    await expect(publishTerms(c, cookies.id)).rejects.toMatchObject({ code: "validation" });
    await saveTermsDraft(c, terms.id, { title: "Terms", body: "## Services\n1.1 We build websites." }, "terms");
    await publishTerms(c, terms.id);
    await saveTermsDraft(c, cookies.id, { title: "Cookie Notice", body: "## What\n1.1 We use cookies." }, "cookies");
    await publishTerms(c, cookies.id);
    expect((await listTerms(c, "terms"))[0].status).toBe("published");
    expect((await listTerms(c, "cookies"))[0].status).toBe("published");
  });
  it("editing a published document starts the next version of that document only", async () => {
    const c = await owner();
    await ensureStarter(c, "privacy");
    const v1 = (await listTerms(c, "privacy"))[0];
    await saveTermsDraft(c, v1.id, { title: "Privacy Notice", body: "## Who\n1.1 We are a company." }, "privacy");
    await publishTerms(c, v1.id);
    const v2 = await saveTermsDraft(c, v1.id, { title: "Privacy Notice", body: "## Who\n1.1 We are a company in Watford." }, "privacy");
    expect(v2.number).toBe(2); expect(v2.kind).toBe("privacy"); expect(v2.status).toBe("draft");
    await ensureStarter(c, "dpa");
    expect((await listTerms(c, "dpa"))[0].number).toBe(1);
  });
});

describe("document markup", () => {
  it("understands details rows, tables and signature boxes", () => {
    const b = parseDoc("kv: Company name | Test Ltd\nkv: Number | 123\n| Name | Provider |\n| a | b |\n| c | d |\nsign: For the Client");
    expect(b.map((x) => x.t)).toEqual(["kv", "kv", "table", "sign"]);
    const t = b[2] as { head: string[]; rows: string[][] };
    expect(t.head).toEqual(["Name", "Provider"]); expect(t.rows).toEqual([["a", "b"], ["c", "d"]]);
  });
});
