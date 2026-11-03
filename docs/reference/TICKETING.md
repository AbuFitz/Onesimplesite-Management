# How tickets, businesses and people work

## The three ideas
1. **Business** = a customer company (or sole trader / individual). Everything hangs off it.
2. **People** = the humans at that business. Each has a name, email and position. A person *may* also have a **portal login** at one of three levels.
3. **Ticket** = one piece of work or one conversation, always linked to a business and (if known) the person who got in touch.

## Three kinds of ticket (they are treated differently)
| Kind | What it is | What happens |
|---|---|---|
| **New website** | A new customer / new site | Quote -> customer signs ONE agreement (order, plan, services agreement, SLA, hosting) -> payments set up -> project starts |
| **Change request** | Work outside their plan | We set a price (or "no charge") -> customer approves in the portal -> pays by card -> we do it |
| **Support** | Something broken or a question, covered by their plan | We reply, fix, mark resolved |

## Statuses (same words everywhere)
New · In progress · **Customer replied** · **Waiting on customer** · Resolved · Closed.
Customer writes = *Customer replied*. We reply = *Waiting on customer*. Customers see these as "We've got it / We're on it / Waiting for you / Sorted".

## Flow: new business to live site
```mermaid
flowchart TD
  A[Add a business: type, details, main contact] --> B[New ticket: New website]
  B --> C[Draft quote: price lines, plan, payment plan]
  C --> D[Send for signature: ONE email, ONE signature]
  D -->|customer signs| E[Signed PDF emailed, project created, charges created]
  E --> F[Customer pays website fee by card on Billing]
  E --> G[Customer starts monthly plan on Billing]
  F --> H[Project: planning > design > build > review > live]
  G --> H
```

## Flow: change request
```mermaid
flowchart TD
  A[Customer asks, or team raises] --> B{Is it in their plan?}
  B -->|Yes| C[No charge: just do it]
  B -->|No| D[Team sets a price and sends it]
  D --> E[Customer sees price in portal]
  E -->|Approves| F[Payment appears on Billing, work starts]
  E -->|Not now| G[Back to team with their note]
  F -->|Pays| H[Marked paid, receipt emailed]
  C --> I[Resolved]
  H --> I
```

## Flow: support ticket and reminders
```mermaid
flowchart TD
  A[Customer raises in portal / team raises] --> B[New]
  B --> C[We reply: Waiting on customer]
  C -->|customer replies| D[Customer replied] --> C
  C -->|3 days quiet| E[Reminder 1] -->|7 days| F[Final reminder] -->|10 days| G[Marked sorted]
  C --> H[We resolve: Resolved + email]
  B -.unanswered for 1h urgent / 4h high / 1 day normal.-> T[Daily list to the team]
```

## Who can do what in the client portal
| | Owner | Team member | View only |
|---|---|---|---|
| See projects and documents | yes | yes | yes |
| Raise and reply to tickets | yes | yes | no |
| See and pay invoices, approve costs | yes | only with the billing switch | only with the billing switch |
| See who has access, ask for another person | yes | no | no |

Team controls (Business > People): invite, resend, change level, send password reset, remove access (signs them out), remove the person.
A client owner can ask for a new person; the team approves (can change the level) or declines, and the requester is emailed.

## Emails
Customer: ticket received · team reply · sorted · waiting reminders · change priced (approve) · payment received · plan live · payment failed · portal invitation · access request answered.
Team: new ticket / customer reply · customers waiting list · change approved/declined · payment events · access request.
