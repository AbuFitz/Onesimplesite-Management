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
    const dpa = (await listTerms(c, "dpa"))[0];
    expect(dpa.body).toContain("Test Ltd");
    expect(dpa.body).toContain("12345678");
    expect(dpa.body).toContain("1 Test Road, Watford");
    expect(dpa.body).toMatch(/\[TBC:/);
    expect(dpa.status).toBe("draft");
  });
  it("cannot publish while TBC markers remain, and publishing one document never retires another", async () => {
    const c = await owner();
    await ensureStarter(c, "terms"); await ensureStarter(c, "dpa"); await ensureStarter(c, "change_request");
    const terms = (await listTerms(c, "terms"))[0], dpa = (await listTerms(c, "dpa"))[0], change_request = (await listTerms(c, "change_request"))[0];
    await expect(publishTerms(c, dpa.id)).rejects.toMatchObject({ code: "validation" });
    expect(change_request.body).not.toMatch(/\[TBC:/); // filled in per customer, so nothing to decide here
    await saveTermsDraft(c, terms.id, { title: "Terms", body: "## Services\n1.1 We build websites." }, "terms");
    await publishTerms(c, terms.id);
    await saveTermsDraft(c, change_request.id, { title: "Change Request", body: "## What\n1.1 We agree changes in writing." }, "change_request");
    await publishTerms(c, change_request.id);
    expect((await listTerms(c, "terms"))[0].status).toBe("published");
    expect((await listTerms(c, "change_request"))[0].status).toBe("published");
  });
  it("editing a published document starts the next version of that document only", async () => {
    const c = await owner();
    await ensureStarter(c, "dpa");
    const v1 = (await listTerms(c, "dpa"))[0];
    await saveTermsDraft(c, v1.id, { title: "Data Processing Agreement", body: "## Who\n1.1 We are a company." }, "dpa");
    await publishTerms(c, v1.id);
    const v2 = await saveTermsDraft(c, v1.id, { title: "Data Processing Agreement", body: "## Who\n1.1 We are a company in Watford." }, "dpa");
    expect(v2.number).toBe(2); expect(v2.kind).toBe("dpa"); expect(v2.status).toBe("draft");
    await ensureStarter(c, "change_request");
    expect((await listTerms(c, "change_request"))[0].number).toBe(1);
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
