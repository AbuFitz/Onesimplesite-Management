# OneSimpleSite platform: what it does and how it works

Written from the code as it stands on branch `claude/bold-thompson-p6yykh` (November 2026). Section 15 lists what is deliberately not built or only partly built, so you can tell "absent" from "forgotten".

---

## 1. What this is

One web application that serves **two different sites** from one codebase and one database:

| Site | Address | Who | Purpose |
|---|---|---|---|
| **Team app** ("Manage") | `manage.onesimplesite.co.uk` | OneSimpleSite staff | Run the business: companies, quotes and agreements, signing, orders and payments, projects, tickets, calendar, notes, vault, settings |
| **Customer portal** | `portal.onesimplesite.co.uk` | Customers' people | See their project, documents and payments, pay, raise tickets, manage who at their company has access |
| **Public pages** (no sign-in) | same two hosts | Anyone with a link | Agreement viewing and signing (`/s/<token>`), proposal viewing (`/p/<token>`), invitations (`/invite/<token>`), legal pages (`/legal/*`) |

The business it supports: OneSimpleSite builds and looks after small-business websites for a **one-off website fee plus an optional monthly care plan**. The platform covers the whole lifecycle: enquiry, quote, signed agreement, deposit, build, final payment, launch, care plan, support tickets, changes.

Not live-site internals: the public marketing website is a separate thing; its legal pages are managed in code here (see 9).

---

## 2. Technology and hosting

| Layer | Choice |
|---|---|
| Framework | **Next.js 16** (App Router, React server components, **server actions** for every write), TypeScript, Tailwind |
| Database | **Postgres on Supabase** (live: project `mxjgysmphfsofqiucxxz`, eu-west-1) accessed with **Prisma 7** and the `pg` driver adapter |
| Auth | **Better Auth** (two instances, see 4), email and password, optional passkey and authenticator app |
| Email | **Resend** (production), a file/DB "sink" in development and on the dev site |
| Payments | **Stripe** via a small hand-written REST client (no SDK): Checkout and subscriptions; webhook-driven |
| PDF | Server-rendered agreement and receipt PDFs |
| Hosting | **Vercel** (Hobby plan), one project, two domains; one **daily cron** |
| Tests | Vitest unit tests (about 180), Playwright end-to-end suites (14), health and smoke scripts, GitHub Actions checks |

Environment variables (validated at start-up by `src/lib/env.ts`): `DATABASE_URL`, `MANAGE_ORIGIN`, `PORTAL_ORIGIN`, `APP_ENV` (`production` / `development` / `staging` / `test`), `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, `MAIL_ALLOWLIST`, `VAULT_KEY`, plus Stripe keys (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`), `CRON_SECRET`, `INTERNAL_NOTICE_TO`, `TRUST_PROXY`, and for the dev site `MIGRATE_DATABASE_URL`, `DEMO_PASSWORD`, `DEV_AUTO_MIGRATE`.

---

## 3. Code map

```
src/
  proxy.ts              host routing: which site a request belongs to
  app/
    (staff)/            every team page (nav, modals, settings tree)
    portal/             every customer page (served at the portal host root via a rewrite)
    s/ p/ invite/ legal/ login/ forgot-password/ reset-password/ setup-security/ denied/   public or shared pages
    actions/            server actions, one file per area (writes only)
    api/                health, cron, stripe webhook, auth (staff + portal), files, logos, avatars, receipts, search, suggestions, dev hooks (dev only)
  modules/              ALL business logic, one folder per area (see 5); pages and actions stay thin
  lib/                  db, env, auth, mail, stripe, audit and references, tokens, vault crypto, errors, sender identities, problems log
  components/           shared UI (forms, nav, panels, charts, lightbox, signing UI...)
  emails/               one file of 27 email templates and the shared email layout
prisma/                 schema, 40 migrations, seed
docs/                   DEPLOYING, DEV-ENVIRONMENT, db role scripts, this file
scripts/                smoke, verify, vercel-build, dev-prepare, dev-accounts, showcase data
tests/                  unit tests and tests/e2e Playwright suites
```

