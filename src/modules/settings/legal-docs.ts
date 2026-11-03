/** The legal documents we send to customers during onboarding. Pure data: safe to import in the browser. */
export const LEGAL_KINDS = ["terms", "sla", "hosting", "dpa", "change_request", "privacy", "cookies", "portal_terms"] as const;
export type LegalKind = (typeof LEGAL_KINDS)[number];

export type LegalMeta = {
  label: string; ref: string;
  audience: "Customer-facing" | "Private & confidential" | "Shown on the portals";
  purpose: string;
};

export const LEGAL: Record<LegalKind, LegalMeta> = {
  terms: { label: "Services Agreement", ref: "OSS-SA-001", audience: "Customer-facing", purpose: "Our master terms. Part of every order and accepted when the customer signs." },
  sla: { label: "Service Level Agreement", ref: "OSS-SL-001", audience: "Customer-facing", purpose: "Hosting availability, support hours and response targets. Signed with every order that has a care plan." },
  hosting: { label: "Hosting and Care Plan Terms", ref: "OSS-HC-001", audience: "Customer-facing", purpose: "Hosting, Care Plan, backups and security. Signed with every order that has a care plan." },
  dpa: { label: "Data Processing Agreement", ref: "OSS-DP-001", audience: "Private & confidential", purpose: "Per customer: used when we handle their visitors' data, such as form submissions." },
  change_request: { label: "Change Request", ref: "OSS-CR-001", audience: "Private & confidential", purpose: "Per customer: agrees a change to scope, price or timetable before the work starts." },
  privacy: { label: "Privacy Notice", ref: "OSS-PN-001", audience: "Shown on the portals", purpose: "What personal information the portals hold, why, who sees it and people's rights. Linked from every sign-in page and the portal footer." },
  cookies: { label: "Cookie Notice", ref: "OSS-CK-001", audience: "Shown on the portals", purpose: "The cookies the portals use. Linked from every sign-in page and the portal footer." },
  portal_terms: { label: "Portal Terms of Use", ref: "OSS-PT-001", audience: "Shown on the portals", purpose: "The rules for using the client portal and the team's Manage app." },
};

/** Public address of each portal page, under /legal. */
export const PUBLIC_LEGAL: Record<string, LegalKind> = { privacy: "privacy", cookies: "cookies", terms: "portal_terms" };

export const isLegalKind = (v: unknown): v is LegalKind => (LEGAL_KINDS as readonly string[]).includes(String(v));
