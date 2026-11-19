# Platform review: how it works, what is solid, what is weak

Written from the code and the running app, with the open-source products that solve the same problems as the yardstick.
"Verified" means I read it in the code or saw it run. Anything I could not check is marked as such.

## 1. The shape of the system (verified)

- One Next.js app, two hosts: the team app and the customer portal, told apart by hostname (`proxy.ts`). Two separate sign-in systems share one user table, and a login only works on its own side (checked on every sign-in).
- Postgres through Prisma. Business logic lives in `src/modules/*` (identity, crm, sales, signing, billing, support, projects, calendar, notes, vault, files, outbox, settings, today). Server actions in `src/app/actions/*` are thin: they check permission, call a module, redirect with a message.
- Every permission check goes through one place: `requireStaff(permission)` / `requireClient()`. The action files that looked unprotected (people, projects) route through a shared `run()` that calls it first. Verified.
- Emails go through an outbox table (`Outbox`, unique by dedupe key), so a retry never double-sends. A daily digest bundles held team notices.
- Money: one `BillingIntent` row per charge, Stripe webhook records each event once (by event id) and applies it; receipts are unique per charge and key, so a replay cannot create a second receipt. Verified.
- Audit: `audit()` writes an `AuditEvent` for each change; the company and agreement timelines read them.

## 2. What the open-source yardsticks teach, and where we stand

