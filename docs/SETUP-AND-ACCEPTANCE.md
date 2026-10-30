# Owner setup checklist and acceptance walk-through

## Needed before anything goes live
- [ ] **Signing mode decision** (external provider / original single-signer capture / manual record). Until then contracts are `manual_record` only.
- [ ] Legal entity, address, VAT status, approved contract wording; deposit/balance policy.
- [ ] Managed PostgreSQL; create `oss_migrate` (owner) and `oss_app` (runtime) roles, run `docs/db/roles.sql`.
- [ ] Private S3-compatible bucket (not yet used by code).
- [ ] DNS for manage./portal. hosts (values come from your host); Resend domain verification and keys; Stripe test then live keys (not yet used).
- [ ] Set `BETTER_AUTH_SECRET`, origins, `APP_ENV=production`, `TRUST_PROXY=1` only behind your own proxy.
- [ ] Send staff invitations (Abukar owner, Farhan client director, Matthew delivery are seeded as **pending**; `npm run db:seed` prints one-off invite paths).
- [ ] MFA enrolment screen must exist and be mandatory for staff before production.
- [ ] Backups: automated DB backups + storage versioning; run a restore drill on the real provider (local drill passed with `pg_dump -Fc` / `pg_restore`).

## Local acceptance (after the README run steps; password for all dev users: `demo-password-123`)
1. Sign in at `http://manage.localhost:3000/login` as `demo.owner@example.test`. Expect the Today page.
2. Customers → New enquiry (name + contact + email) → saves, opens customer detail.
3. New proposal → add a one-off and a recurring line → Save draft → Send proposal. Expect "Sent".
4. Run `npm run worker` (or wait for it) → open `.mail-sink/*.json`, copy the `/p/...` link (it uses the portal origin).
5. Open it in a private window (also on a phone-width viewport). Tick consent, enter a name, Accept. Expect the confirmation page; reopening the link says it is no longer available.
6. Staff: Proposals shows `accepted`; Contracts shows a draft. Open it → "Record completion" with evidence → you land on a new project; Contract page shows billing intentions (not invoices). Do it twice: still one project.
7. Project: change stage, request an asset, post one internal and one client-visible update.
8. Sign in at `http://portal.localhost:3000/login` as `client.a@example.test`: see only Harbour Bakery, only the client-visible update. `client.b@example.test` opening A's project URL gets a 404.
9. Sign in as `demo.delivery@example.test`: Proposals/new redirects to a "no access" page; Projects works.
10. Calendar: create an event, download "Add to calendar", cancel it (row stays, shows cancelled). Notes: create, edit in two tabs → second save reports a stale edit.

Hosts: `*.localhost` resolves to loopback in Chrome/Firefox; use `/etc/hosts` entries if your browser does not.
