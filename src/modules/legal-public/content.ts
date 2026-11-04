/**
 * The legal pages shown on both portals (/legal/terms, /legal/privacy, /legal/cookies).
 * These live in code on purpose: they describe how the software itself works, so a change goes through review and a release,
 * not a settings screen. Company details and contact emails are filled from Settings.
 * Update `LEGAL_PAGES_UPDATED` and `version` whenever the wording changes.
 */
export const LEGAL_PAGES_UPDATED = "3 November 2026";
export type PublicLegal = { slug: string; title: string; ref: string; version: string; intro: string; body: string };

const PRIVACY = `## Who we are
1.1 {{legal_name}}, trading as OneSimpleSite ("we", "us"), is the controller of the personal information described here.
1.1 Registered office: {{registered_office}}. Contact for anything in this notice: {{general_email}}.

## What we collect
1.1 About you: your name, email address, phone number and job title.
1.1 About your business: its name, address, company number and what it does.
1.1 Your account: your sign-in email, a hashed (unreadable) password, and technical details of each sign-in, such as the time, device and network address.
1.1 Your work with us: your projects, the files and messages you send us, support tickets, and the agreements you sign, including your signature and the time and technical details recorded when you sign.
1.1 Payments: amounts due and paid and their dates. Card details are entered on our payment provider's secure page and are never seen or stored by us.
1.1 Emails: a record of the emails we send you.

## Why we use it, and our lawful reasons
kv: To provide your website, support and portal | Contract
kv: To take payment and keep accounts | Contract and legal obligation
kv: To keep the portals secure and fix problems | Legitimate interests
kv: To tell you about your project, documents and payments | Contract
1.1 We do not use the portals for marketing and we do not make decisions about you by automated means.
1.1 You need to give us the details above to use our services. Without them we cannot set up or run your account.

## Who we share it with
1.1 We do not sell personal information. We share it only with:
- Companies that provide services to us, such as secure hosting and storage, email delivery and card payments. They may only use it to provide that service to us, and are bound to keep it safe.
- Our card payment provider, which handles your card details itself. We never see or store your full card number.
- Professional advisers and accountants, who are bound by confidentiality, and anyone the law requires us to tell.
1.1 Some of these providers may process information outside the UK. When they do, it is protected by an adequacy decision or by standard contractual safeguards approved under UK data protection law.

## How long we keep it
kv: Account and business details | While you are a customer and for 6 years afterwards
kv: Signed agreements and payment records | 6 years from the end of the financial year they relate to
kv: Support tickets and their files | 3 years after the ticket is closed
kv: Sign-in and security records | 12 months
1.1 When a period ends we delete the information or make it anonymous. If you ask us to delete something earlier, we will unless the law requires us to keep it.

## Your rights
1.1 You can ask for a copy of your information, ask us to correct or delete it, ask us to restrict or stop using it, ask us to move it to another provider, and object to our use of it based on legitimate interests.
1.1 Email {{general_email}} and we will reply within one month. We may need to confirm who you are first.
1.1 If you are unhappy with how we have handled your information, please tell us so we can put it right. You can also complain to the Information Commissioner's Office at ico.org.uk or on 0303 123 1113.

## Security
1.1 Access is protected by sign-in, files are only visible to you and our team, and our team's access is limited by role. Please use a strong, unique password and tell us straight away if you think your account has been used by someone else.

## Changes
1.1 We will update this notice if how we use your information changes. The version and date are shown at the top.`;

const COOKIES = `## What we use
1.1 The portals only use cookies that are strictly necessary. They cannot work without them, so the law does not require us to ask for your consent.
kv: Sign-in cookie | Keeps you signed in as you move between pages. With "Keep me signed in" it lasts up to 30 days on the client portal and 14 days on the team app. Without it, it ends when you close your browser.
kv: Security cookies | Protect sign-in and forms from misuse. They are removed when no longer needed.

## What we do not use
1.1 No advertising, tracking or analytics cookies, and we share no cookie data with advertisers.

## Cookies from other companies
1.1 When you pay, you go to a secure page run by our card payment provider, which sets its own cookies to take payment safely and prevent fraud. Its own cookie policy explains them.

## Your choices
1.1 You can delete or block cookies in your browser settings. If you block the sign-in cookie you will not be able to sign in.
1.1 Questions: {{general_email}}.`;

const TERMS = `## Your account
1.1 Your account is personal to you. Keep your password private and do not share it. Ask us if you want a colleague to have access.
1.1 Tell us straight away at {{support_email}} if you think someone else has used your account.

## Using the portal
1.1 Use the portal only for your own business and your work with us.
1.1 Do not try to access other people's accounts or information, interfere with the portal, or upload anything harmful, unlawful or that you have no right to share.
1.1 We may suspend an account that is being misused. We will tell you why and help put it right where we can.

## Your files and messages
1.1 You keep ownership of what you send us and allow us to use it to provide your services.
1.1 Please do not send passwords or card numbers in tickets. If we need access to something, we will tell you a safe way to share it.

## Payments
1.1 The portal shows what you owe and lets you pay by card on a secure payment page. What you owe, and when, is set out in your signed order.

## Availability
1.1 We aim to keep the portal available but cannot promise it will always be uninterrupted or error free. We may pause it for maintenance. Support times are in your Service Level Agreement.

## Our responsibility
1.1 Nothing here limits any right you have by law. Otherwise, our responsibility for the portal is subject to the limits in your Services Agreement.

## Changes and law
1.1 We may update these terms and will tell you before a change that matters applies. They are governed by the laws of England and Wales.
kv: Company | {{legal_name}}, trading as OneSimpleSite
kv: Address | {{registered_office}}
kv: Email | {{general_email}}`;

export const LEGAL_PAGES: Record<string, PublicLegal> = {
  privacy: { slug: "privacy", title: "Privacy Notice", ref: "OSS-PN-001", version: "1.0", intro: "How we use your personal information when you use the OneSimpleSite client portal and team app.", body: PRIVACY },
  cookies: { slug: "cookies", title: "Cookie Notice", ref: "OSS-CK-001", version: "1.0", intro: "The portals use only the cookies they need to work.", body: COOKIES },
  terms: { slug: "terms", title: "Portal Terms of Use", ref: "OSS-PT-001", version: "1.0", intro: "The rules for using the client portal and the team app. They sit alongside the agreement you signed for your website.", body: TERMS },
};
