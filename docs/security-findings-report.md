# Security Findings Report — Auth, Billing & Catalog Review

**Status:** 15 of 16 confirmed findings fixed and verified; 1 low-severity item and several completeness gaps remain open (listed at the end). Data as of 2026-07-12, cross-checked against the current `exit-phase` branch (`83303d8`) and live production config.
**Scope reviewed:** commits `2e94923` (WS3 member auth + household isolation) and `2d3861d` (WS4 Stripe billing + WS9 search + WS5a XSS/headers), plus the WS1 catalog-visibility work (`cfcddad`).
**Method:** 6 independent hostile-reviewer agents, each assigned one dimension (auth-flow, household-isolation, stripe-billing, webhook-eventing, xss-headers, search-datalayer), surfaced 21 raw findings. Each finding then went through an adversarial verification pass (a separate agent instructed to try to refute it) before being counted as confirmed. 19 survived verification; 2 were refuted. A final completeness-critic pass flagged 8 gaps — things no dimension checked at all, not findings against specific code.

## Summary

| Severity | Raw confirmed | Distinct issues* | Fixed | Open |
|---|---|---|---|---|
| High | 4 | 4 | 4 | 0 |
| Medium | 8 | 6 | 6 | 0 |
| Low | 7 | 6 | 5 | 1 |
| **Total** | **19** | **16** | **15** | **1** |

\* Three pairs were the same underlying bug independently surfaced by two dimension reviewers (PIN rate-limiting; the `past_due` grace-window bug; the concurrent-webhook stale-snapshot race) — each pair collapses to one distinct issue below.

Plus: **2 refuted** (judged not real/not exploitable — see below) and **8 completeness gaps** (see "Open & deferred").

---

## Fixed findings

### Auth & household isolation

| # | Severity | Finding | File | Fix |
|---|---|---|---|---|
| 1 | Medium | Login form returned a distinct message for unknown emails, letting anyone enumerate which of the ~600 migrating members have accounts | `auth/actions.ts:49` | `cd664b7` — unknown-email case now returns the same "sent" response as a real send |
| 2 | Low | `safeNext()`'s open-redirect guard checked for a leading `/` and rejected `//`, but not a leading `/\` — browsers normalize `\`→`/`, turning `/\evil.com` into an off-site redirect | `auth/actions.ts:23` | `cd664b7` — now rejects backslashes and control characters too |
| 3 | Medium | Parent PIN (4 digits, 10,000 possible values) had no rate limiting — an authenticated member's session could brute-force any household's PIN in minutes | `app/actions.ts:64` | `813c5dd` — 5-attempt / 15-minute lockout via a row-locking Postgres RPC (`reserve_pin_attempt`, migration `0009`). Verified: 8 concurrent guesses get exactly 5 real tries, not 8 — closes the serverless read-check-write race an app-level counter would have left open |
| 4 | Medium | A kid could tap the adult avatar on `/profiles` and switch straight into the unrestricted adult profile — zero PIN check on profile switching, voiding every parental block with two clicks | `app/actions.ts:38` | `cd664b7` — switching into an adult profile now requires `isParentUnlocked()` first when the household has a PIN set |
| 5 | Low | The `albn_parent` unlock cookie was just the bare household UUID — no signature, no server-side expiry. `httpOnly` stops reading it from JS, not setting one via devtools, so anyone who once observed the value could re-mint an unlock forever | `lib/session.ts:86` | `c71d53f` — cookie is now `<householdId>.<expiry>.<hmac>`, HMAC-signed with a key derived from the service-role key (no new secret to provision), expiry enforced server-side. Verified: the old bare-id format is provably rejected, tampering with any segment breaks the signature |
| 6 | Low | `hashPin` was a single unsalted SHA-256 of the 4-digit PIN — a 10,000-entry precomputed table inverts any leaked hash instantly, and identical PINs hash identically across every household | `parental.ts:23` | `813c5dd` — salted scrypt (`scrypt$<salt>$<hash>`, random salt per hash). Legacy SHA-256 hashes still verify and are transparently upgraded to scrypt on the next successful unlock — no forced PIN reset for existing households |

