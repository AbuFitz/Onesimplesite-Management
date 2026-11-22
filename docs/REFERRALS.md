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

## The model
- **ReferralLink**: one short code per company (their link: `portal.../r/CODE`).
- **Referral**: referrer company, referred company (unique), how it came in (`link` or `team`), status, and why it was flagged.
- **RewardEntry**: the ledger. Kinds: `earned` (referrer), `welcome` (referred company), `used` (credit spent, negative), `reversed` (negative).

## Status of a referral
`pending` (they're in our pipeline) → `qualified` (deposit paid, rewards added) or `review` (needs a look first) → `rejected` or `reversed`.

## Rules
1. **Self-referral is impossible**: the referrer and referred company can't be the same.
2. **Looks-the-same checks** (flag for review, never auto-reward): same contact email domain (ignoring free providers like gmail), same phone, same postcode, same website.
3. **Yearly cap** per referrer (default 10 rewarded referrals).
4. **Reward on deposit paid only.** Marking a deposit paid by bank transfer counts the same as card.
5. **Reverse** if the order is cancelled or the deposit refunded within the first 30 days (a person presses Reverse; it adds a negative entry and the audit log says who).
6. **Credit is shown to customers in the portal**, and used by the team against a payment with an exact amount and note.

## Defaults (editable under Referrals, owners only)
Referrer £50 credit. New company £50 credit. Cap 10 a year. Switched on.
