import { describe, it, expect } from "vitest";
import { LEGAL_PAGES } from "@/modules/legal-public/content";
import { fillVars, VARIABLES } from "@/modules/settings/variables";
import { parseDoc } from "@/documents/parse";

describe("portal legal pages (in code)", () => {
  it("privacy, cookies and terms exist, parse as documents, and use only known placeholders", () => {
    expect(Object.keys(LEGAL_PAGES).sort()).toEqual(["cookies", "privacy", "terms"]);
    const known = new Set([...VARIABLES.map((v) => v.key), "legal_name", "registered_office"]);
    for (const p of Object.values(LEGAL_PAGES)) {
      expect(parseDoc(p.body).length).toBeGreaterThan(5);
      for (const m of p.body.matchAll(/\{\{(\w+)\}\}/g)) expect(known.has(m[1]), `${p.slug}: {{${m[1]}}}`).toBe(true);
      expect(p.body).not.toMatch(/\[TBC|TODO|PokePiece/i);
    }
  });
  it("covers what UK GDPR requires us to tell people", () => {
    const b = LEGAL_PAGES.privacy.body;
    for (const need of ["controller", "Contract", "Legitimate interests", "Supabase", "Vercel", "Resend", "Stripe", "outside the UK", "How long we keep it", "Your rights", "Information Commissioner", "automated", "need to give us"]) expect(b, need).toContain(need);
  });
  it("cookie notice only claims strictly necessary cookies", () => {
    expect(LEGAL_PAGES.cookies.body).toMatch(/strictly necessary/); expect(LEGAL_PAGES.cookies.body).toMatch(/No advertising, tracking or analytics/);
  });
});
