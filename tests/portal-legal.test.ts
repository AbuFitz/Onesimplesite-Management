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
    for (const need of ["controller", "Contract", "Legitimate interests", "services to us", "card payment provider", "outside the UK", "How long we keep it", "Your rights", "Information Commissioner", "automated", "need to give us"]) expect(b, need).toContain(need);
    for (const brand of ["Supabase", "Vercel", "Resend", "Stripe"]) expect(b + LEGAL_PAGES.cookies.body + LEGAL_PAGES.terms.body, brand).not.toContain(brand);   // categories, not brand names
  });
  it("cookie notice only claims strictly necessary cookies", () => {
    expect(LEGAL_PAGES.cookies.body).toMatch(/strictly necessary/); expect(LEGAL_PAGES.cookies.body).toMatch(/No advertising, tracking or analytics/);
  });

  it("tells people about last-seen, devices and what each side can see", () => {
    const priv = LEGAL_PAGES.privacy.body, cook = LEGAL_PAGES.cookies.body, terms = LEGAL_PAGES.terms.body;
    expect(priv).toContain("## What you can see, and what we can see");
    expect(priv).toMatch(/when you were last active/); expect(priv).toMatch(/which devices you have signed in from/); expect(priv).toMatch(/passkeys/);
    expect(priv).toMatch(/Only our team can see/);
    expect(cook).toMatch(/Device cookie/); expect(cook).toMatch(/Trusted device cookie/);
    expect(terms).toMatch(/last active/); expect(terms).toMatch(/who raised them/);
  });
});
