# Data model notes

Schema: `prisma/schema.prisma`; raw SQL in `prisma/migrations/*integrity_constraints` (checks, triggers).
Original models only (no upstream models). Scope: every business row carries `workspaceId`; child rows are tied to `Customer(id, workspaceId)` by composite FK so a row cannot be attached across workspaces. Deletes restrict (no cascade) on customer-owned business records.

| Logical entity (brief §14/§6) | Model | Status |
|---|---|---|
| users/sessions | `User`, `Session`, `Account`, `Verification`, `TwoFactor` (Better Auth) | built |
| staff memberships, invitations, client memberships | `StaffMembership`, `Invitation` (token hash), `ClientMembership` | built |
| customers, contacts, opportunities | `Customer`, `Contact`, `Opportunity` | built |
| proposals, versions, lines, acceptances, link tokens | `Proposal`, `ProposalVersion`, `ProposalLine`, `ProposalAcceptance`, `ScopedLinkToken` | built |
| contracts | `Contract` (unique `proposalVersionId`) | built (no signing request/recipient/evidence tables yet) |
| projects, tasks, updates, assets | `Project` (unique `contractId`), `Task`, `ProjectUpdate`, `AssetRequest` | built (no review/approval/change-request) |
| billing intents | `BillingIntent` (unique contract+kind) | built; invoices/payments/subscriptions deferred |
| calendar, notes | `CalendarEvent`, `EventAttendee`, `Note`, `NoteRevision` | built (no reminders/recurrence tables) |
| audit, outbox, sequences | `AuditEvent` (append-only), `Outbox` (unique workspace+dedupeKey), `SequenceCounter` | built |
| files, conversations, tickets, renewals, services, webhooks | — | deferred |

Invariants enforced in the database: money/quantity checks; event end > start; sent proposal versions and their lines immutable (trigger); audit and acceptance rows append-only (trigger + role grants); one acceptance per version; one contract per proposal version; one project per contract; one billing intention per contract+kind; unique references per workspace allocated atomically.
Backup/restore: `pg_dump -Fc` then `pg_restore` into an empty database (drill run locally; row counts matched).
