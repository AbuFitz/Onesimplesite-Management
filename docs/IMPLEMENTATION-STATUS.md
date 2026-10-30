# Implementation status (30 Oct 2026)

Legend: **IT** implemented + tested locally · **IU** implemented, unconnected to a live provider · **P** partial · **D** deferred · **B** blocked on owner input.
"Tested" means local automated tests (12 domain/DB tests, one Chromium journey). No live provider evidence exists. Not tested on WebKit, physical iOS/Android, Gmail/Outlook, or with real credentials.

| Area | Status | Notes |
|---|---|---|
| Brand assets organised (`brand/`, `public/brand/`, manifest) | IT | No compact mark supplied, so full wordmark/text label used |
| Schema + migrations (CRM, proposals, contracts, projects, calendar, notes, audit, outbox) | IT | Constraints/triggers in raw SQL; fresh install and dump/restore drill verified locally |
| Staff auth (Better Auth, invite-only, host-only cookie namespace) | IT | Sign-up disabled; accounts created only via hashed single-use invitation |
| Staff MFA (TOTP) | P | Plugin wired and login challenge UI exists; **no enrolment screen yet**, so staff cannot turn it on in-app. Required before production |
| Client invitations / portal login | P | Portal login + membership checks work (seeded users). No staff UI to invite a client yet (the accept flow supports it) |
| Capabilities by role, workspace scoping | IT | Server-side in services; cross-workspace read/write and FK attachment tested |
| Customers/contacts/opportunities, new enquiry, search, pagination | IT | No duplicate detection/merge, no edit screens yet |
| Pipeline with stage change + loss reason | IT | Select-based; no kanban |
| Versioned proposals: draft, save (stale-guard), send, revise, public acceptance | IT | Sent versions immutable at DB level; old link dies on revise; hashed expiring tokens; concurrent acceptance yields one acceptance/contract |
| Contract draft from accepted proposal (unique conversion) | IT | |
| Contract signing | **B** | **Owner must choose the signing mode.** Built: `manual_record` — staff record completion with evidence ("completion recorded by X"); the app does not verify signatures. Original single-signer capture is not built. No PDF generation/upload yet |
| Completion workflow (one project + billing intentions + outbox, replay-safe) | IT | Billing intentions are not invoices |
| Projects: stage rules + audited transitions, tasks, client-visible vs internal updates, asset requests | P | Owner override reason is accepted but only an owner can use it; no client upload, review rounds, approvals, change requests, launch checklist |
| Client portal: overview, projects, project detail, help, account | P | Isolation tested (A vs B, internal updates hidden). No documents, invoices, uploads, account switcher UI |
| Calendar: events, agenda (14 days), mine/team, cancel (keeps row), ICS download | P | No day/week/month grids, edit, reminders, RSVP, invitations, recurrence. ICS is "Add to calendar" only |
| Notes: create/edit/search, team/private, revisions, archive, customer link | P | Plain text (no Tiptap yet), no page tree/pins UI/templates |
| Outbox + worker (pg-boss schedule + SKIP LOCKED drain), mail sink | IT | Proposal email handler only; failed jobs not yet visible in UI |
| Resend sending | IU | Code path exists; never run live |
| Stripe invoices/subscriptions, webhooks | D | Not started. Billing intentions only |
| Private file storage / uploads | D | Not started (no S3 adapter) |
| Renewals, support tickets, inbox/inbound email, reports | D | Hidden from navigation, not faked |
| React Email templates | D | Only a plain-text proposal email exists |
| Audit trail | IT | Append-only (trigger + role grants); customer Activity tab reads it |
| Least-privilege DB role | IT | `docs/db/roles.sql`; test suite passes as `oss_app` |
| Mobile layout | P | Bottom nav, 44px targets, no overflow checked at 375/390px on two pages and the public proposal page. Not audited elsewhere |
| Accessibility | P | Labels, skip link, focus ring, status icons+text. No automated audit run |
| Docs: data dictionary, API doc, restore runbook | P | See DATA-MODEL.md and below; API.md not written |

## Defects found and fixed while building
- `prisma migrate dev` silently dropped hand-written composite FKs (Prisma didn't model them). Now declared in `schema.prisma`; migration `restore_composite_fks` restores them. Lesson: any raw-SQL constraint Prisma can't represent must be re-verified after each migrate.
- Granting least privilege initially blocked draft saves (line delete). Grant corrected.
- Better Auth 1.7 needs extra `two_factor` columns; added by migration.

## Known risks
- Better Auth is pinned (1.7.14, MIT); its API and plugin schema changed between minor versions, so re-check before upgrading.
- `next` 16 renamed middleware to `proxy.ts`; host routing relies on it.
- Dev/proxy IPs: acceptance IP is recorded only when `TRUST_PROXY=1`.
