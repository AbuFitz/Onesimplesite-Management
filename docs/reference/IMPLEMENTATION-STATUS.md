# Implementation status (30 Oct 2026)

> **Out of date.** See `WHATS-BUILT.md` for the current state. This table describes the first build.

Legend: **IT** implemented + tested locally · **IU** implemented, unconnected to a live provider · **P** partial · **D** deferred · **B** blocked on owner input.
"Tested" means local automated tests (19 domain/DB tests, one Chromium journey that includes the full propose → sign → email → portal path). No live provider evidence exists. Not tested on WebKit, physical iOS/Android, Gmail/Outlook, or with real credentials.

| Area | Status | Notes |
|---|---|---|
| Brand assets organised (`brand/`, `public/brand/`, manifest) | IT | No compact mark supplied, so full wordmark/text label used |
| Schema + migrations (CRM, proposals, contracts, projects, calendar, notes, audit, outbox) | IT | Constraints/triggers in raw SQL; fresh install and dump/restore drill verified locally |
| Staff auth (Better Auth, invite-only, host-only cookie namespace) | IT | Sign-up disabled; accounts created only via hashed single-use invitation |
| Staff MFA (TOTP) | P | Plugin wired and login challenge UI exists; **no enrolment screen yet**, so staff cannot turn it on in-app. Required before production |
| Client invitations / portal login | IT | Staff "Invite to client portal" → email → set password → portal. Account switcher UI not built |
| Capabilities by role, workspace scoping | IT | Server-side in services; cross-workspace read/write and FK attachment tested |
| Customers/contacts/opportunities, new enquiry, search, pagination | IT | No duplicate detection/merge, no edit screens yet |
| Pipeline with stage change + loss reason | IT | Select-based; no kanban |
| Versioned proposals: draft, save (stale-guard), send, revise, public acceptance | IT | Sent versions immutable at DB level; old link dies on revise; hashed expiring tokens; concurrent acceptance yields one acceptance/contract |
| Contract draft from accepted proposal (unique conversion) | IT | |
| Contract signing: original single-signer capture | IT (local) | Staff send → emailed single-use link → signer reads contract on phone/desktop, types or draws signature, consents, submits → flattened PDF generated once, evidence + SHA-256s stored immutably, contract completed, project/billing intentions created once. Decline, void, reissue and expiry handled. **Electronic capture only: no PAdES/certificate, no identity verification.** Wording of the agreement/consent needs your approval before real use. Manual "recorded outside the app" fallback remains |
| Emails (React Email: proposal, contract request, signing confirmation w/ PDF, internal notice to hello@, portal invitation) | IT (sink) / IU (Resend) | HTML + plain text, versioned, preview at `/dev/emails` in development. Rendered and sent to the local sink; **never sent through Resend or opened in Gmail/Outlook/Apple Mail** |
| Signed PDF in client portal + staff download, evidence JSON | IT | Download authorised by client membership; hash re-checked on every download; downloads audited |
| Portal invitation from a customer record | IT | Single-use hashed token; contact added ≠ access |
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
