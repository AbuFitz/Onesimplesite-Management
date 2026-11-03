import type { LegalKind } from "./legal-docs";
import { SERVICES_AGREEMENT, SERVICE_LEVEL_AGREEMENT, HOSTING_CARE_TERMS } from "./legal-text";

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
  switch (kind) {
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

    case "privacy": return `This notice explains what personal information we collect when you use the OneSimpleSite client portal and our Manage app, why we need it, who we share it with, and the choices you have. We have tried to keep it plain.

## Who we are
1.1 {{legal_name}}, trading as OneSimpleSite, is responsible for your personal information (the "controller").
1.1 Registered office: {{registered_office}}.
1.1 Questions about your information: {{general_email}}.
1.1 ICO registration number: [TBC: ICO registration number].

## What we collect
1.1 Your details: your name, email address, phone number and job title, as given to us by you or by your business.
1.1 Your business details: the business name, address, company number and what kind of business it is.
1.1 Your account: your sign-in email and a protected (hashed) version of your password. We never see or store your password in readable form. We also keep a record of when you sign in and the device and approximate network address used, to keep the portal secure.
1.1 Your work with us: your projects, the files and pictures you send us, your support tickets and messages, and the documents you sign, including your signature, the time, and the technical details recorded when you sign.
1.1 Payments: what you owe us, what has been paid and when. Card details are entered on Stripe's secure payment page and are never held by us.
1.1 Emails: we keep a record that we sent you an email, and its contents, so we can show what we sent.

## Why we use it, and our lawful reason
1.1 To provide your website and support, and to run your account. Reason: it is needed to carry out our contract with you or your business.
1.1 To take payment and keep accounting records. Reason: contract, and our legal obligations to keep financial records.
1.1 To keep the portals secure, prevent misuse and fix problems. Reason: our legitimate interest in running a safe service.
1.1 To tell you about your project, documents and payments. Reason: contract. We do not use the portals to send you marketing.

## Who we share it with
1.1 We do not sell your information. We use a small number of trusted companies to run the service. They may only use your information on our instructions:
- Supabase: our database, where your account and records are stored.
- Vercel: hosting for the portals.
- Resend: delivering our emails.
- Stripe: taking card payments and managing monthly plans.
1.1 We may share information where the law requires it, or to protect our rights, or with advisers (such as accountants) who are bound by confidentiality.
1.1 Some of these companies may process information outside the UK. Where they do, we rely on the safeguards required by UK data protection law. [TBC: confirm where each provider processes data and the transfer safeguards in use]

## How long we keep it
1.1 We keep information only as long as we need it for the reasons above. [TBC: retention periods, for example accounts and contracts, support tickets, sign-in records and files]
1.1 Financial records are kept for the period the law requires.

## Your rights
1.1 You can ask us for a copy of your information, ask us to correct it, ask us to delete it, ask us to restrict how we use it, ask us to move it to another provider, and object to us using it for our own legitimate interests.
1.1 To use any of these rights, email {{general_email}}. We will reply within one month.
1.1 If you are unhappy with how we have handled your information, please tell us first so we can put it right. You can also complain to the Information Commissioner's Office (ico.org.uk, 0303 123 1113).

## Security
1.1 Sign-in sessions are protected, files you send are only visible to you and our team, and our team's access is limited by role. No online service can promise perfect security, so please use a strong password you do not use anywhere else and tell us straight away if you think your account has been used by someone else.

## Changes to this notice
1.1 We will update this notice if we change how we use your information. The date and version are shown on the page.
`;
    case "cookies": return `This notice explains the cookies used by the OneSimpleSite client portal and our Manage app. Short version: we only use the cookies needed to keep you signed in and keep your account safe.

## What cookies are
1.1 Cookies are small files a website saves on your device so it can remember you between pages.

## The cookies we use
1.1 These are all strictly necessary. The portals cannot work without them, so we do not ask for your consent to set them.
kv: Sign-in cookie | Keeps you signed in as you move between pages. If you tick "Remember me" it lasts up to 30 days on the client portal (14 days on Manage). If you do not, it ends when you close your browser.
kv: Security cookies | Protect your sign-in and forms from misuse, and are removed when no longer needed.

## What we do not use
1.1 We do not use advertising cookies, tracking cookies or analytics cookies on the portals, and we do not share cookie data with advertisers.

## Cookies from other companies
1.1 When you pay, you are taken to a secure page run by Stripe. Stripe sets its own cookies there to take payment safely and prevent fraud. They are described in Stripe's cookie policy.

## Your choices
1.1 You can delete or block cookies in your browser settings. If you block the sign-in cookie you will not be able to sign in.

## Contact
1.1 Questions about cookies: {{general_email}}.
`;
    case "portal_terms": return `These terms explain how to use the OneSimpleSite client portal and our Manage app. They sit alongside the agreement you signed for your website, which stays in charge of the services we provide and what you pay.

## Your account
1.1 Your portal account is personal to you. Keep your password private and do not share it. If you want a colleague to have access, ask us to invite them.
1.1 Tell us straight away at {{support_email}} if you think someone else has used your account or you have lost access.
1.1 You are responsible for what is done through your account, unless someone else got in because we failed to protect it.

## Using the portal
1.1 Use the portal only for your own business and your work with us.
1.1 Do not try to get into other people's accounts or information, interfere with the portal, or upload anything harmful, illegal or that you do not have the right to share.
1.1 We may suspend an account that is being misused. We will tell you why and help put it right where we can.

## Your files and messages
1.1 You keep ownership of what you send us. You give us permission to use it to provide your services, as set out in your agreement.
1.1 Please only upload pictures and PDFs up to the size shown, and do not send passwords, card numbers or other sensitive details in tickets. If we need access to something, we will tell you a safe way to share it.

## Payments
1.1 The portal shows what you owe and lets you pay by card through Stripe. What you owe and when is set out in your signed order.
1.1 If you cancel a monthly plan, the notice period in your agreement applies.

## Availability
1.1 We aim to keep the portal available but cannot promise it will always be uninterrupted or error free. We may update or pause it for maintenance. Our response times for support are in your Service Level Agreement.

## Our responsibility
1.1 Nothing in these terms limits any right you have by law, or our responsibility for anything the law does not allow us to limit.
1.1 Otherwise, our responsibility for the portal is subject to the limits in your Services Agreement.

## Changes
1.1 We may update these terms. If a change matters, we will tell you before it applies. The date and version are shown on the page.

## Governing law and contact
1.1 These terms are governed by the laws of England and Wales.
kv: Company | {{legal_name}}, trading as OneSimpleSite
kv: Address | {{registered_office}}
kv: Email | {{general_email}}
kv: Support | {{support_email}}
`;
    case "terms": return SERVICES_AGREEMENT;
    case "sla": return SERVICE_LEVEL_AGREEMENT;
    case "hosting": return HOSTING_CARE_TERMS;
    default: return "";
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
