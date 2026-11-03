import { createHmac, timingSafeEqual } from "node:crypto";

/** Verifies Stripe's `Stripe-Signature` header (HMAC-SHA256 over `t.payload`). Rejects bad signatures and anything older than 5 minutes. */
export function verifyStripeSignature(payload: string, header: string | null, secret: string, now = Date.now()): boolean {
  if (!header) return false;
  const parts = header.split(",").map((p) => p.trim().split("="));
  const t = parts.find(([k]) => k === "t")?.[1];
  const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!t || !sigs.length || !/^\d+$/.test(t)) return false;
  if (Math.abs(now / 1000 - Number(t)) > 300) return false;
  const want = createHmac("sha256", secret).update(`${t}.${payload}`).digest();
  return sigs.some((s) => { try { const b = Buffer.from(s, "hex"); return b.length === want.length && timingSafeEqual(b, want); } catch { return false; } });
}
