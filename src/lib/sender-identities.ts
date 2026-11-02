// Verified sender identities. Nobody types an arbitrary From address.
export const DOMAIN = "onesimplesite.co.uk";
const at = (local: string) => `${local}@${DOMAIN}`;

/** Addresses that exist as mailboxes or aliases. Documents and settings refer to these. */
export const ADDRESSES = {
  general: at("hello"), support: at("support"), legal: at("legal"), complaints: at("complaints"),
  privacy: at("privacy"), urgent: at("urgent"), noreply: at("noreply"),
} as const;

/** What the system sends as. Automated mail uses a function address; anything a person writes uses their own alias. */
export const SENDERS = {
  general: { name: "OneSimpleSite", address: ADDRESSES.general, replyTo: ADDRESSES.general },
  /** Automated: invitations, password emails, system notices. Replies go to support. */
  noreply: { name: "OneSimpleSite", address: ADDRESSES.noreply, replyTo: ADDRESSES.support },
  /** Orders to sign, signed copies, legal documents. */
  legal: { name: "OneSimpleSite Legal", address: ADDRESSES.legal, replyTo: ADDRESSES.legal },
  /** Ticket confirmations and updates not written by a named person. */
  support: { name: "OneSimpleSite Support", address: ADDRESSES.support, replyTo: ADDRESSES.support },
} as const;
export type SenderKey = keyof typeof SENDERS;
export const fmtFrom = (k: SenderKey) => `${SENDERS[k].name} <${SENDERS[k].address}>`;

const first = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** A named person writing to a customer: "Abukar at OneSimpleSite <abukar@...>". Falls back to the general address without an alias. */
export function personFrom(displayName: string, alias: string | null | undefined) {
  if (!alias) return fmtFrom("general");
  return `${first(displayName)} at OneSimpleSite <${alias}>`;
}

/** First-name alias, e.g. "Abukar Sharif" becomes abukar@onesimplesite.co.uk. Letters only. */
export const suggestAlias = (displayName: string) => {
  const local = first(displayName).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
  return local ? at(local) : null;
};

/** Only addresses on our own domain can be a team alias. */
export const isOurAddress = (a: string) => new RegExp(`^[a-z0-9._-]+@${DOMAIN.replace(/\./g, "\\.")}$`).test(a.trim().toLowerCase());