**Request flow.** `proxy.ts` looks at the Host header. Portal host: only a short allow-list of paths is served and everything else is rewritten into `/portal/*`. Manage host: the staff app; `/portal*` is a 404. Pages call `requireStaff(cap?)` or `requireClient()` which redirect to sign-in or `/denied`. Pages read; **all writes are server actions** in `src/app/actions/*` which call functions in `src/modules/*`.

---

## 4. Identity, sign-in and security

- **Two Better Auth instances** (`staff`, `portal`) share one `User` table but have separate cookie names and base paths (`/api/auth/staff`, `/api/auth/portal`). A person is staff only if they have an **active `StaffMembership`**; a customer only if they have a **`ClientMembership`**. Checked server-side on every request (`requireStaff`, `requireClient`).
- **No public sign-up.** Accounts are made by **invitation** (single-use token, only its SHA-256 stored, expires), by the staff "register a company" flow, or by seed in dev.
- Passwords: minimum 12 characters; reset by emailed link (1 hour); all sessions revoked on reset; a "password changed" email is sent.
- Sessions: staff 14 days, portal 30 days with "keep me signed in", otherwise a one-day session that ends with the browser.
- **Staff can sign in with a username** (`first.surname`) or email; customers use email.
- **Extra security, staged rollout (off by default):** passkeys (one passkey works on both sites because the relying-party id is the shared parent domain), authenticator app (TOTP) with backup codes, and a **new-device email code**. A workspace setting chooses off / testers only / everyone. `KnownDevice` records devices; a "security notice" email goes out for an unrecognised sign-in.
- Sign-in activity (last active, devices) is visible to the team, and the privacy notice says so.
- **Rate limiting** on sign-in (the dev incident showed it surfaces as a generic error).
- **Roles for staff** (`StaffRole`): owner, member, client_director, delivery, sales, support, finance. Each maps to **capabilities** (`src/modules/identity/permissions.ts`, 24 of them, e.g. `customer.write`, `proposal.send`, `contract.record_completion`, `billing.write`, `staff.manage`, `settings.write`, `vault.use`, `data.export`). The capability table is the single source of truth; the Team page shows plain-language summaries.
- **Roles for customers** (`ClientRole`): admin (everything including who has access), member (projects, documents, tickets), viewer (view only). Billing is a separate switch so an accountant can pay without seeing tickets.
- **Database safeguards** (migrations): append-only evidence tables (audit log, acceptance records, signature records, contract documents) enforced by triggers; sent proposal versions and their lines are immutable; terms versions immutable; **row-level security enabled** on all tables and a **least-privilege `oss_app` runtime role** (no UPDATE/DELETE on evidence; no DELETE on contracts, customers, billing intents). The Supabase Data API is locked down.
- **Team vault:** shared logins are encrypted (AES-256-GCM, key `VAULT_KEY`, else derived from the auth secret); lists never carry passwords; revealing one is **logged with who looked**.

---

## 5. Data model, by domain

45 tables (health check reads all of them).

