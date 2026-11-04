import { describe, it, expect } from "vitest";
import { isUkPostcode, normalisePostcode, composeAddress, parseAddress, checkAddress } from "@/lib/address";
import { tidyPhone } from "@/lib/phone";
import { db } from "@/lib/db";
import { registerBusiness } from "@/modules/crm/register";
import { updateCustomerDetails } from "@/modules/crm/service";
import type { StaffCtx } from "@/modules/identity/session";

describe("addresses and phones", () => {
  it("validates and tidies UK postcodes", () => {
    expect(normalisePostcode("sw1a1aa")).toBe("SW1A 1AA"); expect(normalisePostcode(" bs1  4dj ")).toBe("BS1 4DJ");
    expect(isUkPostcode("BS1 4DJ")).toBe(true); expect(isUkPostcode("M1 1AE")).toBe(true); expect(isUkPostcode("12345")).toBe(false); expect(isUkPostcode("Bristol")).toBe(false);
  });
  it("composes the printed address and parses old single-box addresses", () => {
    expect(composeAddress({ addressLine1: "1 High St", addressLine2: "", town: "Bristol", postcode: "BS1 4DJ" })).toBe("1 High St\nBristol\nBS1 4DJ");
    expect(parseAddress("1 High Street\nUnit 2\nBristol\nbs14dj")).toEqual({ addressLine1: "1 High Street", addressLine2: "Unit 2", town: "Bristol", postcode: "BS1 4DJ" });
    expect(checkAddress({})).toBeNull(); expect(checkAddress({ addressLine1: "1 High St" })).toMatch(/town/i);
    expect(checkAddress({ addressLine1: "1 High St", town: "Bristol", postcode: "nope" })).toMatch(/postcode/i);
  });
  it("tidies phone numbers", () => {
    expect(tidyPhone("")).toBe(""); expect(tidyPhone("07911 123456")).toBe("07911 123456"); expect(tidyPhone("07911-123-456")).toBe("07911 123456");
    expect(tidyPhone("+44 (0)7911 123456")).toMatch(/^\+44 /); expect(tidyPhone("12")).toBeNull(); expect(tidyPhone("abc")).toBeNull();
  });
  it("company setup stores the parts and the printed address; bad postcodes are refused", async () => {
    const w = await db.workspace.create({ data: { name: `ad-${Math.random()}` } });
    const m = await db.staffMembership.create({ data: { workspaceId: w.id, email: `s-${Math.random()}@x.test`, displayName: "A", role: "owner", status: "active" } });
    const ctx: StaffCtx = { userId: null as unknown as string, staffId: m.id, workspaceId: w.id, role: "owner", name: "A", email: m.email };
    const base = { kind: "business", displayName: "Harbour Bakery", contactName: "Hana Baker", contactEmail: `h-${Math.random()}@c.test` };
    await expect(registerBusiness(ctx, { ...base, addressLine1: "1 High St", town: "Bristol", postcode: "nope" })).rejects.toThrow();
    const c = await registerBusiness(ctx, { ...base, addressLine1: "1 High St", town: "Bristol", postcode: "bs14dj", contactPhone: "07911 123456" });
    const row = await db.customer.findUniqueOrThrow({ where: { id: c.id } });
    expect(row.postcode).toBe("BS1 4DJ"); expect(row.billingAddress).toBe("1 High St\nBristol\nBS1 4DJ");
    await updateCustomerDetails(ctx, c.id, row.version, { kind: "business", addressLine1: "2 Low Rd", addressLine2: "Unit 4", town: "Bath", postcode: "ba11aa" });
    const after = await db.customer.findUniqueOrThrow({ where: { id: c.id } });
    expect(after.billingAddress).toBe("2 Low Rd\nUnit 4\nBath\nBA1 1AA");
  });
});
