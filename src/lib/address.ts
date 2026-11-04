/** UK address helpers. The company record keeps the parts (line 1, line 2, town, postcode) and a composed multi-line text that agreements, receipts and emails print. */
const PC = /^(GIR ?0AA|[A-PR-UWYZ][A-HK-Y]?[0-9][0-9A-HJKPSTUW]?\s*[0-9][ABD-HJLNP-UW-Z]{2})$/i;

export const isUkPostcode = (s: string) => PC.test(s.trim());
/** "sw1a1aa" -> "SW1A 1AA". Anything that isn't a UK postcode is just upper-cased and tidied. */
export function normalisePostcode(s: string): string {
  const t = s.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return t.length >= 5 && t.length <= 7 && PC.test(t) ? `${t.slice(0, -3)} ${t.slice(-3)}` : s.toUpperCase().replace(/\s+/g, " ").trim();
}

export type AddressParts = { addressLine1?: string | null; addressLine2?: string | null; town?: string | null; postcode?: string | null };
export const hasAddress = (a: AddressParts) => !!(a.addressLine1 || a.addressLine2 || a.town || a.postcode);
export const composeAddress = (a: AddressParts) => [a.addressLine1, a.addressLine2, a.town, a.postcode].map((x) => (x ?? "").trim()).filter(Boolean).join("\n");

/** Best effort for companies saved before addresses had parts: first line, last line that looks like a postcode, town just before it. */
export function parseAddress(text: string | null | undefined, townHint?: string | null): AddressParts {
  const lines = (text ?? "").split(/\r?\n|,/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { town: townHint ?? "" };
  let postcode = "";
  const last = lines[lines.length - 1];
  if (isUkPostcode(last)) { postcode = normalisePostcode(last); lines.pop(); }
  const town = lines.length > 2 ? lines.pop()! : townHint ?? (lines.length > 1 ? lines.pop()! : "");
  return { addressLine1: lines[0] ?? "", addressLine2: lines.slice(1).join(", "), town, postcode };
}

/** Throws a plain sentence when part of an address is given but not enough to post a letter to. */
export function checkAddress(a: AddressParts): string | null {
  if (!hasAddress(a) || (a.town && !a.addressLine1 && !a.addressLine2 && !a.postcode)) return null; // a town on its own is fine for a new enquiry
  if (!a.addressLine1?.trim()) return "Add the first line of the address (house number and street).";
  if (!a.town?.trim()) return "Add the town or city.";
  if (!a.postcode?.trim()) return "Add the postcode.";
  if (!isUkPostcode(a.postcode)) return "That postcode doesn't look right. A UK postcode looks like BS1 4DJ.";
  return null;
}

/** The printed address only exists once there is a street line. A town alone is just where they are. */
export const printedAddress = (a: AddressParts) => (a.addressLine1?.trim() ? composeAddress(a) : "");
