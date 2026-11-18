# OneSimpleSite: how the work flows (process design)

This is the process layer: for each thing the business does, the steps, who does what, what state it is in, what is written to the activity log, and what the customer sees. It sits on top of the data model in `ARCHITECTURE.md` and the state machines in `RECONSTRUCTION.md` section 4.4. Written after reviewing open-source tools that solve the same problems.

## What the research says (and what we take from it)

| Source | What it does well | What we take |
| --- | --- | --- |
| Documenso (open-source signing) | Prepare, Send, Notify, Sign, Complete. Per-recipient links, roles (signer, approver, viewer, CC), optional signing order, expiry, an audit trail (created, sent, viewed, signed, with time and IP), the finished file sent to everyone. | Our agreement becomes a lifecycle with a recorded "viewed" event, optional countersign by us, an audit certificate attached to the signed PDF, and a copy to every named person. |
| Twenty CRM | Standard objects (Company, Person, Opportunity, Task, Note) plus a timeline on every record, workflows triggered by record changes. | Every company has one timeline: what happened, when, by whom. Processes below all write to it. Automations (reminders, follow-ups) are triggered by those same events. |
| Lago / Stripe Billing (subscription lifecycle) | Plans, trials, invoices as the unit, retries and dunning when a payment fails, proration and cancellation rules. | One lifecycle for the care plan: trial (free months), active, past due (retry then escalate), paused, cancelled. Charges are always an invoice row first, so what is owed is never inferred. |
| Multi-step form research (Nielsen Norman, Baymard, others) | Split long or branching forms into named steps; one thing per screen; a progress indicator with names; a final review; keep data when going back; Back and Next within thumb reach and above the keyboard; short forms stay on one page. | The `Wizard` component. Used for any flow with more than about five fields or a branch: new ticket, add a company, and next the agreement and onboarding. |

## Principles

1. **One screen, one decision.** Named steps, a visible way back, a review before anything is created.
2. **Everything leaves a trace.** Every state change writes an activity row (who, what, before, after, when). The timeline on a company, ticket and agreement is built from them. Nothing is changed silently.
3. **States, not flags.** Each object has one status with defined transitions. The screen only offers the transitions that are allowed from where it is.
4. **The customer is told, not chased.** Each transition says who is notified, in the app first, by email second (see notification settings).
5. **Money is an invoice row.** Deposits, final payments, change requests and plan months are all rows with a status. Reports and the customer's Billing page read the same rows.
6. **Flexible by data, not by code.** Plans, deposit percentages, promotions, free months and terms are settings and per-company overrides, not constants.

## The processes

### 1. Add a company (done as a wizard)
Kind, Company, Contact, Check. Creates company and first person; optionally continues straight into an agreement. Log: `company.created`, `contact.created`. Next: duplicate check on name, company number and email before the final step ("a company like this already exists, open it?").

### 2. Ticket (done as a wizard)
Kind (change request / support), Who, Details, Handling (cost for change requests, priority, owner), Check. Log: `ticket.created`, then every status change, reply, price set, approval, payment. Change request path: priced, sent for approval, approved or declined, paid, done. Support path: open, in progress, waiting on customer, resolved.

### 3. Agreement (onboarding): to be rebuilt as a wizard
Steps: Company and signer, What they are buying (website type, extras), Price and deposit (promotions applied and shown), Care plan (free months, then monthly), Terms (versions chosen and shown), Check, Send.
States: draft, sent, viewed, signed, countersigned (optional), active, expired, declined, withdrawn, cancelled.
Log: created, edited (per version), sent, viewed (first open, with time), signed (name, method, time, IP), countersigned, withdrawn, declined (with reason), reminder sent.
Customer sees: one link, the document, a clear "what you are agreeing to" summary, then the signed confirmation with their copy.

### 4. Billing and subscription lifecycle
- **Deposit**: due on signing (percentage per agreement). Paid by card. Log: invoice created, paid, failed.
- **Build**: work happens; no money moves.
- **Final payment**: due before launch. The customer is asked when the site is ready, never earlier.
- **Care plan**: free months (promotion or standard), then monthly. States: scheduled, free period, active, past due (retry on day 1, 3, 7; email each; ticket to the team on the last), paused, cancelled (with a stated end date).
- **Change requests**: priced, approved in the portal, then paid.
Log: every invoice and plan state change. The customer's Billing page and the team's Payments page are two views of the same rows.

### 5. Onboarding after signing
On signed: create the project from a template (stages and checklist), create the first tasks, send the welcome email with the portal invitation, put the deposit invoice in front of the customer. Each is an event the runner handles; each logs. If a step fails it is retried and shown on the company timeline as "needs attention".

### 6. Project delivery
Stages: planning, design, build, review, live. Moving a stage notifies the customer and asks for the thing needed (content, approval). Launch triggers the final payment request and the start of the care plan.

### 7. People and access
Invite (by email, with access level), accept, active, level changed, two-step on, removed. Each is logged. A person at a company can request a colleague; the team approves.

### 8. Support conversation
A ticket is a conversation. Replies, internal notes (team only) and system events share one thread. Files go through preview before sending.

### 9. Security and account
Sign-in, new-device checks, passkeys, two-step. Every sensitive change writes to the activity log and emails the account owner.

## What is built, and what is next

Built: the `Wizard` (named steps, validation per step, review with edit links, one submit), used for the new ticket, add-a-company and start-an-agreement flows; the customer portal ticket flow already had its own stepper and should move onto the same component. Also built: signing with a live checklist, option cards and chips for choices, the glass confirm dialog, the team Manage sheet, keyboard-safe popups, a saved reply draft.

Built since: the agreement already had a saved five-step flow (The job, Price, Payment and offer, Details, Check and send); it now uses the same step bar, footer and review look, a "viewed" event is recorded the first time the customer opens the link, and one Timeline (company activity and each agreement) turns the recorded events into sentences grouped by day. Next, in order: countersign; duplicate check on company create; billing lifecycle states and the retry schedule (needs a scheduler: GitHub Actions or pg_cron, since Vercel Hobby cron runs once a day); one activity timeline component used on company, ticket and agreement; onboarding runner; project templates.

## Decisions needed from the owner

- Who countersigns, and is countersigning required before the agreement is active?
- Retry schedule and who is told when a care-plan payment fails.
- Cancellation rules for the care plan (notice period, end of the paid month).
- Do customers get the audit certificate with their copy, or only on request?
