# Zapier Inventory — Albunyaan (captured 2026-07-12 via founder's Zapier)

Read directly from the founder's Zapier account (Farouq Kirchner / Personal folder).
Confirms the founder's "5 zaps" and the WS8 adopt-not-recreate architecture: **Stripe is
the payment source (trigger); Uscreen is only the access-granting action.** No zap
originates a charge — Zapier is pure glue between our own Stripe and Uscreen access.

## The 8 zaps (5 active, 3 inactive)

| # | Name | Status | Apps | Last run | Role |
|---|------|--------|------|----------|------|
| 1 | Sadaqah Jaariyah - MONTHLY \| ALB | **ON** | Stripe → Filter → Uscreen | 2 days ago | Grant (new-gen monthly) |
| 2 | Sadaqah Jaariyah - YEARLY \| ALB | **ON** | Stripe → Filter → Uscreen | 2 days ago | Grant (new-gen yearly) |
| 3 | Monthly Zap Albunyaan | **ON** | Stripe → Filter → Uscreen | 2 days ago | Grant (old-gen monthly) |
| 4 | Yearly Zap Albunyaan | **ON** | Stripe → Filter → Uscreen | 2 days ago | Grant (old-gen yearly) |
| 5 | SUBcancel | **ON** | Stripe → Filter → **Code** | 13 hours ago | Cancellation / revoke |
| 6 | NEW - Yearly Zap Albunyaan | OFF (disabled draft) | Stripe → Filter → Uscreen | never | Superseded draft |
| 7 | TrialMonthly | OFF | Stripe → Filter → Uscreen | never | Trials (0 trials exist) |
| 8 | TrialYearly | OFF | Stripe → Filter → Uscreen | never | Trials (0 trials exist) |

The **5 active** zaps = exactly what the founder described: 2 monthly + 2 yearly grant-zaps
(an "old" generation — *Monthly/Yearly Zap Albunyaan* — and a "new" generation — *Sadaqah
Jaariyah MONTHLY/YEARLY*) + 1 **SUBcancel**. The 3 off zaps are a superseded yearly draft
and the two Trial zaps (idle — recon confirmed 0 trials).

## Grant-zap flow (read from "Sadaqah Jaariyah - MONTHLY", zap 312805391)

4 steps:
1. **Trigger — Stripe: New Payment** (instant/webhook trigger)
2. **Stripe: Find Subscription** (looks up the subscription behind the payment)
3. **Filter by Zapier — "Only continue if":**
   - `Status` exactly matches `succeeded` **AND**
   - `Amount` exactly matches one of `6.5 | 30 | 25 | 150 | 69000` (the plan's price across
     variants/currencies — €6.50 monthly is the `6.5`) **AND**
   - `Description` exactly matches `Subscription creation`
     → **grants on NEW subscription only, not renewals.**
4. **Action — Uscreen: Assign User Access** (grants the member access in Uscreen)

The yearly/old-gen grant zaps are the same shape with different amount-filter values.

## SUBcancel (zap 186659659)

Stripe (trigger) → Filter → **Code by Zapier** (not a native Uscreen action). The Code step
is almost certainly a script calling Uscreen's API to revoke access — Uscreen has no native
Zapier "revoke access" action, so a Code step fills the gap. (Not opened line-by-line; the
app icons + the manual-cancel workflow the founder described make this unambiguous.)

## What this means for the migration (WS8)

- **Fully confirms the adopt-not-recreate plan** (`another-important-note-or-proud-kernighan.md`):
  the Stripe subscriptions are ours, created by our own flow; Zapier only mirrors access into
  Uscreen. On the new platform, our own Stripe webhook does step 4's job directly.
- The grant filter's **amount set** `{6.5, 30, 25, 150, 69000}` is real data for the
  `stripe-audit.ts` price-bucket rollup — expect roughly these distinct price points among live
  subscriptions. (Note these look like mixed-currency/legacy values; the audit's per-Price
  rollup will resolve them to actual Stripe Price IDs.)
- The **"Subscription creation" only** condition means renewals were never re-granted via
  Zapier (access persists in Uscreen once granted) — consistent with a one-time grant model.

## Cutover plan (unchanged, now evidence-backed)

Keep all 5 active zaps running until cutover (Stripe fans events to both Zapier and our new
webhook simultaneously — no conflict). At cutover: switch the 5 off, then cancel Zapier. The
3 inactive zaps need no action.

⚠️ One "Has Draft" marker sits on the Sadaqah-MONTHLY zap — a pre-existing unpublished draft
of the founder's, untouched. Not relevant to cutover.
