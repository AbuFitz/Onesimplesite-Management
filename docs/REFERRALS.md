# Referrals: how it works and why

## What the research says (and what we took from it)
Sources: [Impact: fraud-proof referral programs](https://help.impact.com/brand/what-would-you-like-to-learn-about/advocate-program/protect-your-advocate-program/design-a-fraud-proof-referral-program), [Impact: B2B multi-objective referral](https://impact.com/referral/multi-objective-b2b-referral-program), [Referral service low-level design](https://www.techinterview.org/post/3233471608/lld-referral-service/), [Referral program LLD: attribution and disbursement](https://www.techinterview.org/post/3233468849/lld-referral-program/), [Extole on Stripe rewards](https://docs.extole.com/technical/partners/rewards-and-payments/stripe), [GrowSurf: credit vs coupon](https://growsurf.com/integration-guides/stripe-referral-credit-automation/), [Double-sided referral guide](https://www.voucherify.io/blog/how-to-launch-a-double-sided-referral-program), [Refferq (open source)](https://medevel.com/refferq/), [Refunded but rewarded (reward clawbacks)](https://arxiv.org/pdf/2604.16427).

| Finding | What we do |
|---|---|
| Pay on a real conversion, never a click. Most fraud disappears with this one rule. | Reward only when the referred company has **paid its deposit** (not when they sign, not when they click). |
| Double-sided rewards beat single-sided, and cost less than you think if you rebalance. | Both sides get a credit. Amounts are settings, with a yearly cap per referrer. |
| A UNIQUE constraint on the referred party is the most important correctness guarantee. | One referral per referred company, enforced in the database. |
| Milestones must be idempotent: triggering twice is a no-op. | One reward entry per (referral, company, kind), enforced in the database. Webhook replays change nothing. |
| Don't block sign-up on fraud checks. Store it, mark it for review, decide before paying. | Suspicious matches go to **Needs a look**; a person approves or rejects before any credit exists. |
| Keep an append-only ledger. Never edit a balance; add an entry. Reverse with a negative entry. | `RewardEntry` rows only ever get added. Balance = sum. Reversal is a new negative row. |
| Credit and coupon differ: a credit accumulates, a coupon is a one-time discount. | Credits accumulate in our ledger and the team applies them to the next payment (no Stripe coupon stacking problems). Stripe auto-application is a later step. |
| Small B2B programs live on word of mouth, so attribution is mostly manual. | Two ways in: the customer's **personal link**, and the team choosing **Referred by** when registering a company. |
| Open source options (Refferq, Weferral, Raider) are rarely production-ready and add upkeep. | Build the small core in our own database (3 tables) rather than run another product. |

## The model (v2)
- **Who sends work.** Customers (personal link, found in the portal) and **partners**: agencies or individuals with their own link and their own rate. A partner login can come later; a link is enough to start.
- **ReferralLink / Partner**: one short code each. Codes are unique across both, and a paused partner's link stops working.
- **Referral**: who sent them (a customer or a partner), the new company (unique), how it came in (`link` or `team`), status, and why it was flagged.
- **RewardEntry**: the cash ledger, append-only. `earned` (owed), `paid` (negative, a bank transfer we made), `reversed` (negative). What we owe = the sum.

## Rules
1. **Cash, not credit.** Customers and partners are both paid in cash by bank transfer. Payouts are recorded by hand (amount and reference); a payout can't exceed what is owed.
2. **When it is earned is a setting.** Default: when the website is **fully paid for** (final payment, or a one-off payment). Or when the **deposit** is paid. Never on a click or a signature.
3. **What the referrer gets.** Customer: a set amount (default £50). Partner: a set amount, or a **percentage of the signed website order**. A percentage with no signed order to work from goes to review.
4. **What the new company gets** is free months at the start of their monthly plan, by site type: **normal website: 1 month free hosting**, **online shop: 1 month free care plan** (both editable: months and wording). Added to their plan while it is still waiting to start.
5. **Lookalikes go to review**: self-referral, same email domain (free providers ignored), phone, postcode, website, or a partner and company sharing a domain. Over the yearly cap (customers) too. A person approves or rejects before anything is owed.
6. **Reverse** if the order is cancelled or refunded: a negative entry. If it was already paid out, the balance shows what they owe back.
7. **Idempotent**: replays and double clicks change nothing (database constraints, not just code).

## Defaults (Referrals → Rules, owners only)
Paid when the website is fully paid. Customer £50 cash, 10 a year. Website: 1 month free hosting. Online shop: 1 month free care plan.
