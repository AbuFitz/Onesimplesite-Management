// Verified sender identities. Users never type an arbitrary From address.
export const SENDERS = {
  general: { name: "OneSimpleSite", address: "hello@onesimplesite.co.uk" },
  contracts: { name: "OneSimpleSite Contracts", address: "contracts@onesimplesite.co.uk" },
  accounts: { name: "OneSimpleSite Accounts", address: "accounts@onesimplesite.co.uk" },
  support: { name: "OneSimpleSite Support", address: "support@onesimplesite.co.uk" },
  renewals: { name: "OneSimpleSite Renewals", address: "renewals@onesimplesite.co.uk" },
  farhan: { name: "Farhan Mahmood · OneSimpleSite", address: "farhan.mahmood@onesimplesite.co.uk" },
  matthew: { name: "Matthew Redican · OneSimpleSite", address: "matthew.redican@onesimplesite.co.uk" },
  abukar: { name: "Abukar Sharif · OneSimpleSite", address: "abukar.sharif@onesimplesite.co.uk" },
} as const;
export type SenderKey = keyof typeof SENDERS;
export const fmtFrom = (k: SenderKey) => `${SENDERS[k].name} <${SENDERS[k].address}>`;

// Grants: which staff e-mail may send as which personal identity. Departments are capability-gated.
export const PERSONAL_GRANTS: Record<string, SenderKey> = {
  "abukar.sharif@onesimplesite.co.uk": "abukar",
  "farhan.mahmood@onesimplesite.co.uk": "farhan",
  "matthew.redican@onesimplesite.co.uk": "matthew",
};
