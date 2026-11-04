import { ADDRESSES } from "@/lib/sender-identities";

/**
 * Values the legal documents quote. They live in Business settings, not in the wording, so changing a price,
 * a support hour or an email address never means republishing a legal document. Values are written into the
 * order when it is sent, so a signed order keeps the figures the customer agreed.
 */
export type VarDef = { key: string; label: string; hint?: string; group: "contact" | "service" | "commercial"; default?: string; multiline?: boolean };

export const VARIABLES: VarDef[] = [
  { key: "general_email", label: "General email", group: "contact", default: ADDRESSES.general },
  { key: "phone_number", label: "Phone number", group: "contact", default: "", hint: "Shown in the contact details of the Services Agreement." },
  { key: "legal_email", label: "Legal and formal notices email", group: "contact", default: ADDRESSES.legal, hint: "Used for formal notices such as cancellations." },
  { key: "support_email", label: "Support email", group: "contact", default: ADDRESSES.support, hint: "Where customers report issues." },
  { key: "complaints_email", label: "Complaints email", group: "contact", default: ADDRESSES.complaints },
  { key: "cancellations_email", label: "Cancellations email", group: "contact", default: ADDRESSES.legal, hint: "Where customers send written cancellation notice." },
  { key: "emergency_contact", label: "Emergency (P1) contact", group: "contact", default: ADDRESSES.urgent, hint: "An email, or a phone number as well, e.g. 'urgent@onesimplesite.co.uk or 07…'." },
  { key: "support_hours", label: "Support hours", group: "service", default: "Monday to Friday, 9:00 am to 5:00 pm UK time, excluding public holidays", multiline: true },
  { key: "availability_target", label: "Hosting availability target", group: "service", default: "99.9%" },
  { key: "cancellation_notice", label: "Cancellation notice", group: "service", default: "30 days" },
  { key: "care_revisions", label: "Care Plan revisions per month (in words)", group: "service", default: "three", hint: "Used inside the wording, e.g. 'up to three website revisions'. Each plan has its own number too." },
  { key: "backup_scope", label: "What backups cover", group: "service", default: "Website files and databases" },
  { key: "backup_restoration", label: "Backup restoration", group: "service", default: "Restoring the site from the latest backup is included. Larger rebuilds are quoted first", multiline: true },
  { key: "payment_methods", label: "Payment methods we accept", group: "commercial", hint: "Matches clause 4.3 of the Terms. The order or invoice can name the method for that customer.", default: "bank transfer or card payment (Direct Debit where agreed in the order)" },
  { key: "liability_cap", label: "Liability cap for business customers", group: "commercial", multiline: true, default: "For Business Customers only, our total liability for the Services a claim relates to is limited to the Fees paid or payable for those Services (for ongoing Services, in the 12 months before the event; for a website development project, the total development fees). Nothing limits liability for fraud, death or personal injury caused by negligence, or anything else the law does not allow to be limited.", hint: "Matches clause 16.3 of the Terms. Have your solicitor confirm it suits you before relying on it." },
  { key: "handover_service", label: "Standard handover when services end", group: "commercial", multiline: true, default: "An export of the website files and database in a standard format, a copy of the DNS records, the authorisation code (or steps) to transfer any domain registered in the customer's name, and written guidance on moving the website. Provided within 14 days of a written request made before the services end or within 14 days afterwards, once undisputed Fees are paid.", hint: "Matches clause 14.5 of the Terms." },
];
export const KNOWN_KEYS = new Set([...VARIABLES.map((v) => v.key), "legal_name", "registered_office", "care_standard", "care_ecommerce", "backup_frequency", "backup_retention", "privacy_email"]);

export const findVars = (text: string) => [...new Set([...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))];
export const unknownVars = (text: string) => findVars(text).filter((k) => !KNOWN_KEYS.has(k));
export const fillVars = (text: string, vars: Record<string, string>) => text.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k]?.trim() ? vars[k].trim() : `{{${k}}}`));
/** Variables still empty in a text once values are filled in: the order cannot be sent until these are decided. */
export const emptyVars = (text: string, vars: Record<string, string>) => findVars(text).filter((k) => !vars[k]?.trim());
export const labelFor = (key: string) => VARIABLES.find((v) => v.key === key)?.label ?? ({ legal_name: "legal company name", registered_office: "registered address", care_standard: "Standard Care Plan price", care_ecommerce: "E-commerce Care Plan price", backup_frequency: "plan backup frequency", backup_retention: "plan backup retention" } as Record<string, string>)[key] ?? key;
