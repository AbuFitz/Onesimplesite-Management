/** Only ever return to a page on this same site. Anything else (another site, a login page, odd characters) is ignored. */
export function safeNext(raw: unknown): string | null {
  const v = typeof raw === "string" ? raw : "";
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\") || /[\u0000-\u001f]/.test(v)) return null;
  if (/^\/(login|setup-security|forgot-password|reset-password|invite|api)(\/|\?|$)/.test(v)) return null;
  return v.length > 500 ? null : v;
}
