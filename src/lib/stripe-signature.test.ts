import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyStripeSignature } from "./stripe-signature";

const sign = (p: string, s: string, t: number) => `t=${t},v1=${createHmac("sha256", s).update(`${t}.${p}`).digest("hex")}`;
describe("stripe signature", () => {
  const now = 1_800_000_000_000, t = now / 1000;
  it("accepts a valid signature", () => expect(verifyStripeSignature("{}", sign("{}", "whsec_a", t), "whsec_a", now)).toBe(true));
  it("rejects a wrong secret, a changed body, a stale time and a missing header", () => {
    expect(verifyStripeSignature("{}", sign("{}", "whsec_b", t), "whsec_a", now)).toBe(false);
    expect(verifyStripeSignature("{x}", sign("{}", "whsec_a", t), "whsec_a", now)).toBe(false);
    expect(verifyStripeSignature("{}", sign("{}", "whsec_a", t - 900), "whsec_a", now)).toBe(false);
    expect(verifyStripeSignature("{}", null, "whsec_a", now)).toBe(false);
  });
});
