import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { ensureStarter, publishTerms, listTerms, saveTermsDraft } from "@/modules/settings/service";
import { LEGAL, PUBLIC_LEGAL } from "@/modules/settings/legal-docs";
import { parseDoc } from "@/documents/parse";
import type { StaffCtx } from "@/modules/identity/session";

async function owner(): Promise<StaffCtx> {
  const w = await db.workspace.create({ data: { name: `pl-${Math.random()}`, legalName: "Test Ltd", companyNumber: "12345678", registeredAddress: "1 Test Road\nWatford" } });
  const m = await db.staffMembership.create({ data: { workspaceId: w.id, email: `l-${Math.random()}@example.test`, displayName: "L Owner", role: "owner", status: "active" } });
  return { userId: null as unknown as string, staffId: m.id, workspaceId: w.id, role: "owner", name: "L Owner", email: m.email };
}

describe("portal legal pages", () => {
  it("privacy, cookies and portal terms exist, are labelled as shown on the portals, and map to /legal/privacy|cookies|terms", () => {
    expect(PUBLIC_LEGAL).toEqual({ privacy: "privacy", cookies: "cookies", terms: "portal_terms" });
    for (const k of ["privacy", "cookies", "portal_terms"] as const) expect(LEGAL[k].audience).toBe("Shown on the portals");
  });

  it("every starter is a valid document; privacy keeps its decisions as TBC and cannot be published until they are made", async () => {
    const c = await owner();
    for (const k of ["privacy", "cookies", "portal_terms"] as const) await ensureStarter(c, k);
    const [priv] = await listTerms(c, "privacy"); const [cook] = await listTerms(c, "cookies"); const [pt] = await listTerms(c, "portal_terms");
    for (const t of [priv, cook, pt]) { expect(parseDoc(t.body).length).toBeGreaterThan(5); expect(t.body).not.toMatch(/PokePiece/i); }
    expect(priv.body).toMatch(/\[TBC: ICO registration number\]/);
    await expect(publishTerms(c, priv.id)).rejects.toMatchObject({ code: "validation" });
    // The cookie and portal-terms starters only claim what the portals really do, and publish as they are.
    expect(cook.body).toMatch(/strictly necessary/i); expect(cook.body).toMatch(/do not use advertising/i);
    await publishTerms(c, cook.id); await publishTerms(c, pt.id);
    expect((await listTerms(c, "cookies"))[0].status).toBe("published");
    // Once the open decisions are filled in, privacy publishes too.
    await saveTermsDraft(c, priv.id, { title: "Privacy Notice", body: priv.body.replace(/\[TBC:[^\]]*\]/g, "Decided.") }, "privacy");
    await publishTerms(c, priv.id);
    expect((await listTerms(c, "privacy"))[0].status).toBe("published");
  });

  it("the privacy notice names the real suppliers and the rights people have", async () => {
    const c = await owner(); await ensureStarter(c, "privacy");
    const body = (await listTerms(c, "privacy"))[0].body;
    for (const w of ["Supabase", "Vercel", "Resend", "Stripe", "Information Commissioner", "Card details", "one month"]) expect(body).toContain(w);
    expect(await db.termsVersion.count({ where: { workspaceId: c.workspaceId, kind: "privacy" } })).toBe(1);
  });
});