| Domain | Tables | Notes |
|---|---|---|
| **Identity** | `User`, `Session`, `Account`, `Verification`, `TwoFactor`, `KnownDevice`, `Passkey`, `Workspace`, `StaffMembership`, `ClientMembership`, `Invitation` | `Workspace.settings` (JSON) holds the security rollout, email preferences, legal-sync version and more. `StaffMembership` has username, alias email, job title, signature, photo |
| **CRM** | `Customer`, `Contact`, `Opportunity` | Customer lifecycle: prospect / active / paused / former. Reference `OSS-CU-0001`. Customer has structured address, company number, profile photo (`CompanyLogo` for logos). Exactly one primary contact per company |
| **Sales** | `Proposal`, `ProposalVersion`, `ProposalLine`, `ProposalAcceptance`, `ScopedLinkToken` | A proposal has immutable versions once sent. `ProposalVersion.requirements` (JSON) carries: project type, care plan, deposit %, offer (free months, % or £ off, label, "free months just end"), and the plain-language detail fields |
| **Agreements** | `Contract`, `SigningRequest`, `SignatureRecord`, `ContractDocument`, `TermsVersion` | Contract status: draft, awaiting_signature, completed, declined, expired, voided. A signing request **freezes** the exact text and the terms version that was sent. Signature records and the final PDF are append-only |
| **Money** | `BillingIntent`, `Receipt`, `ServicePlan` | One `BillingIntent` per charge: kind `deposit` / `balance` / `recurring_setup` / `one_off` / `change`; status pending / paid / active / past_due / cancelled; `paidVia` stripe / bank / other / **free**; trial months, `cancelsAt`, `requestedAt` (when the final payment or plan was requested). **Money in is counted from `Receipt` rows only** |
| **Delivery** | `Project`, `Task`, `ProjectUpdate`, `AssetRequest`, `Attachment` | Project stages: planned, awaiting_assets, design, development, qa, client_review, ready_to_launch, launched, completed, held, cancelled. Updates can be client-visible or internal. Files stored in the database (`Attachment.bytes`) under the host's 4.5 MB request limit; photos shrunk in the browser |
| **Support** | `Ticket`, `TicketComment`, `AccessRequest` | One ticket system with a category: onboarding / change_request / support. Statuses: open (New), in_progress, customer_replied, waiting_customer, resolved, closed |
| **Team workspace** | `CalendarEvent`, `EventAttendee`, `Note`, `NoteRevision`, `NoteComment`, `VaultEntry` | Notes are optimistic-locked with a revision per save; the Team Board is a feed of posts with comments |
| **Platform** | `AuditEvent`, `Outbox`, `SequenceCounter` | `AuditEvent` is the tamper-proof log. `Outbox` is the email/effect queue. `SequenceCounter` allocates references atomically (`OSS-QT-2026-047`, never count+1) |

---

## 6. Feature catalogue: team app

Navigation: Today, Companies, Projects, Calendar, More (Agreements, Payments, Tickets, Pipeline, Notes, Team Board, Vault, Team, Backup, Settings, Testing). A global **search / command palette** (permission-aware, workspace-scoped) and a **"smart bubble"** of suggestions.

**Today** (`/`): counts-only dashboard with ring and bar charts, what needs doing now, clickable widgets. **Smart suggestions** (`modules/smart`): permission-aware prompts that say why they show and link straight to the fix; "Later" hides one for the day.

**Companies** (`/customers`): list, add a company (one form registers the company and its first person), company page with tabs (overview, tickets, projects, agreements, people...). Edit details and address, upload a company logo, archive, **permanently delete a company and everything under it** (`crm/delete.ts`; only the tamper-proof log remains, holding ids not details). People panel: invite to the portal with an access level, set the primary contact, manage access levels, handle **access requests** from the portal.

**Pipeline** (`/pipeline`): opportunities by stage (new, qualified, proposal sent, contract pending, won, lost), shown in the same plain words as tickets.

**Agreements** (the quote-to-contract flow, see 7): list (default "Open"; cancelled and withdrawn hidden), a guided **5-step wizard** (the job; price; payment and offer; details; check and send), live price summary, preview exactly as the customer sees it (page and PDF), send for signing, resend (re-sends the *same frozen text*), revise ("Change it and send a new version"), withdraw, void, **cancel a signed order**, view-as-sent.

**Payments** (`/payments`): money in (receipts), money due, upcoming, per company; buttons to **email the payment link**, **request the final payment**, **start the care plan now**, record a bank payment, continue a free plan as paid.

**Projects** (`/projects`): list by stage with progress rings; a project page with stage guidance and a checklist, "what we need" requests the customer fulfils (assets), tasks, updates (client-visible or internal), files and folders, linked tickets, project type, stage transitions that trigger billing events (see 7). Roles without project access are sent to the no-access page.

**Tickets** (`/tickets`, `/support`): one ticket system, type chosen first (New website, Change request, Support). Replies, internal notes, attachments with lightbox, priority and "what to expect" wording, reminder engine (nudges after no reply, final warning, auto-sorted), **change requests with a price**: team prices, customer approves in the portal, approval becomes a payment on their Billing page; a price of nothing means "included in your plan".

**Calendar** (`/calendar`): month/agenda with add-on-date, attendees, ICS download with sequence numbers so edits replace and cancels cancel.

**Notes and Team Board**: team-visible or private notes with revision history and comments; a board feed of posts with comments.

**Vault**: encrypted shared logins (see 4).

**Team** (`/team`): invite staff, roles, deactivate, reset someone's two-step sign-in (owner only).