### Stripe billing & webhooks

| # | Severity | Finding | File | Fix |
|---|---|---|---|---|
| 7 | High | `checkoutAction` had no guard against a member buying a second subscription — anyone with an active entitlement (bookmark, back-button, second tab) or a still-billing Uscreen subscription could complete Stripe checkout and pay twice | `join/actions.ts:17` | `f81a7cc` — checkout blocked when `hasActiveEntitlement()` is true or the member's `legacy_cohort` marks them as still paying Uscreen |
| 8 | Medium | A Stripe webhook event that got recorded (`status: 'stored'`) but crashed before being applied was permanently stuck: every retry hit the duplicate-event short-circuit and got ACKed with 200, so Stripe stopped retrying and the entitlement change was never applied | `stripe-apply.ts:87` | `f81a7cc` — duplicate path now re-reads the stored row's status and re-applies if it's `stored` or `failed`, only short-circuiting on `processed` |
| 9 | Medium | `past_due` grace was measured against `current_period_end`, but Stripe advances that field to the end of the *new, unpaid* period on a failed renewal — so the intended 14-day grace window could silently become up to a year of free access on an annual plan | `entitlements.ts:53` | `f81a7cc` — `current_period_end` now anchors to the last **paid** period end; a failed renewal can no longer extend it. Verified by a new test (`b2`) that a `past_due` snapshot does not advance the anchor into the unpaid period |
| 10 | High | Transiently-failed revoke events (`customer.subscription.deleted` hitting a rate limit or 5xx mid-apply) were ACKed 200 and never replayed by anything — a canceled member could keep access indefinitely | `stripe-apply.ts:100` | `f81a7cc` — transient failures now return 5xx so Stripe retries with backoff; combined with fix #8, a redelivered event re-applies instead of being silently dropped |
| 11 | Medium | No handling for `charge.dispute.*` — a member could file a bank chargeback and keep full access with no revocation and no alert, since the event type wasn't even subscribed to | (not handled) | `f81a7cc` — `charge.dispute.created` / `charge.dispute.funds_withdrawn` now handled and logged |
| 12 | Low | CSP `form-action` allowed `checkout.stripe.com` but not `billing.stripe.com` — the "Manage billing" portal redirect would be blocked by Chrome if the form submitted without JS (slow hydration, JS error) | `next.config.ts:27` | `f81a7cc` — `billing.stripe.com` added to `form-action` |

### Catalog & search data leaks

