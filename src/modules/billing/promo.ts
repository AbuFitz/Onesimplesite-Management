/** An offer agreed with one company on their order, such as "first month free". Stored with the quote's requirements so it is frozen with what they sign. */
export type Promo = { label: string; freeMonths: number; discountMinor: number };

export function promoFrom(req: Record<string, string | undefined> | null | undefined): Promo | null {
  const freeMonths = Number(req?.promoFreeMonths) || 0;
  const discountMinor = Math.round((Number(req?.promoDiscount) || 0) * 100);
  if (freeMonths <= 0 && discountMinor <= 0) return null;
  return { label: req?.promoLabel?.trim() || "Special offer", freeMonths, discountMinor };
}

/** Same day of the month, n months on (31 Jan + 1 month = 28 Feb). */
export function addMonths(d: Date, n: number): Date {
  const out = new Date(d.getTime()); const day = out.getUTCDate();
  out.setUTCDate(1); out.setUTCMonth(out.getUTCMonth() + n);
  const last = new Date(Date.UTC(out.getUTCFullYear(), out.getUTCMonth() + 1, 0)).getUTCDate();
  out.setUTCDate(Math.min(day, last)); return out;
}
/** Stripe counts a free trial in days from when the plan starts. */
export const trialDays = (from: Date, months: number) => Math.max(1, Math.round((+addMonths(from, months) - +from) / 864e5));
export const monthsWords = (n: number) => `${n} month${n === 1 ? "" : "s"}`;
