import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { syncLegalDocs } from "@/modules/settings/sync-legal";
import { LEGAL_KINDS } from "@/modules/settings/legal-docs";
import { SERVICES_AGREEMENT, SERVICE_LEVEL_AGREEMENT, HOSTING_CARE_TERMS, LEGAL_SET_VERSION } from "@/modules/settings/legal-text";
import { parseDoc, renumberTerms, hasPlaceholders } from "@/documents/parse";
import { unknownVars } from "@/modules/settings/variables";

describe("the v1.4 legal set", () => {
  it("keeps the Terms' clause numbers and cross-references intact once embedded in an agreement", () => {
    const t = renumberTerms(SERVICES_AGREEMENT);
    const clauses = parseDoc(t).filter((b) => b.t === "clause").map((b) => (b as { n: string }).n);
    for (const n of ["3.1", "3.4", "4.1", "4.2", "4.5", "5.4", "6.1", "6.4", "6.5", "7.1", "7.4", "9.1", "9.4", "13.1", "13.2", "14.1", "14.6", "14.7", "16.1", "16.4"]) expect(clauses, n).toContain(n);
    expect(parseDoc(t).filter((b) => b.t === "tsec")).toHaveLength(23);
    // every "clause N.N" the text points at really exists as a numbered sub-clause or a section
    const refs = [...SERVICES_AGREEMENT.matchAll(/clauses? (\d+(?:\.\d+)?)/g)].map((m) => m[1]);
    for (const r of new Set(refs)) expect(r.includes(".") ? clauses.includes(r) : Number(r) >= 1 && Number(r) <= 23, `clause ${r}`).toBe(true);
    for (const d of [SERVICES_AGREEMENT, SERVICE_LEVEL_AGREEMENT, HOSTING_CARE_TERMS]) { expect(hasPlaceholders(d)).toBe(false); expect(unknownVars(d)).toEqual([]); }
  });

  it("publishes the whole set automatically, once, and then leaves later edits alone", async () => {
    const w = await db.workspace.create({ data: { name: `lg-${Math.random()}`, legalName: "OneSimpleSite LTD", companyNumber: "17552675", registeredAddress: "3F Foxhill\nWatford\nWD24 6SX" } });
    // an older published SLA exists
    await db.termsVersion.create({ data: { workspaceId: w.id, kind: "sla", number: 1, title: "Service Level Agreement", body: "old wording", status: "published", publishedAt: new Date(), publishedBy: "Someone" } });
    const r = await syncLegalDocs(w.id);
    expect([...r.published].sort()).toEqual([...LEGAL_KINDS].sort());
    for (const kind of LEGAL_KINDS) expect((await db.termsVersion.findMany({ where: { workspaceId: w.id, kind, status: "published" } })).length, kind).toBe(1);
    const sla = await db.termsVersion.findFirstOrThrow({ where: { workspaceId: w.id, kind: "sla", status: "published" } });
    expect(sla.number).toBe(2); expect(sla.body).toContain("99.9%"); expect(sla.publishedBy).toContain(LEGAL_SET_VERSION);
    expect((await db.termsVersion.findFirstOrThrow({ where: { workspaceId: w.id, kind: "sla", number: 1 } })).status).toBe("retired");
    expect((await db.termsVersion.findFirstOrThrow({ where: { workspaceId: w.id, kind: "terms", status: "published" } })).body).toContain("Version | 1.4");
    // a person edits and publishes their own version later: a second sync does nothing
    await db.termsVersion.updateMany({ where: { workspaceId: w.id, kind: "sla", status: "published" }, data: { status: "retired" } });
    await db.termsVersion.create({ data: { workspaceId: w.id, kind: "sla", number: 3, title: "Service Level Agreement", body: "our own edit", status: "published", publishedAt: new Date(), publishedBy: "Abukar" } });
    expect((await syncLegalDocs(w.id)).skipped).toBe("up to date");
    expect((await db.termsVersion.findFirstOrThrow({ where: { workspaceId: w.id, kind: "sla", status: "published" } })).body).toBe("our own edit");
  });
});
