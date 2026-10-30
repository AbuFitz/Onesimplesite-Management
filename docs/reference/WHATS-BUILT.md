# What is built (31 Oct 2026)

This replaces the older table in `IMPLEMENTATION-STATUS.md`, which describes the first build and is now out of date.

## The working model

**Customer → Ticket → Quote → Signature → Project.**
A *ticket* (stored as an `Opportunity`) is one piece of work for a customer. The *New ticket* popup captures the customer, business, work type, priority, due date, assignee and price in five dropdown-led steps, and creates the customer (or reuses one) plus a draft quote. Sending the quote for signature emails one link. The customer signs once (draw first, or type), and the signed PDF goes to them, to hello@ and to their portal. The ticket then reads **Signed** and a project is created.

Ticket status words: New · In progress · Waiting to sign · Signed · Lost. They move on their own; the only manual change is *Mark lost*.

## Areas

| Area | Where | Notes |
|---|---|---|
| Today | `/` | Open tickets, waiting to sign, projects, tasks, agenda, recently signed, backup reminder, profile banner |
| Customers | `/customers` | Tabs: overview, tickets, projects, notes, activity |
| Tickets | `/pipeline` | Filters: Open, Waiting to sign, Signed, Lost. Opens the quote |
| New ticket popup | `?new=ticket` on any staff page | Same popup from the **New** menu, customer pages and the empty states |
| Calendar | `/calendar` | Month grid always shown; day panel with quick add; mine/team; ICS per event |
| Notes | `/notes` | Page list + autosaving page editor, read view with tickable to-dos, team/private, conflict warning |
| Passwords | `/vault` | Shared team logins. Encrypted before storage (AES-256-GCM), revealed one at a time, every reveal/change logged, excluded from backups |
| My account | `/account` | Name, job title, optional phone, email signature with live preview, change own sign-in email (needs password), change password |
| Business settings | `/settings` | Company details · Legal documents · Emails |
| Legal documents | `/settings/legal` | Terms and Conditions, Privacy Notice, Cookie Notice, Website Terms, Data Processing Agreement, Change Request. Versioned; published versions never change; publishing is blocked while any `[TBC: …]` remains; live preview in the issued-document layout |
| Public legal pages | `portal.<domain>/legal/privacy`, `/cookies`, `/website-terms` | Show the published version only |
| Emails | `/settings/emails` | Every email the system sends, rendered with sample data, desktop and phone |
| Team | `/team` | Owner only. Invite, level, deactivate. Usernames are generated as `first.surname` |
| Backup | `/backup` | Manual download of business data |

## Signing in
Staff sign in with **username or email** (`first.surname` is generated from the name typed on invite and cannot be edited). Customers use email only.

## Live updates
Staff and portal pages re-fetch every 10 to 15 seconds while the tab is visible and straight away when it regains focus. Editors keep their typed text.

## Design rules
Grey application frame, white working panel, left rail with a clear active state. Text and borders meet WCAG AA contrast. Dropdowns for choices, free text only where needed. Every flow works at 375px.

## Environment variables
`DATABASE_URL`, `MANAGE_ORIGIN`, `PORTAL_ORIGIN`, `APP_ENV`, `BETTER_AUTH_SECRET`, `RESEND_API_KEY`. Optional: `VAULT_KEY` (base64, 32 bytes; otherwise derived from `BETTER_AUTH_SECRET`, so do not rotate that secret without re-saving vault entries), `ALLOW_DRAFT_TERMS`, `MAIL_ALLOWLIST`, `INTERNAL_NOTICE_TO`.

## Database changes since the first build
`staff_username`, `team_vault`, `job_ticket_fields`, `staff_profile`, `legal_documents`. Each is applied to Supabase and recorded in `_prisma_migrations`.

## Known limits
- Emails the team writes from inside the system, and capture of customer replies, are not built yet. Signatures are stored and previewed but only used once that exists.
- The wording assistant is not built.
- Staff two-factor enrolment screen is not built.
- Vercel's free plan allows 100 deployments a day; hitting it blocks new production deploys until it resets.

## Glossary
- **Ticket**: one piece of work for a customer, from first contact to signed.
- **Quote**: the price, requirements and payment plan attached to a ticket. Sending it for signature freezes it.
- **Agreement**: the quote plus our Terms and Conditions as the customer sees and signs it. Immutable once sent.
- **Outbox**: the queue every email goes through, so a failed send is retried and never duplicated.
- **Capability**: one permission (for example `vault.use`). Team levels are sets of capabilities.
- **RLS**: row level security in the database; the app role is the only one allowed to read business tables.