| Area | Yardstick | What it does well | Us today |
| --- | --- | --- | --- |
| Support | Chatwoot | Conversation-first inbox; statuses open, pending, snoozed, resolved; assignment policies; private notes; SLA policies that put a clock on first response and resolution and warn before a breach | Tickets with owner, priority, private notes, reminders. **No SLA clock, no snooze.** Reminders exist but only run on a schedule we do not control (see 3.1) |
| Projects | Plane | "Progressive complexity": everything simple by default, richer features switched on when needed; states, work items, cycles, saved views | Stage-based projects with templates, checklist, customer requests, files. Simple by default, good. **No saved views, no due-date rollups across projects** |
| Calendar | Cal.com | Abstracts many calendars; availability; ICS; audit log | Events with attendees, ICS download, add/edit. **No two-way sync, no availability** (not needed yet) |
| Passwords | Vaultwarden / Bitwarden | Zero-knowledge: the server cannot read secrets; reveal is logged | Secrets encrypted in the database and every reveal is audited. **The server (and so anyone with the key) can read them; this is "encrypted at rest", not zero-knowledge.** Fine for a small team if the key is protected, but it must be described honestly |
| Signing | Documenso | Prepare, send, notify, sign, complete; viewed event; sealed PDF with audit trail | All of that except sealing: **the signed PDF is not cryptographically signed**, though it carries a SHA-256 fingerprint and a full evidence record. We now also record the first open |
| CRM | Twenty | Standard objects plus a timeline on every record | Companies, people, agreements, tickets, projects with a timeline on the company and the agreement |
| Billing | Lago / Stripe Billing | Invoices as the unit, retries and dunning, plan lifecycle | Charge rows with clear states, free-month offers, deposit/final/care plan. **No retry schedule or dunning of our own** (relies on Stripe's) |

## 3. Mechanical findings

### 3.1 Background work depends on traffic (verified, fixed in part)
Retrying unsent emails, ticket reminders, the daily digest and legal-document sync all live in one endpoint (`/api/cron/outbox`). Vercel's free plan runs a cron job once a day, and the fallback (`maybeRunReminders`) only fires when a team member opens the app, at most every 10 minutes. A quiet weekend means late reminders.
**Fix added:** `.github/workflows/scheduler.yml` calls the endpoint every 15 minutes. It does nothing until you add two repository secrets (`CRON_SECRET`, `JOBS_URLS`). The jobs are safe to repeat (the digest is capped at once a day; the outbox is idempotent).

### 3.2 No loading or error screens (verified, fixed)
There were no `loading.tsx`, `error.tsx` or `not-found.tsx` anywhere, so every slow page looked frozen and any failure showed the framework's bare error page. Added: a loading skeleton for the team app and portal, a friendly error card with a retry and a reference code, and a not-found page.

### 3.3 Rate limiting (corrected, partly fixed)
I first wrote that nothing limited attempts. That was wrong: the sign-in library limits sign-ins by default (3 attempts per 10 seconds per address). What was missing was any limit on password reveals and password-reset requests, and the limits were implicit.
**Fixed:** the sign-in, reset-request and reset limits are now written out in `src/lib/auth.ts`, and one person can reveal at most 30 stored passwords an hour (counted from the audit log, so no schema change).
**Still true:** the sign-in limiter keeps its counts in each server's memory, so on serverless hosting it slows a guesser rather than stopping a determined one. Shared storage (a database table) would make it exact; that is a schema change. Re-entering your password to reveal a stored one is also not built.

### 3.4 Webhook replays re-apply the event (verified)
The Stripe webhook records an event once but then applies it again on every delivery. That is safe today only because applying is idempotent (status moves and unique receipts). A short comment and a test would keep it that way.

### 3.5 Drafts live on one device (verified)
Wizard drafts are saved in the browser. They survive a refresh but do not follow someone to another device. Needs a server-side draft table (a schema change; not applied to the live database without approval).

### 3.6 Forms: three patterns in use (verified)
Wizards (new ticket, add company, agreement start, add person, team invite, access request), saved multi-step (agreement price steps), and plain forms (settings, profile, project tasks). The wizards autosave and review; the others do not. Bring the long plain forms (company details, legal editor) onto autosave next.

### 3.7 Search and filters are server-side and shareable (verified, good)
Filters are plain links and query strings, so they work without scripts, survive refresh and can be shared. Counts on chips come from the same function as the list, so they cannot disagree.

### 3.8 Widgets now own their range (fixed)
The 7/30/90 day switch was one setting for the whole page. Each widget now owns its own choice, switches instantly, and remembers it on the device.

## 4. Page by page: purpose, mechanics, gaps

Team app
- **Today**: widgets (counts, trends, status dials, agenda, tasks, projects). Server computes 7/30/90 day series once. Gap: widget layout is stored per device; a team-wide default is not possible yet.
- **Companies / company page**: list with chip filters; company page with overview, people, agreements, tickets, projects, notes, activity (timeline). Gap: duplicate check exists only at creation.
- **Agreements**: create wizard, five-step editor, preview, send, resend, withdraw, revise. Now with a "what is next" card, order journey and payment cards on the agreement page.
- **Payments**: grouped charge list. Gap: no export, no per-month totals view.
- **Tickets**: list with quick chips; ticket page is a conversation with composer (draft saved), status, owner, price/approval for change requests. Gap: no SLA clock or snooze.
- **Projects**: list and stage page. Gap: stage page still stacks many forms; checklist, requests and files should become tabs.
- **Calendar**: week/month/day, add/edit popup, ICS. Gap: no recurring events.
- **Board**: posts, comments, pins. Gap: no mentions or notifications.
- **Passwords**: list, reveal, copy, edit, delete (confirm dialog). Gaps: see 3.3 and the zero-knowledge note.
- **Settings**: home of grouped rows opening their own screens. Team and Backup live here.
- **Popups**: ticket/agreement/project record popups, event dialog, confirm dialog, lightbox, sheets, suggestions, cookie notice, menus. One glass family; keyboard-aware on phones.

Customer portal
- **Home, Projects, Documents, Billing, People, Help, Settings**: Billing now leads with what is owed and shows each order's payment journey. Help is a four-step wizard with drafts. Sign-out is under the profile menu.

Public pages
- **Signing**: floating sheet, live checklist, reading progress, first-open event; sealed PDF is the main gap.
- **Sign-in**: team (photo panel) and customer (feature panel); wrong-side logins now say where to go.

## 5. Next, in order of value
1. Add `CRON_SECRET` and `JOBS_URLS` secrets so the scheduler runs (3.1).
2. Shared storage for the sign-in limiter, and re-entering a password to reveal a stored one (3.3).
3. SLA clock and snooze on tickets (Chatwoot model).
4. Project page as tabs; company details and legal editor on autosave.
5. Server-side drafts (needs an approved migration).
6. Seal the signed PDF (digital signature) so tampering is detectable by any PDF reader.
7. Retry schedule and dunning for failed care-plan payments, driven by the scheduler.
