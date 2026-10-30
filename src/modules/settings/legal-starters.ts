import type { LegalKind } from "./legal-docs";

export type CompanyFacts = { legalName: string | null; companyNumber: string | null; registeredAddress: string | null };

/**
 * First drafts, written in the same plain structure as the OneSimpleSite document templates.
 * What we know (company details, our real suppliers) is filled in. Every decision still open is a
 * [TBC: ...] marker, and a document cannot be published while one remains. [Square brackets without TBC]
 * are details filled in each time the document is used for a client.
 */
export function starterBody(kind: LegalKind, c: CompanyFacts): string {
  const name = c.legalName?.trim() || "[TBC: legal company name]";
  const number = c.companyNumber?.trim() || "[TBC: company number]";
  const address = c.registeredAddress?.trim().replace(/\s*\n\s*/g, ", ") || "[TBC: registered address]";
  const email = "hello@onesimplesite.co.uk";
  switch (kind) {
    case "privacy": return `This notice explains how ${name}, trading as OneSimpleSite, uses personal information.

## Who we are
1.1 ${name}, trading as OneSimpleSite, is registered in England and Wales under number ${number}, with its registered office at ${address}. We are the controller of the personal information described in this notice.
1.2 You can contact us at ${email}. [TBC: name of our data protection lead, or delete this sentence]

## What we collect and why
| Purpose | Information | Lawful basis | Kept for |
| Replying to enquiries | Name, email, phone, your message | Legitimate interests; steps before a contract | [TBC: 12 months?] |
| Providing our services | Contact and billing details, project content | Contract | [TBC: 6 years after the project ends?] |
| Invoices and accounts | Billing details, payment records | Legal obligation | [TBC: 6 years?] |
| Website analytics | Pages visited, device and browser data | [TBC: consent or legitimate interests] | As in the Cookie Notice |
| Chat assistant | Messages you type, technical data | Legitimate interests | [TBC: period] |
| Marketing emails | Name, email address | [TBC: consent or existing customer] | Until you unsubscribe |

## Our chat assistant
3.1 Our website has an AI chat assistant. Messages you send to it may be processed by [TBC: AI provider]. Please do not include sensitive personal information in a chat.
3.2 [TBC: say whether chats are stored, for how long, and who can read them]

## Who we share it with
4.1 We share information only with organisations that help us run our business and are bound to protect it, such as Vercel (hosting), Supabase (database), Resend (email), [TBC: analytics provider], [TBC: payment provider], [TBC: accountant] and [TBC: AI provider].
4.2 We do not sell personal information. We may disclose information where the law requires it.

## Transfers outside the UK
5.1 Some of our providers are outside the UK. When that happens, we protect your information using [TBC: UK adequacy regulations, or the UK International Data Transfer Agreement or Addendum].

## Your rights
6.1 You have the right to be told what we hold and to get a copy; to have inaccurate information corrected or deleted; to restrict or object to how we use it; to receive it in a portable format; and to withdraw consent at any time where we rely on it.
6.2 To use these rights, contact us at ${email}. We aim to reply within one month.
6.3 If you are unhappy with how we handle your information, you can complain to the Information Commissioner's Office at ico.org.uk or on 0303 123 1113. We would appreciate the chance to put things right first.

## Security and retention
7.1 We use [TBC: describe measures, for example access controls, encryption and backups] to protect personal information, and keep it only for as long as the table above shows.

## Cookies and changes
8.1 Our Cookie Notice explains the cookies we use.
8.2 We may update this notice. The date at the top shows the latest version.`;

    case "cookies": return `This notice explains what cookies and similar technologies ${name} uses on onesimplesite.co.uk.

## What cookies are
1.1 Cookies are small files stored on your device when you visit a website. Similar technologies include local storage and tracking pixels. We call all of them cookies here.

## How we use them
| Category | What it does | Consent needed? |
| Strictly necessary | Keeps the site secure and working, and remembers your cookie choices | No |
| Functional | [TBC: remembers preferences; supports forms and chat] | [TBC: check] |
| Analytics | [TBC: helps us understand how the site is used] | [TBC: check] |
| Marketing | [TBC: advertising or social media features, or none] | Yes |

## Cookies we use
| Name | Provider | Purpose | Duration |
| [TBC: cookie name] | [TBC: provider] | [TBC: purpose] | [TBC: duration] |

## Your choices
4.1 When you first visit, our banner lets you accept or reject non-essential cookies. Rejecting is as easy as accepting. You can change your choice at any time using [TBC: link or button].
4.2 You can also block or delete cookies in your browser settings. Blocking some cookies may affect how the site works.

## Third parties
5.1 Some cookies are set by third parties we use, such as [TBC: analytics provider]. We do not control them. See their own notices: [TBC: links].

## Updates and contact
6.1 We may update this notice. The date at the top shows the latest version. Questions: ${email}.`;

    case "website_terms": return `These terms govern your use of onesimplesite.co.uk, operated by ${name}, trading as OneSimpleSite.

## Company information
kv: Company name | ${name}
kv: Trading name | OneSimpleSite
kv: Registered in | England and Wales
kv: Company number | ${number}
kv: Registered office | ${address}
kv: Email | ${email}
kv: Telephone | [TBC: telephone number]
kv: VAT number | [TBC: VAT number, or "Not VAT registered"]

## Using this website
2.1 You may use this website for lawful purposes only. You must not misuse it, for example by trying to gain unauthorised access, introducing malware, or scraping it in a way that harms it.
2.2 We may change or withdraw any part of the website at any time.

## Content and intellectual property
3.1 The website, its design, text and logos are owned by us or our licensors. You may view and print pages for your own use, but you may not copy or reuse them commercially without our written permission.
3.2 Information on this website is general information, not advice. Prices and package details may change. A price binds us only when confirmed in a signed order form.

## Links to other websites
4.1 We are not responsible for other websites we link to or for their content.

## Our liability
5.1 Nothing excludes liability for death or personal injury caused by negligence, for fraud, or for anything else the law does not allow us to exclude.
5.2 Otherwise, to the extent the law allows, we provide the website as it is and are not liable for losses arising from your use of it or reliance on its content.

## Privacy, cookies and law
6.1 Our Privacy Notice and Cookie Notice explain how we use personal information and cookies.
6.2 These terms are governed by the law of England and Wales. Contact: ${email}.`;

    case "dpa": return `This agreement sets out how the Supplier processes personal data on the Client's behalf. It supplements the Services Agreement.

party: Controller (the Client) | [Client name] | Address: [address] ; Company no.: [number, if applicable] ; Contact: [name and email]
party: Processor (the Supplier) | ${name} | Trading as OneSimpleSite ; Registered office: ${address} ; Company no.: ${number}

## Details of the processing
kv: Subject matter | Hosting and operating the Client's website and forms
kv: Duration | The term of the Services Agreement and any retention period
kv: Nature and purpose | Storing and transmitting form data, hosting, backups and support
kv: Types of personal data | [Names, email addresses, phone numbers, messages, other]
kv: People concerned | Website visitors, customers and enquirers of the Client

## The Processor's obligations
2.1 The Supplier shall process the personal data only on the Client's documented instructions, including those in this agreement, unless the law requires otherwise. If it does, the Supplier shall tell the Client first, unless the law prohibits that.
2.2 The Supplier shall make sure everyone authorised to process the data is bound by a duty of confidentiality.
2.3 The Supplier shall apply appropriate technical and organisational security measures, including those in Annex A.
2.4 The Supplier shall tell the Client without undue delay, and within [TBC: 48] hours, after becoming aware of a personal data breach affecting the data, and give the information the Client reasonably needs to meet its own obligations.
2.5 The Supplier shall give reasonable help with requests from individuals exercising their rights, with data protection impact assessments, and with consultations with the regulator.
2.6 At the end of the Services the Supplier shall, as the Client chooses, delete or return the personal data within [TBC: 30] days, unless the law requires it to be kept.
2.7 The Supplier shall provide the information needed to show compliance and allow reasonable audits on [TBC: 14] days' notice, no more than once a year unless there has been a breach.

## Sub-processors
3.1 The Client gives general authorisation for the Supplier to use the sub-processors listed in Annex B.
3.2 The Supplier shall give the Client at least [TBC: 14] days' notice of any change, and the Client may object on reasonable grounds.
3.3 The Supplier shall impose obligations on each sub-processor equivalent to this agreement and remains responsible for them.

## Transfers outside the UK
4.1 The Supplier shall not transfer the personal data outside the UK unless a lawful transfer mechanism applies, such as UK adequacy regulations or the UK International Data Transfer Agreement or Addendum.

## General
5.1 Liability under this agreement is subject to the liability terms of the Services Agreement. This agreement is governed by the law of England and Wales.

sign: For the Controller (Client)
sign: For the Processor (Supplier)

## Annex A: Security measures
- [TBC: access limited to named people, with unique accounts and two-factor authentication]
- [TBC: data encrypted in transit and, where supported, at rest]
- [TBC: regular backups with tested restores]
- [TBC: software and dependencies kept up to date]
- [TBC: credentials kept in a password manager or secrets store, never in code]
- [TBC: incident response procedure in place]
- [TBC: staff and contractors briefed on data protection]

## Annex B: Sub-processors
| Sub-processor | Service | Location |
| Vercel | Hosting | [TBC: location] |
| Supabase | Database | [TBC: location] |
| Resend | Email delivery | [TBC: location] |
| [TBC: analytics provider] | Analytics | [TBC: location] |`;

    case "change_request": return `Use this form to agree any change to the scope, price or timetable of a project before work on it begins.

## Request details
kv: Project | [project name]
kv: Client | [Client name]
kv: Order form reference | [reference]
kv: Change request number | [CR-001]
kv: Date | [date]
kv: Requested by | [name]

## The change
kv: Description of the change | [describe what is being added, removed or altered]
kv: Reason | [why the change is needed]

## Effect of the change
| Area | Effect |
| Scope | [what is added or removed] |
| Price (ex VAT) | [£ or "no change"] |
| Timetable | [new dates or "no change"] |
| Dependencies | [what we need from the Client] |
3.1 Work on this change starts only when the Client approves it below. Unless stated here, all other terms of the Order Form and Services Agreement remain unchanged.

## Approval
sign: For the Supplier
sign: For the Client`;

    case "terms": default: return "";
  }
}

/** Intro sentence shown under the masthead, taken from the first plain paragraph of the document. */
export function splitIntro(body: string): { intro?: string; rest: string } {
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  const first = lines.findIndex((l) => l.trim());
  if (first === -1) return { rest: body };
  const l = lines[first].trim();
  if (/^(##|###|\d|-|\||kv:|sign:|party:|note:)/i.test(l)) return { rest: body };
  return { intro: l, rest: lines.slice(first + 1).join("\n") };
}
