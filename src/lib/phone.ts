/** Tidies a phone number the way people type them. Throws nothing: returns null when it can't be a phone number. */
export function tidyPhone(input: string | null | undefined): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return "";
  let t = raw.replace(/[^\d+]/g, "");
  if (t.startsWith("00")) t = "+" + t.slice(2);
  const digits = t.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 15) return null;
  if (t.startsWith("+44")) { const n = digits.slice(2); return `+44 ${n.replace(/^0/, "").replace(/^(\d{4})(\d+)$/, "$1 $2")}`.replace(/\s+/g, " ").trim(); }
  if (t.startsWith("0") && digits.length === 11) return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  return t.startsWith("+") ? t : digits;
}
