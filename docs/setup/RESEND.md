# Connecting email (Resend)

The app sends every email itself (login links, password resets, proposals, signing requests, confirmations).
It sends them straight after the action that triggers them, and a daily job retries anything that failed.
Until Resend is connected, emails are held in a queue (Team page → Email) and nothing is lost.

## One-time setup
1. Create a Resend account (resend.com) and open **Domains → Add domain** → `onesimplesite.co.uk`.
2. Resend shows DNS records. Add exactly those at GoDaddy (DNS settings for onesimplesite.co.uk).
   - Resend puts its sending records on a `send` subdomain, so they do not clash with your existing mail setup.
   - Do not change your existing MX or SPF records for normal mail.
3. Wait for the domain to show **Verified** in Resend.
4. **API Keys → Create** a key with "Sending access" for that domain. Copy it once.
5. In Vercel (project onesimplesite-management → Settings → Environment Variables) add `RESEND_API_KEY` = the key, for **Production**.
6. Redeploy the latest deployment. Open **Team** in Manage: the Email section should now say "0 waiting · 0 failed" and any queued emails go out.

## What is sent, and from where
| Email | From |
|---|---|
| Proposal, staff/client invitations, password reset, password changed | OneSimpleSite <hello@onesimplesite.co.uk> |
| Signing request, signing confirmation (with signed PDF), internal "contract signed" notice | OneSimpleSite Contracts <contracts@onesimplesite.co.uk> |

Replies go to hello@onesimplesite.co.uk. The internal notice goes to `INTERNAL_NOTICE_TO` (set to hello@).
The sending addresses must be on the verified domain; they do not need to be real mailboxes to send, but replies
need hello@ to exist.

## Checking it works
- Team page → invite yourself with a second email address of yours → the invitation should arrive within a minute.
- Sign-in page → "Forgot your password?" → the reset email should arrive and its link should land on the "Choose a new password" page.
- If something fails, Team → Email shows the error and a **Retry failed emails** button.
