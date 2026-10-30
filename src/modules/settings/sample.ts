import { composeAgreement, CONSENT_TEXT, CONSENT_VERSION } from "@/modules/signing/service";
import { REQUIREMENT_FIELDS } from "@/modules/sales/service";

/** A made-up order wrapped around the real company details and the terms being edited, so the team sees the exact document a customer would. */
export function sampleAgreement(company: { legalName: string | null; companyNumber: string | null; registeredAddress: string | null; vatNumber: string | null }, terms: { number: number; body: string }) {
  void REQUIREMENT_FIELDS;
  const day = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Europe/London" }).format(new Date());
  return composeAgreement({
    reference: "K-0000", title: "Website for Sample Customer", dateLabel: day, currency: "GBP", oneOffMinor: 150000, recurringMinor: 2500, recurringPeriod: "month",
    lines: [{ description: "Website design and build", quantity: 1, unitMinor: 150000, recurring: false }, { description: "Hosting and upkeep", quantity: 1, unitMinor: 2500, recurring: true }],
    scope: "Design and build of a mobile-friendly website with a contact form and an online booking page.",
    requirements: { pages: "Home\nServices\nAbout\nContact", features: "Contact form\nOnline booking", domainHosting: "We register the web address", contentBy: "A mix of both", timeline: "Within a month", payment: "50% on signing\n50% on launch" },
    provider: { legalName: company.legalName || "[Your company name]", companyNumber: company.companyNumber, registeredAddress: company.registeredAddress || "[Your registered address]", vatNumber: company.vatNumber },
    client: { legalName: "Sample Customer Ltd", kind: "company", companyNumber: "01234567", billingAddress: "1 Example Street, Bristol, BS1 1AA", vatNumber: null },
    terms,
  });
}
export { CONSENT_TEXT, CONSENT_VERSION };