| # | Severity | Finding | File | Fix |
|---|---|---|---|---|
| 13 | High | `searchCatalog`'s series query had no status filter on embedded episodes — a series that was 100% draft still appeared in search results, with a draft video as its cover image, and its `/programs/[slug]` page listed every draft episode with working links. A public, unauthenticated path into the entire draft catalog | `search.ts:55` | `cfcddad` — episodes filtered to `published`/`live` before computing cover/count; fully-draft series are dropped entirely |
| 14 | High | Every catalog data-layer function ran on the service-role client, which bypasses the RLS visibility policy, and none of them re-applied the filter in code — a draft video's full page (title, description, and eventually the player) rendered for anyone who found its slug | `catalog.ts:191` | `cfcddad` — `VISIBLE_STATUSES` filter applied at every read path (`getVideoBySlug`, `getCollectionBySlug`, `getCatalogRows`, `getCategoryRows`, `getCategoryBySlug`) |
| 15 | Low | `escapeLikePattern` escaped `\`, `%`, `_` but not `*` — PostgREST silently rewrites a literal `*` to `%` in `ilike` filters *before* the query runs, so a query like `**` matched the entire table (capped at 30 rows, but semantics-changing, and it amplified finding #13's draft-series exposure) | `search.ts:24` | `cfcddad` — `*` is neutralized (replaced with a space) before the SQL-metacharacter escaping runs |

## Refuted findings

Two raw findings did not survive adversarial verification:

- **First-checkout customer-create race** (`join/actions.ts`) — the mechanical facts were accurate (`setPersonStripeCustomerId` is an unconditional update with no `IS NULL` guard, `stripe.customers.create` has no idempotency key, and the checkout button has no pending-state guard), but the verifier judged the triggering scenario — a genuine double-click race actually reaching production impact — implausible enough at current traffic to not count as confirmed. Worth revisiting if checkout volume grows.
- **CSP `script-src 'unsafe-inline'`** — flagged as weakening the XSS backstop where a nonce-based policy would be achievable. Refuted on the grounds that the app's one `dangerouslySetInnerHTML` call (rendering video descriptions) already runs through a strict `sanitize-html` allowlist with no `style`/`class`/`id` attributes permitted, so there's no concrete injection path today that `unsafe-inline` removal would additionally block.

## Open & deferred

One confirmed finding and several completeness-review gaps remain — verified still-open against the current code as of this report, not carried over from stale notes:

- **Low — no ordering guard between concurrent webhook deliveries.** Two Stripe events for the same subscription can be processed in parallel; the older one's write can land after the newer one's, resurrecting canceled access for a short window until a manual reconcile run. No advisory lock or snapshot-timestamp guard exists yet in `stripe-apply.ts`. Lower priority than the fixed items — the window is sub-second and self-heals on the next event — but should be closed before scale makes concurrent delivery routine.
- **Highest-priority gap — unsigned public video embeds.** `VideoPlayer.tsx` renders a public, unsigned Bunny iframe embed whenever `bunny_video_id` is set, with **no entitlement or `video.access` check anywhere in the render path**. `hasActiveEntitlement()` is only ever called for display on the account page — nothing gates playback. Today, with 197/197 published VOD already on Bunny, any anonymous visitor can watch every migrated paid video, and the real embed GUID ships in page source. This is exactly the next piece of work (**WS5 signed playback**) and should be treated as blocking before anything is demoed or launched publicly.
- **`worker/reconcile-stripe.ts` is unscheduled.** It's the assumed backstop for dropped webhook events, but no cron/LaunchAgent runs it, and it can't run at all yet without a live Stripe key (blocked on founder verification, runbook step D). The webhook-level fix (finding #10) now covers the specific dropped-revoke case it was meant to backstop, but reconcile should still be scheduled once a key exists.
- **`changeEmailAction` — rate limit added, re-authentication was not.** The 10-minute cooldown (`c71d53f`) stops a stolen session from email-bombing arbitrary addresses, but the action still doesn't require re-proving identity (e.g. a fresh magic-link click) before accepting a change request. The Supabase "secure email change" double-confirm (send-to-both-addresses) remains the primary defense against a stolen-session takeover completing silently — that setting must stay on (see founder runbook, step C.3).
- **`README.env.md`'s operational instructions are stale.** Re-checked this pass: the webhook-registration instructions still show the Vercel Protection-Bypass token embedded as a URL query parameter (Vercel's own guidance prefers the header form — a URL-embedded long-lived secret ends up in Stripe's delivery logs), and the events-to-subscribe list still doesn't mention `charge.dispute.*` even though the code now handles it (finding #11) — so a webhook endpoint registered by following this doc literally would never actually deliver those events. Needs a doc fix, not a code fix.
- **`worker/stripe-setup.ts` doesn't assert prices match at checkout time.** Confirmed still absent this pass: nothing in `checkoutAction` verifies that the live Stripe price's `unit_amount` matches `plans.amount_cents` before creating a session — a manually-edited price in the Stripe dashboard would silently change what `/join` charges. Noted as a deferred follow-up, not yet scheduled.
- **Cloud auth dashboard config was stock-default.** This is what motivated [founder-runbook.md](./founder-runbook.md) — no custom SMTP, default (SafeLinks-burnable) email templates, `Site URL` still `localhost:3000`, empty redirect allowlist, and a 2-email/hour rate limit that would take ~300 hours to activate the full migrating cohort. All still true as of this report; see the runbook for the fix sequence.
- **Dependency audit** — run during the original review: clean except one moderate advisory in a build-time-only transitive dependency (`postcss`, pulled in by Next.js). Not independently re-run for this report.
