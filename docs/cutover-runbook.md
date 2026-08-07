# Cutover Runbook — Uscreen → New Platform

**Status:** draft, not yet walked through with the founder/team — do that before
relying on it for a real cutover. Written from what's actually built and verified
in this repo, not aspirationally. Every script/command named here exists and has
been run against production at least once except where marked otherwise.

**Golden rule:** members find out the new platform works **after** it's proven to
work, never before. Nothing here notifies a member until step 7.

## Before you start

- [ ] WS5 go-live already done (Bunny embed-token toggle flipped, signed playback
      verified in production — see project memory, this is a prerequisite, not
      part of this runbook).
- [ ] Stripe audit (`worker/stripe-audit.ts`) and `worker/adopt-subscriptions.ts`
      dry-run have been reviewed and look sane for the full cohort (not just the
      test batch).
- [ ] `docs/redirect-map.md` mechanism understood — you'll re-run
      `worker/build-redirect-map.mjs` fresh in step 3, not reuse an old report.
- [ ] Founder has done the founder-runbook.md checklist (DNS/SMTP/Supabase Pro/
      Stripe verification) — this runbook assumes all of that is already live.
- [ ] Re-test SMTP with a live email now, even if it was verified earlier —
      Brevo SMTP keys die after 90 days of no sending, so a key that worked at
      setup can be dead by cutover.
- [ ] Lower the DNS TTL on `albunyaan.tv`'s A/CNAME record at one.com to something
      short (e.g. 300s) at least 24-48h before cutover, so step 4's rollback (if
      needed) actually propagates fast. Long-TTL records make rollback slow.

## 1. Freeze

Announce internally (team, not members) that Uscreen-side changes stop:
no new video uploads, no manual member edits, no plan changes in Uscreen. The
point is that "final delta import" in step 2 is actually final — a change made
in Uscreen after that import silently doesn't exist on the new platform.

Keep the freeze window as short as practical — the plan's activation-wave
pacing means members won't all be on the new platform on day one anyway, but
the *data* needs to stop moving in Uscreen at a known point.

## 2. Final delta import

Re-run the same importers used throughout this project, pointed at fresh
exports triggered the same day as the freeze:

Run from the `worker/` directory (or `npm --prefix worker run ...` from the repo root)
— the CSV path is a positional argument, not a flag:

```
# People — idempotent, external_id-keyed, never clobbers stripe_customer_id/
# auth_user_id. Use import-people-csv, NOT import-people (that's an older
# script that feeds Uscreen's raw "Segment" column straight into
# subscriptions.status with no validation — now flagged SUPERSEDED in its
# own file header, kept only for history).
npx tsx import-people-csv.ts <path to fresh export>.csv

# Leads
npx tsx import-leads.ts <path to fresh export>.csv

# Adopt any subscriptions created/changed since the last adopt run
npx tsx adopt-subscriptions.ts --execute
npx tsx reconcile-stripe.ts --fix
```

Verify row counts against Uscreen's own dashboard totals before continuing —
don't just trust "0 errors" from the script (see the security-findings-report.md
note on silent-failure traps: a script that runs clean isn't the same as a
script that did the right thing).

## 3. Rebuild the redirect map fresh

```
node worker/build-redirect-map.mjs
```

This hits the *still-live* old site, so it must run during the freeze window
(step 1) — content-wise nothing should be moving, but this is the last moment
the old site is guaranteed queryable in its final state. Wire the resulting
`~/.albunyaan-cc/redirect-map-report.json` into `next.config.ts` (or
middleware — see `docs/redirect-map.md` for the tradeoff) plus the static-page
table from that same doc. Deploy this **as part of** the same release that
goes live in step 4, not before (redirects only make sense once this app
actually owns the domain) and not after (a gap where old URLs 404 instead of
redirecting is exactly the SEO/bookmark damage this exists to prevent).

## 4. DNS apex → the new platform goes live

Point `albunyaan.tv`'s A/CNAME at Vercel (per Vercel's domain-setup
instructions for the `albunyaan-web` project). This is the actual cutover
moment — do it once step 3's redirects are deployed and step 2's data is
confirmed in.

**Rollback, if anything looks wrong**: revert the DNS record back to
whatever it pointed at before (Uscreen). Because of the short TTL set in
"before you start," this should propagate within minutes, not the DNS
record's original TTL. Nothing about steps 1-3 is destructive to Uscreen
itself — Uscreen keeps running, keeps billing (if the Zapier zaps are still
on, see step 6), right up until you deliberately turn it off. A DNS revert
alone is a full, clean rollback.

## 5. Monitor before telling anyone

Watch, for at least a few hours (ideally 24h) before step 7:
- Vercel deployment logs / `/api/health`.
- Sentry (if wired — see the monitoring item in project memory, not yet set up
  as of this writing) or at minimum manual spot-checks of `/api/stripe/webhook`
  delivery success in the Stripe dashboard.
- `worker/reconcile-stripe.ts` (dry-run) for any drift between Stripe and
  entitlements now that live traffic is hitting the real webhook.
- A handful of real logins/checkouts/plays done by the team, not just automated
  checks — the e2e suites (`worker/e2e-*.ts`) cover the mechanics but not "does
  this feel right."

If something's broken, this is the point to roll back (step 4's DNS revert) —
**before** any member has been told to expect anything different, which is the
entire reason step 7 comes last.

## 6. Turn off the old payment/access bridge

Once you're confident (post step 5) and not rolling back:
- Switch off the 5 Zapier zaps (see `docs/founder-runbook.md` item H) — the new
  platform's own webhook has been doing this job in parallel since it went
  live, so this is just removing the now-redundant old path, not a functional
  change.
- Cancel the Zapier subscription (cost saving — nothing else uses it).
- Leave Uscreen itself running for a while longer — don't cancel that
  subscription until you're sure there's no reason to go back to it (a grace
  period, not an immediate cancellation).

## 7. Tell members — only now

Send the D-day email to all ~600 members (draft:
`docs/member-comms-cutover-draft.md` — **founder must review and approve the
actual copy before it goes out**, it hasn't been approved yet, this is a
starting point only). Activation pacing (50/day or whatever rate was agreed)
still applies for anyone who hasn't already been activated in earlier waves —
this email is for members who already have access, letting them know what
changed, not an activation trigger for everyone at once.

## 8. Wind-down (later, not day-of)

- IAP (Apple/Google) cohort: separate comms track, not covered by step 7's
  email (they don't have a Stripe subscription to carry over) — see the IAP
  voucher + "cancel your App Store subscription" plan in project memory.
  Not urgent day-of; can follow in the days after.
- Once confident the new platform is fully stable and nothing needs Uscreen as
  a fallback: cancel the Uscreen subscription, clear the flagged unpaid
  Uscreen invoice if still outstanding.
- Extend the retention window on old Uscreen data exports (CSVs etc.) per
  whatever the founder/accountant wants for records — don't delete anything
  Uscreen-side data-related immediately after cutover.

## What's NOT in this runbook yet

- Categories redirect map (25 items, not yet scripted — see `docs/redirect-map.md`).
- Monitoring setup (Sentry/UptimeRobot/Plausible) — not started, needs founder
  accounts.
- The actual member comms copy needs founder sign-off (see step 7).
- This runbook itself needs a real walkthrough with the founder/team before
  cutover — a document nobody has rehearsed is not the same as a tested plan.