**Backup** (`/backup`): business-data export for one workspace; deliberately excludes logins, hashes, sessions, link tokens and the email queue. A weekly reminder email is sent if overdue.

**Account** (`/account`): own profile, job title, signature (with live preview), photo, password, two-step setup, devices.

**Settings** (side menu): Emails (which emails send, sample previews, test send), Notifications (each team notice: immediately / in the daily digest / not emailed), Plans (care plans), Terms (versioned terms), Legal documents (customer-facing legal pack, editable, version history), Security (rollout of passkey/authenticator/new-device code, who tests).

**Testing** (`/testing`): create a ready-made **demo company** to walk the whole customer experience (use Stripe test cards), reset it, send queued emails, send the digest now, see **recorded problems** (`lib/problems.ts`).

---

## 7. The core business flows

### 7.1 Quote to signed order
1. Team starts an agreement (wizard). The shared builder (`signing/service.ts`: `assemble`, `previewAgreement`, `composeAgreement`) produces the text: scope, price lines, **deposit % and the two payments in plain words**, the **offer** (free months and how they end, % or £ off), care-plan terms (SLA, hosting) if a plan is chosen, and the standard Services Agreement.
2. **Send** creates a `SigningRequest` that **freezes** the text and the terms version; the customer gets one email with a link `/s/<token>` (no account needed).
3. Customer reads and signs (typed/drawn signature, consent). The system writes an append-only `SignatureRecord`, `ProposalAcceptance` and the sealed `ContractDocument` PDF. Confirmation emails go to both sides.
4. **Completion workflow** (`contracts/service.ts: runCompletionWorkflow`), in one transaction: contract completed; opportunity won; **project created**; billing intents created (deposit, balance, setup/plan as applicable, free plan marked `free`); a **"payment ready" email** with the deposit link is queued.

### 7.2 Payments (Stripe)
- Customers pay from the portal Billing page or from an emailed link. **Stripe Checkout** is created per charge (payment methods managed in the Stripe dashboard); monthly plans use Stripe subscriptions.
- The **webhook** (`/api/stripe/webhook`, signature verified, **idempotent**) marks intents paid, writes a `Receipt`, handles async payment success and failures, subscription start/cancel; emails go out ("payment received", "plan started", "payment failed").
- **Timing rules** (important and easy to get wrong): the **deposit** is due at signing; the **final payment is locked until requested or launch** (`requestedAt`; project reaching `ready_to_launch` requests it); the **care plan and any free months start when the site goes live**, not at signing (`startCarePlan`, triggered by `launched`, or manually "start now"). A free care period is a `paidVia: "free"` intent that stays pending until launch, then runs with `trialEndsAt`/`cancelsAt`. "Free months that just end" needs no card.
- **Offers** (`billing/promo.ts`): free months, percent off, pounds off, a label; percent and pounds discounts apply to the website fee. Presented consistently through `pay-summary`, `price-lines` and the agreement text.
- **Cancel an order** (signed): hidden from open lists, projects and the customer's billing; shown as Cancelled, never as Signed; nothing left to collect.
- Receipts: `/api/receipts/[id]` PDF, linked from emails and the portal. Not VAT registered: no VAT lines.

### 7.3 Delivery
Project stages move through the team UI. Moving to `ready_to_launch` requests the final payment; `launched` starts the care plan. The customer sees stage, "what we need" requests (they upload files or text, which flips the request to received), client-visible updates, files shared with them, and linked tickets.

### 7.4 After launch
Support and change-request tickets; care plan billing via Stripe; "continue free plan" converts a free care period into a paid card-on-file plan; cancellations end on `cancelsAt`.

---

## 8. Feature catalogue: customer portal

Pages: **Home** (overview), **Projects** (list and detail), **Documents** (signed agreements, receipts, files shared with them), **Billing** (what is due, pay, plan status, receipts; admin and billing-access people only), **People** (who has access, invite, change levels; admin only), **Get help** (raise and follow tickets; request a change; approve a quote), **Settings/Account** (profile picture, password, two-step).

Access is enforced by `portal/access.ts`: admin, member, viewer, plus a separate billing switch. Colleagues at a company see each other's tickets and who raised them (stated in the privacy notice). Members and viewers who open Billing or People are sent back to Home.

