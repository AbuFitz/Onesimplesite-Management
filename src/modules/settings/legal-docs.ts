/** The legal pages the business keeps. Pure data: safe to import in the browser. */
export const LEGAL_KINDS = ["terms", "privacy", "cookies", "website_terms", "dpa", "change_request"] as const;
export type LegalKind = (typeof LEGAL_KINDS)[number];

export type LegalGroup = "website" | "customers";
export type LegalMeta = {
  label: string; ref: string; group: LegalGroup;
  audience: "Customer-facing" | "Public document" | "Private & confidential";
  purpose: string;
  /** Public pages are served on the portal domain at /legal/<slug>. */
  slug?: string;
};

export const LEGAL: Record<LegalKind, LegalMeta> = {
  terms: { label: "Terms and Conditions", ref: "OSS-TC-001", group: "customers", audience: "Customer-facing", purpose: "Part of every agreement. Customers accept it when they sign." },
  privacy: { label: "Privacy Notice", ref: "OSS-PN-001", group: "website", audience: "Public document", slug: "privacy", purpose: "How onesimplesite.co.uk uses visitors' personal information." },
  cookies: { label: "Cookie Notice", ref: "OSS-CN-001", group: "website", audience: "Public document", slug: "cookies", purpose: "The cookies onesimplesite.co.uk sets and the choices visitors have." },
  website_terms: { label: "Website Terms", ref: "OSS-WT-001", group: "website", audience: "Public document", slug: "website-terms", purpose: "Rules for using onesimplesite.co.uk, with our company information." },
  dpa: { label: "Data Processing Agreement", ref: "OSS-DP-001", group: "customers", audience: "Private & confidential", purpose: "Per customer: used when we handle their visitors' data, such as form submissions." },
  change_request: { label: "Change Request", ref: "OSS-CR-001", group: "customers", audience: "Private & confidential", purpose: "Per customer: agrees a change to scope, price or timetable before the work starts." },
};

export const isLegalKind = (v: unknown): v is LegalKind => (LEGAL_KINDS as readonly string[]).includes(String(v));
export const kindFromSlug = (slug: string): LegalKind | undefined => LEGAL_KINDS.find((k) => LEGAL[k].slug === slug);
