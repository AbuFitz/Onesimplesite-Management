/** An offer agreed with one company on their order, such as "first month free". Stored with the quote's requirements so it is frozen with what they sign. */
export type Promo = { label: string; freeMonths: number; discountMinor: number; percent: number };

/** Reads the offer. Pass the website fee so a percentage can be turned into pounds; the discount can never be more than the fee. */
export function promoFrom(req: Record<string, string | undefined> | null | undefined, oneOffMinor = 0): Promo | null {
  const freeMonths = Number(req?.promoFreeMonths) || 0;
  const percent = Math.min(100, Math.max(0, Number(req?.promoPercent) || 0));
  const fixed = Math.round((Number(req?.promoDiscount) || 0) * 100);
  const wanted = Math.round((oneOffMinor * percent) / 100) + fixed;
  const discountMinor = oneOffMinor > 0 ? Math.min(oneOffMinor, wanted) : fixed;
  if (freeMonths <= 0 && percent <= 0 && fixed <= 0) return null;
  return { label: req?.promoLabel?.trim() || "Special offer", freeMonths, discountMinor, percent };
}
/** How the discount reads on a document: "10% off", "£200.00 off", or both. */
export const discountWords = (p: Promo, fmt: (n: number) => string) => (p.percent > 0 ? `${p.percent}% off${p.discountMinor > 0 ? ` (${fmt(p.discountMinor)})` : ""}` : `${fmt(p.discountMinor)} off`);

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