The portal has its own look (distinct from the team app), a cookie notice (a popup), and legal links on every screen.

---

## 9. Email, outbox and scheduled work

- **Outbox pattern** (`lib/audit.ts: enqueue`, `modules/outbox/drain.ts`): business code enqueues an effect inside the same transaction as the change; a drain **claims rows atomically** (`FOR UPDATE SKIP LOCKED`, marked "sending"), sends outside the transaction, marks done; failures back off up to 5 attempts and are visible; stale "sending" rows are re-queued after 10 minutes. A dedupe key plus a provider idempotency key make retries safe. Single-use links are deleted from the payload once delivered.
- **27 email templates** (`src/emails/templates.tsx`): proposal, contract_request, signing_confirmation, signing_notice, invitation, staff_invitation, password_reset, password_changed, security_notice, backup_reminder, payment_ready, payment_received, payment_notice, payment_failed, balance_requested, plan_ready, plan_started, access_request_notice, access_request_decision, change_request_quote, change_request_decision, ticket_received, ticket_notice, ticket_reply, ticket_resolved, ticket_reminder, ticket_team_reminder, daily_digest. Shared layout uses the portal's fonts and logo.
- **Sender identities:** nobody types a From address; automated mail uses a function address, anything a person writes uses their own alias.
- **Notification settings:** each team notice can be immediate, bundled into one **daily digest** (7am, at most one a day) or not emailed, because most things also show in the app.
- **Cron** (one, daily 07:00 via Vercel): `/api/cron/outbox` retries unsent mail, sends the digest, runs ticket reminders, sends the backup reminder if due. Secured by `CRON_SECRET`.
- **Local/dev delivery:** with no Resend key, mail goes to a sink (a folder locally; also a dev-only database table on the dev site so tests can read it). With a key on a non-production site, only addresses in `MAIL_ALLOWLIST` are sent.

---

## 10. Legal documents

Customer-facing legal text (Terms of use, Privacy Notice, Cookie notice, plus the agreement pack: Services Agreement, SLA, Hosting terms, etc.) is **written in code** (`settings/legal-text.ts`, `legal-starters.ts`) and **auto-published per workspace** (`sync-legal.ts`) once per version of the set, never overwriting a team member's own later edits. Public routes `/legal/*` on both hosts; Terms are versioned (`TermsVersion`, immutable) and the exact version is frozen into each signing request. Cookie behaviour is a notice popup.

---

## 11. Data protection, audit and retention

- **Tamper-proof audit log** (`AuditEvent`, append-only by trigger) of security-relevant actions; references allocated atomically.
- **Evidence** for signing: IP, device type, time, signature image, frozen text and terms, sealed PDF.
- **Erasure:** delete a company completely (`oss_erase_company` definer function and `crm/delete.ts`); portal logins that belonged only to that company are removed; the audit log keeps ids only.
- **Backups:** the Backup page export (business data only) and the weekly reminder. Supabase free plan has no automated backups (see 15).
- **Privacy notice** states exactly who can see what, retention periods (accounts 6 years after, signed agreements and payment records 6 years from year end, tickets 3 years after closing, sign-in records 12 months).

---

## 12. Environments, deployment and quality gates

| | Live | Dev |
|---|---|---|
| Sites | manage / portal.onesimplesite.co.uk | manage.dev / portal.dev.onesimplesite.co.uk (behind Vercel sign-in) |
| Database | Supabase `mxjgysmphfsofqiucxxz` | **separate** Supabase `ejssfyuvhsgvpqzctowa` |
| `APP_ENV` | production | staging |
| Deploys | **You press "Redeploy" on the production deployment** (never "Promote" a dev build) | **Automatic** on every push of this branch; the build migrates and seeds the dev DB |
| Email | Resend | sink + DB capture (or Resend limited by allow-list) |
| Banner | none | yellow "DEV SITE" strip and `[DEV]` page titles |

