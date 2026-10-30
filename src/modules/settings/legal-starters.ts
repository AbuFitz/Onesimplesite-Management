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
