/** The legal documents we send to customers during onboarding. Pure data: safe to import in the browser. */
export const LEGAL_KINDS = ["terms", "dpa", "change_request"] as const;
export type LegalKind = (typeof LEGAL_KINDS)[number];

export type LegalMeta = {
  label: string; ref: string;
  audience: "Customer-facing" | "Private & confidential";
  purpose: string;
};

export const LEGAL: Record<LegalKind, LegalMeta> = {
  terms: { label: "Services Agreement", ref: "OSS-SA-001", audience: "Customer-facing", purpose: "Our master terms. Part of every order and accepted when the customer signs." },
  dpa: { label: "Data Processing Agreement", ref: "OSS-DP-001", audience: "Private & confidential", purpose: "Per customer: used when we handle their visitors' data, such as form submissions." },
  change_request: { label: "Change Request", ref: "OSS-CR-001", audience: "Private & confidential", purpose: "Per customer: agrees a change to scope, price or timetable before the work starts." },
};

export const isLegalKind = (v: unknown): v is LegalKind => (LEGAL_KINDS as readonly string[]).includes(String(v));