- **Mix-up guard** (`lib/db-guard.ts`, `scripts/vercel-build.sh`): a non-production site that points at the live database, or production pointing at dev, **refuses to start**; the dev auto-migrate refuses when it can see the live id.
- **Migrations** are Prisma migrations, applied to live **by explicit approval** and recorded in `_prisma_migrations`; additive ones go **before** deploy, behaviour-dependent data repairs **after**. The live app role cannot read the migrations table.
- **Health:** `/api/health` reads every model through Prisma and reports missing columns or permissions. `scripts/smoke.sh` (public pages, sign-in redirects, fonts, 404, webhook refuses unsigned, health), `scripts/verify.sh` (`npm run verify`: typecheck, unit tests, env-less build, build with env), GitHub Actions `checks.yml`.
- **Dev logins** (`scripts/dev-accounts.ts`): staff `abukar.sharif` (owner), `dev.director`, `dev.delivery`, `dev.sales`, `dev.support`, `dev.finance`, `dev.member`; customers `portal.abukar.sharif@example.test` (admin at two companies), `portal.admin`, `portal.member`, `portal.viewer`. Password is `DEMO_PASSWORD`.
- **Dev-only hooks** (`/api/dev/hooks`, 404 outside dev, plus `CRON_SECRET`): fixed set-up jobs for tests (drain outbox, read/clear captured mail, seed demo orders, set security mode, reset a profile, ensure a care plan). Takes no SQL or code from the caller.
- **Tests:** unit tests (identity, billing, signing, promotions, emails, guards, Stripe signature, etc.) and 14 Playwright suites (journey, agreements, revise, lists, settings, payments, portal-billing, client-setup, cancel-order, return-to, security, uploads, crawl of every page on desktop and phone, screenshots). Suites run locally, and against dev through the hooks (`E2E_TARGET=dev`).

---

## 13. Cross-cutting conventions and invariants (rules a redesign must keep)

1. **All writes are server actions that call `src/modules/*`.** Pages and components never touch business rules.
2. **Every query is workspace-scoped**; capability checks happen in the module, not only the page.
3. **Money is integer minor units** (pence). **Money in = `Receipt` rows only.**
4. **A sent agreement is frozen** (text, terms version, price lines). Resend re-sends the frozen text. Changes create a new version.
5. **Evidence and audit tables are append-only** in the database itself.
6. **Effects go through the outbox**, enqueued in the same transaction as the change.
7. **Webhooks are idempotent.** Stripe signature verified.
8. **Plain language everywhere** (statuses and labels are in plain words, one vocabulary for team and customer, e.g. "New / Quote sent / Waiting to sign / Signed").
9. **Buttons slim and squarer; team accent green; team UI must not feel like the customer portal.**
10. **The env-less build must pass** (no reading of environment values at import time).
11. **Never `Promote` a dev deployment**; live changes only by Redeploy; live database only changes by explicit additive migrations.

---

## 14. Third-party services

Supabase (Postgres), Vercel (hosting, cron, domains), Stripe (payments, webhooks, live restricted key kept in Vercel env), Resend (email), Better Auth (library), GoDaddy (DNS for `onesimplesite.co.uk`, including the `dev`, `manage.dev` and `portal.dev` CNAMEs).

---

## 15. Not built, partly built, or known limits

- **In-platform notifications** for the team (bell, page, per-person preferences): not built (only email, the Today page and the smart bubble).
- **Onboarding rework** items still open: no duplicate ticket for a new order, a "Signed agreements" tab, no repeated project-type question, agreement visually distinct from tickets (the wizard and Agreements area cover part of this).
- **One source of truth for how a charge is presented** (`describeCharge`) does not exist yet; the same charge is formatted in several screens, so a change can leave one behind.
- **Live Supabase is on the free plan:** pauses after about a week without use, **no automated backups**. Use the Backup page export regularly or move to a paid plan.
- **Connection pooling:** the dev site needed the transaction pooler (port 6543) to avoid the 15-connection session-pool limit; the live runtime connection should be reviewed for the same risk.
- **Files live in the database** (4.5 MB request limit); no object storage.
- **Stripe on dev** has no test keys configured yet, so dev payments and the webhook are untested end to end.
- **Hobby plan limits:** one daily cron only; function time limits.
- **Single workspace** in practice (the data model is multi-workspace; the product is not exposed that way).
- **No VAT** (not VAT registered), no invoicing beyond receipts.
- **Roles with no project access** now see "no access" (fixed); other pages that rely on a thrown "forbidden" error rather than a redirect should be audited the same way.
