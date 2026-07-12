---
name: albunyaan-platform-replacement-campaign
description: >
  THE campaign plan for the Uscreen exit — load when a session asks "what's left
  before we can cancel Uscreen?", "what's the next phase?", "are we done?",
  "plan the cutover", "can we go live / deploy publicly?", "migrate the members",
  "switch DNS", "cancel Uscreen", or needs the completeness inventory of
  everything the new platform must replace. Defines the decision-gated phases
  (finish video bodies, playback lockdown, auth/SMTP, payments adoption, live
  channels, deploy, DNS cutover, cancellation criteria) with exact commands and
  measurable gates. NOT for operating/debugging the migration pipeline itself
  (albunyaan-migration-runbook / albunyaan-migration-debugging-playbook) or for
  making code changes (albunyaan-change-control first).
---

# Albunyaan platform replacement campaign — the road to cancelling Uscreen

**Mission (owner's words, 2026-07-12):** not just a video transfer — a **complete, fully
functioning replacement of the entire Uscreen platform** (database, apps, site, front and
back end), *improved* rather than cloned, so Uscreen can be cancelled **with nothing
forgotten**. Completeness is the challenge. "Better than Uscreen" means: own platform, no
platform fees (Uscreen contract ≈ $2,751/mo + $0.99/user ≈ $3,358/mo per the contract read
of 2026-07-05), faster catalog, own push/email stack, manhaj-gated content governance,
measurably better for viewers.

**Read `/Users/a2020/projects/albunyaan-platform/CLAUDE.md` first, always.** This skill
never overrides it. Every phase promotion below routes through
`albunyaan-change-control` — this skill tells you *what* and *when*; that one tells you
*whether you may* and *who signs off*.

## When NOT to use this skill

| You actually want | Use instead |
|---|---|
| Start/resume/pause/monitor the video migration | `albunyaan-migration-runbook` (or `/migration-status`) |
| Debug a stuck or failing migration | `albunyaan-migration-debugging-playbook` |
| Edit pipeline/watchdog/RLS/worker code, commit, send anything | `albunyaan-change-control` (mandatory gate) |
| The three-location layout, repo map | `albunyaan-architecture-contract` |
| Tables, columns, counts semantics | `albunyaan-data-and-schema-reference` |
| Scraper mechanics / Bunny API details | `uscreen-scraping-reference` / `bunny-operations` |
| LaunchAgents, meters, backups, report scripts | `albunyaan-ops-and-automations` |
| Verifying counts / QA method | `albunyaan-validation-and-qa` |
| Historical incidents in full | `albunyaan-failure-archaeology` |
| pnpm / env / dev server setup | `albunyaan-build-and-env` |

## Vocabulary (defined once)

- **Uscreen** — the hosted OTT platform (app.uscreen.tv) currently serving albunyaan.tv; the thing being replaced.
- **Bunny** — Bunny.net Stream, the new video host (library keys in `~/.albunyaan-cc/cloud.env` — reference secrets by NAME only, never read/quote env files).
- **Cutover** — the moment DNS for `albunyaan.tv` points at the new platform and members use it.
- **Founder** — the human owner; only source of sign-off; only person who can restart the orchestrator (shared browser login) or do dashboard/DNS/identity steps.
- **Orchestrator** — `~/.albunyaan-cc/migrate-overnight.sh`, the harvest→transfer loop moving video files.
- **Twin Chrome** — Chrome for Testing on CDP port 9333, profile `~/.albunyaan-cc/chrome-emdb-clone`, carrying the founder's Uscreen admin session.
- **Published tier** — the ≈197 videos the live site actually serves (the published *unit* is COLLECTIONS, ~692 — not videos).
- **WS-N** — workstream-numbered commits (WS0–WS10) on branch `exit-phase`; see `git log --oneline`.

---

## Phase 0 — status snapshot (as of 2026-07-12) and how to re-take it

Take this snapshot at the start of ANY campaign session. Never plan from memory.

| Item | State 2026-07-12 | Re-verify with |
|---|---|---|
| Video bodies on Bunny | **1,584 / 15,861** (+468 on 07-11) | `~/.albunyaan-cc/morning-report-<today>.txt`, or the count query below |
| Published tier | **197/197 DONE** — everything the live site serves is on Bunny | same morning report |
| Structure/enum/covers imports | DONE (15,861 videos, 686 collections, 25 categories, covers 686/686) | `/migration-status` |
| Orchestrator | **DOWN** since 2026-07-11 ~23:12 (founder: "dont run them tonight"). Watchdog logs `ORCHESTRATOR DOWN … needs manual restart` every 5 min — by design it NEVER auto-restarts (shared browser session needs a human) | `tail -3 ~/.albunyaan-cc/watchdog.log` |
| Metered bundle | 400GB bundle; meter read **34GB** at 18:49. WARN at 200GB, AUTO-PAUSE at 250GB (`bundle-meter.sh`: `WARN_GB=200`, `STOP_GB=250`, `PREUSED_GB=30`) | `tail -1 ~/.albunyaan-cc/bundle-usage.log`; flags `~/.albunyaan-cc/BUNDLE-WARN` / `BUNDLE-ALERT` |
| Repo | branch `exit-phase`, HEAD `5c0bed9` (WS7 admin security). Working tree has UNCOMMITTED in-flight admin-CMS screens (`apps/web/app/admin/{members,videos,vouchers}/`, `worker/e2e-admin-crud.ts`) — another session's work; leave alone | `git -C ~/projects/albunyaan-platform status --short` |
| Nightly catalog backup | LaunchAgent `com.albunyaan.catalog-backup` 03:30, last verified `2026-07-12_0330 (videos=15861)` | morning report "Backup:" line |
| Live site (Uscreen) | `albunyaan.tv=200` — still serving members; keep it healthy until cutover | morning report "Site:" line |

Canonical count query (PostgREST; **REST clamps pages to 1000 rows — never trust an
un-counted read**):

```bash
set -a; source ~/.albunyaan-cc/cloud.env; set +a   # sourcing (executing) is allowed/required; READING the file (cat/echo values) is what's forbidden
curl -s "$SUPABASE_URL/rest/v1/videos?select=id&bunny_video_id=not.is.null" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Prefer: count=exact" -H "Range: 0-0" -D - -o /dev/null | grep -i content-range
# → "content-range: 0-0/<N>" — N is the migrated count. Same pattern for any table/filter.
# denominators (15,861 total / 197 published) go stale — self-check via the same pattern
# minus the bunny filter: albunyaan-validation-and-qa §1 (single home)
```

Discrepancy to know about: `CLAUDE.md` says "425 people"; `docs/founder-runbook.md`
(2026-07-12) records **2,926 people rows** imported from the People CSV (commit
`e25c3c2`). The 425 was the earlier subscriber-only count. Count `people` yourself when it
matters; trust the query, not either doc.

---

## The completeness inventory — "nothing forgotten"

Every capability Uscreen provides today, its replacement, and where it lands. Derived
from `docs/founder-runbook.md`, `docs/security-findings-report.md`, WS commits, and the
program plan (`~/Funnel-Albunyaan-Upgrade/docs/platform-program-plan.md`). If you find a
capability not on this list, that IS a campaign finding — add it via change control.

| # | Capability | Replacement | State 2026-07-12 | Phase |
|---|---|---|---|---|
| 1 | Catalog metadata (videos/collections/categories/people) | Supabase, imported + nightly backup | **DONE**, verified counts | — |
| 2 | Posters + series covers | Mirrored to own storage (`posters` bucket) | **DONE** (686/686 covers) | — |
| 3 | Video files | Bunny Stream via migrate-videos.ts | **~10%** (1,584/15,861; published tier 100%) | 1 |
| 4 | Playback gating (paid content) | Entitlement gate + signed Bunny embeds (WS5 `9a3ea3e`) | Code DONE (entitlement gate live in the render path); **Bunny library flip UNVERIFIED — raw embed/CDN URLs may play outside the app** (top open security question; status home: architecture-contract §6 item 1) | 2 |
| 5 | Member auth | Supabase magic links (WS3), scanner-proof templates in `supabase/templates/` | Code DONE + hardened; **cloud SMTP/templates/rate-limit still stock defaults** | 3 |
| 6 | RLS / data security | Migrations 0006 (first policies) + 0007/0009/0010; `worker/verify-rls.ts` harness | Code landed; migrations 0001–0010 verified applied to cloud 2026-07-12 (see Phase 3); CLAUDE.md gate stands: real policies + auth verified before ANY public deploy | 3 |
| 7 | Billing / subscriptions | Own Stripe + webhook engine (WS4), **adopt-not-recreate** (WS8 `a2e7fbf`) | Engine DONE (30/30 tests); adoption BLOCKED on founder Stripe identity verification (runbook D) | 4 |
| 8 | Payment→access bridge | Own Stripe webhook replaces the 5 Zapier zaps | Zaps stay ON until cutover (runbook H, resolved); own endpoint not yet registered | 4 |
| 9 | Live TV channels (29, incl. top-watched content) | `infra/live-relay/` VPS relay kit (WS6) | Kit built + locally tested; needs VPS + IPTV source URLs (runbook E) + **Bunny Stream Live availability UNVERIFIED** | 5 |
| 10 | Admin CMS | `/admin` route group; WS7 roster gate + mandatory TOTP | Gate DONE; screens (members/videos/vouchers) in-flight, uncommitted | 6 |
| 11 | Transactional email | Resend SMTP via Supabase Auth | BLOCKED on founder DNS records (runbook A→B→C) | 3 |
| 12 | Marketing email / push | Brevo drafts + Uscreen push (both fail-closed, manhaj-gated, draft-only) | Running; post-cutover push replacement is **OPEN** (current sender pushes via Uscreen) | 6/9 |
| 13 | Leads | `worker/import-leads.ts` | Import code exists; **Leads CSV export not yet triggered** (runbook G) | 6 |
| 14 | Search + SEO SSR catalog | WS9 SSR search, schema.org catalog | DONE code-side (draft-leak findings fixed `cfcddad`) | — |
| 15 | Parental controls / households | WS3 + PIN hardening (0009) | DONE + security-verified (beyond Uscreen — differentiator) | — |
| 16 | Legal pages | WS10 drafts (`b812493`), Dutch+EN, GDPR-corrected | DRAFTS — founder review pending | 7 |
| 17 | i18n titles (EN/NL live in Weglot) | Weglot TM export → `content_translations` | **OPEN** — founder has manual translations only in Weglot; export before Weglot is switched off | 7 |
| 18 | Domain / DNS | one.com DNS → Vercel | Not started (Site URL still `localhost:3000` in cloud auth) | 7 |
| 19 | Mobile + TV apps | Expo / react-native-tvos (program plan Ph7–8) | NOT STARTED (Apple agreement accepted — unblocked) | 9 |
| 20 | Offline/bulk downloads (differentiator) | Program plan feature-plus | NOT STARTED | 9 |
| 21 | Analytics | command-center scrapers now; first-party SQL later | Scrapers running; repoint post-cutover | 9 |

---

## Campaign phases

Dependency shape: Phase 1 runs continuously in the background. Phases 2–6 are largely
parallel (3→4 ordering inside founder steps). Phase 7 requires 2,3,4,5 green. Phase 8
requires everything. Never reorder a founder-sequenced chain (runbook A→B→C).

### Phase 1 — finish the video bodies within bundle budget

The published tier is done, so the live site's content is safe. What remains is the long
tail: **14,277 videos** (15,861 − 1,584). Measured library ≈ 2,772 hrs ≈ **2.63TB @720p /
4.79TB @1080p**; on the metered line every video costs **~2× its size** (Mux download +
Bunny upload). One 400GB bundle ≈ 200GB of video ≈ **650–850 short videos** (measured
estimate 2026-07-11; 80% of pending are <15 min ≈ 150–300MB each). Finishing the whole
library locally ⇒ roughly 5–10TB of metered traffic ⇒ **13–24 bundles — not viable as the
only path**.

Solution menu, ranked (all promotion via change control + founder):

1. **Cloud transfer VPS (candidate, founder-deferred 2026-07-11: "definitely also a good
   one, after today probably")** — a ~€6/mo Hetzner-class box runs the `--transfer` side
   (needs only node+tsx+ffmpeg+curl + the cloud.env variable names); harvest stays local
   (browser session cannot leave the Mac). Days instead of a month, zero bundle burn.
   UNPROVEN — nothing is built; treat as a proposal to the founder, not a plan already in
   motion.
2. **Continue local, smallest-first, inside bundle budget** — works today; the ordering is
   already in code (`migrate-videos.ts` orders `duration_seconds` ascending in both harvest
   and transfer). Expect ~150–250 videos/day when running. Giants sink to the queue tail —
   deliberately NOT excluded; do not "optimize" them out.
3. **Opportunistic unmetered window** — if the founder's connectivity changes, run 24/7.

To resume the migration (the standard 3 steps — full detail in
`albunyaan-migration-runbook`; founder must confirm the Uscreen login):

```bash
# 1. Twin Chrome (check first — it may still be running). If down, launch per
#    albunyaan-build-and-env §7 (the single home for the launch command — it
#    resolves the chromium-* path drift), then verify:
curl -s --max-time 3 http://127.0.0.1:9333/json/version | head -1   # non-empty JSON = up
# 2. Keep-awake:
caffeinate -i -s -m -d -t 43200 &
# 3. Orchestrator:
nohup bash ~/.albunyaan-cc/migrate-overnight.sh >> ~/.albunyaan-cc/migrate-overnight-outer.log 2>&1 &
```

**Gate to close Phase 1:** `bunny_video_id not null` count = 15,861 minus a
founder-reviewed exclusion list (`export_manifest` rows with status `skip_no_hls` —
permanently stream-less videos, two-strike rule; plus the `status='live'` channels which
have no file by definition). NOTE (2026-07-12): `skip_no_hls` writes persist since
migration 0011 + commit `da5cced` (fixed 2026-07-12), but with no backfill the count
reads **0** until future harvest runs re-accumulate two-strike state — prior stream-less
candidates still sit at `failed`/`no_hls`; see `albunyaan-data-and-schema-reference`,
RESOLVED mismatch section. Export that skip list, show it to the founder, get an explicit
"these N are accepted losses" before calling the phase done.
**If you see instead:** count stalls with orchestrator up → `albunyaan-migration-debugging-playbook`.
Bundle meter ≥200GB → founder decision, do not raise `STOP_GB` yourself.
`BUNDLE-ALERT` flag exists → migration was auto-paused; founder decides; delete flags only on his word.

### Phase 2 — playback lockdown flip (WS5 completion) — DO THIS BEFORE ANY DEMO/DEPLOY

Entitlement gating is LIVE in the render path (WS5 `9a3ea3e`): program pages render
the `Paywall` branch instead of the player when the viewer lacks access, so the app
itself no longer serves paid embeds to anonymous visitors (the security report's
pre-WS5 "anyone can watch" finding is fixed code-side). The remaining exposure is the
**raw embed/CDN URL outside the app** while the Bunny library flip (Embed View Token
Authentication + Block Direct URL Access) is **UNVERIFIED** — the current lockdown
posture has ONE home: `albunyaan-architecture-contract` §6 item 1 (and §4.2); check it
there, update it there. Signing shipped in `apps/web/lib/bunny-embed.ts`
(`token = SHA256_HEX(key + videoId + expires)`, TTL 6h, key `BUNNY_EMBED_TOKEN_KEY`
server-only; unsigned URLs emitted while the key is unset).

Sequence (exact acceptance harness exists — use it, never judge by eye):

```bash
set -a; source ~/.albunyaan-cc/cloud.env; set +a
cd ~/projects/albunyaan-platform
# 1. Baseline BEFORE the flip — proves the three URLs are the right ones (all should OPEN):
worker/node_modules/.bin/tsx worker/verify-playback-lockdown.ts     # MODE=pre is default (no node_modules/.bin at repo root — tsx lives under worker/)
# 2. Founder/dashboard: Bunny library → enable "Embed View Token Authentication"
#    + "Block Direct URL Access"; put the library's token-auth key into the
#    app env as BUNNY_EMBED_TOKEN_KEY (server-only — NEVER NEXT_PUBLIC_).
# 3. Acceptance:
MODE=post worker/node_modules/.bin/tsx worker/verify-playback-lockdown.ts
```

**Gate:** MODE=post passes — unsigned embed AND direct CDN `playlist.m3u8` are blocked,
signed embed still loads.
**If unsigned still opens** → the library flip didn't take (silent-failure trap: read back
dashboard state, don't trust the click). **If signed is also blocked** → key mismatch
between the dashboard token-auth key and `BUNNY_EMBED_TOKEN_KEY`; fix env, don't touch the
signing code. **If the app emits unsigned URLs after the flip** → `BUNNY_EMBED_TOKEN_KEY`
missing in that environment; by design that fails visibly (embed refuses to load), never
silently open.

### Phase 3 — auth, email and RLS hardening (founder runbook A→B→C + verification)

The cloud project runs on **stock Supabase Auth defaults** (no custom SMTP, default
templates, Site URL `localhost:3000`, **2 emails/hour** rate limit — activating ~600
migrating members at that rate ≈ 300 hours). Nothing errors anywhere; it only breaks when
real members try to log in. `docs/founder-runbook.md` is the authoritative sequence:

- **A.** Founder adds 3 DNS records at one.com (Resend, subdomains only — root records untouched).
- **B.** Verify domain in Resend → flip Supabase to Resend SMTP (`smtp.resend.com`, password = `RESEND_API_KEY` from `~/.albunyaan-cc/resend.env` — dashboard field only).
- **C.** Paste `supabase/templates/magic_link.html` + `email_change.html` into the dashboard (it does NOT read the repo), keep "Secure email change" ON, set Site URL + redirect URLs to the production domain, raise the email rate limit — only after B.

Engineering verification once C is done (and again before Phase 7):

```bash
set -a; source ~/.albunyaan-cc/cloud.env; set +a
cd ~/projects/albunyaan-platform
worker/node_modules/.bin/tsx worker/verify-rls.ts --no-members   # drop --no-members once test users exist
worker/node_modules/.bin/tsx worker/e2e-member-auth.ts
worker/node_modules/.bin/tsx worker/e2e-admin-gate.ts            # WS7 roster + TOTP gate
```

**Gate:** verify-rls exits 0 (anon sees only published/live and safe columns; closed
tables return zero rows; member A cannot read member B); e2e scripts pass; a real test
magic-link email lands via Resend.
**VERIFIED 2026-07-12:** migrations 0001–0010 are ALL applied to the CLOUD project —
probed live: `entitlements` (0004) and `billing_migration_batches` (0008) answer,
the `reserve_pin_attempt(uuid)` RPC (0009) executes, and
`people.email_change_requested_at` (0010) selects. `albunyaan-data-and-schema-reference`
records the same (same verification date) and is the schema ground truth.
**Hard rule from CLAUDE.md, restated:** service-role-only data layer is BY DESIGN until
real policies + auth are verified — no public deploy before this phase is green.

### Phase 4 — payments: adopt, don't recreate (WS8)

The web cohort already pays on the foundation's OWN Stripe account (Scenario A, confirmed
2026-07-05). Migration = **adoption**: read live subscriptions, upsert entitlements via
the same `applySubscriptionSnapshot()` the webhook uses. **Never the cancel-and-recreate
dance.** Blocked on founder runbook **D** (Stripe identity verification → restricted READ
key into `~/.albunyaan-cc/stripe.env` as `STRIPE_SECRET_KEY`).

```bash
set -a; . ~/.albunyaan-cc/stripe.env; . ~/.albunyaan-cc/cloud.env; set +a
cd ~/projects/albunyaan-platform
# 1. Forensic audit (READ-ONLY; --backfill is its only write: people.stripe_customer_id, unique email matches only)
worker/node_modules/.bin/tsx worker/stripe-audit.ts --backfill
# 2. Adoption — DRY-RUN BY DEFAULT; report → ~/.albunyaan-cc/adopt-subscriptions-report.json
worker/node_modules/.bin/tsx worker/adopt-subscriptions.ts --limit 10
# 3. Review verdicts with founder, then:
worker/node_modules/.bin/tsx worker/adopt-subscriptions.ts --execute --cohort uscreen_paying
```

**Expected observations:** audit verdict buckets (`migratable_no_reentry` /
`needs_remandate` / `no_customer`) — expect on the order of ~306 paying (program plan;
verify against the report, not this doc). Adoption INVARIANT: it never writes to Stripe
(subscriptions.list only). **If the audit shows mostly `no_customer`** → email matching
failed or Scenario A assumption is wrong — STOP, founder + stronger model.

Then: register the platform's own Stripe webhook endpoint (Stripe delivers to multiple
endpoints — it runs beside the 5 Zapier zaps; **do not touch the zaps until cutover**,
runbook H). CAUTION: `README.env.md`'s webhook instructions are stale — use the
Vercel-bypass HEADER form (not a token in the URL) and include `charge.dispute.*` in the
subscribed events (security report). Schedule `worker/reconcile-stripe.ts` (drift
detector, exit 1 on drift, cron-friendly; currently UNSCHEDULED — a known gap).

**Gate:** adopt report shows the paying cohort with entitlement rows; at least one real
renewal event arrives on our webhook and lands as an entitlement update; reconcile-stripe
exits 0.

### Phase 5 — live channels (cutover blocker — the platform's top-watched content)

Analytics (2026-07-11) prove live channels are #1 watched (Basmah TV Live 606 views/30d).
They are excluded from VOD migration by design (`status='live'`, no file). **No cutover
without a live answer.** Kit exists: `infra/live-relay/` (WS6, committed; local macOS test
PASSED) — VPS ffmpeg pulls each IPTV source and pushes to Bunny Stream Live (primary) or
packages HLS on the VPS (fallback via `nginx-hls.conf`).

Blockers, in order: (1) founder obtains the **IPTV source URLs** — they are NOT in Uscreen
anywhere (runbook E; inventory: `infra/live-relay/CHANNELS-INVENTORY.md`, 29 channels);
(2) **verify Bunny Stream Live availability in the dashboard FIRST** (README requirement —
UNVERIFIED as of 2026-07-12); (3) provision a VPS (~€4–9/mo Hetzner) with `setup-vps.sh`;
(4) per-channel env files, start `relay@<channel>` services.

**Gate:** `healthcheck.sh` JSON green per channel + an advancing HLS manifest, sustained
≥24h, for the founder-approved channel set (start with the top-watched, not all 29).
**If Bunny Live is unavailable** → branch to the HLS_OUT_DIR fallback + Bunny pull zone
(already in the kit). Rights to relay third-party IPTV feeds = founder's standing call
(noted in the kit README) — never yours.

### Phase 6 — admin CMS, leads, and the operations stack

- Admin CMS screens (members/videos/vouchers) are **in-flight, uncommitted** in the
  working tree — coordinate, don't clobber; completion + commit goes through change
  control. Acceptance: `worker/e2e-admin-crud.ts` + WS7's `e2e-admin-gate.ts` pass; an
  editor can publish a video end-to-end (program plan Ph5 gate).
- **Leads CSV** (runbook G): founder triggers the Uscreen export (arrives async at
  info@fitrahmedia.nl) → drop in `worker/fixtures/` → `worker/import-leads.ts` → count
  imported rows vs CSV rows, exact match.
- Marketing automations stay as they are: weekly email DRAFTS only (Brevo, no list-send
  code path exists), push only from the founder-approved bank behind the manhaj gate —
  all fail-closed by design; never "improve" them into auto-send.
- Post-cutover push channel (today's push rides Uscreen) is **OPEN** — candidate: web push
  from the new platform. Unproven; design via change control.

### Phase 7 — public deploy + DNS cutover

Preconditions: Phases 2, 3, 4, 5 gates green; founder items **F** (Supabase Pro — free
tier won't hold public launch) and legal-pages review (WS10 drafts) done; Weglot TM
exported (inventory #17) so EN/NL titles survive Weglot being switched off.

Sequence: deploy `apps/web` to Vercel (production env: cloud Supabase vars +
`BUNNY_EMBED_TOKEN_KEY` + Stripe keys — names only, values from the founder/dashboards) →
set cloud-auth Site URL + redirect URLs to the production domain (runbook C.4/C.5) →
staged DNS: point the apex at Vercel, 301 map for old Uscreen URL shapes, funnel via
rewrites → members get magic-link activation emails in batches (cohort order per program
plan: new signups → free/API cohort → paying in batches of ~50).

**Gate (all measured, none judged by eye):** production domain serves the new platform
(200); old URLs 301 to mapped targets; Lighthouse ≥90 incl. accessibility and AR RTL
correct (program plan Ph4 bar); catalog pages fetchable by Googlebot; activation-email
delivery rate sane at the raised rate limit; `/migration-status`-style count checks
unchanged through the switch. **If activation emails bounce or throttle** → runbook C.6
rate limit / Resend domain state — founder dashboard, not code.

### Phase 8 — Uscreen cancellation gate (the point of no return)

Contract facts (read 2026-07-05): 12-month term from 2025-07-03, auto-renews unless
written notice ≥30 days before renewal (2026-07-03 renewal has PASSED — assume renewed);
**on termination the account and ALL content are deleted within 30 days, no retrieval
window**. Therefore: **every byte out BEFORE any notice is ever sent** — this rule is
absolute. Keep Uscreen paid through cutover + 1 month (program plan).

Cancellation checklist — every line is a measured check, signed off by the founder:

- [ ] Video bodies: Bunny count = 15,861 − approved exclusions (Phase 1 gate re-run on the day).
- [ ] Playback sample: n=100 random migrated videos play via signed embed (program plan Ph6 gate).
- [ ] Catalog counts (videos/collections/categories/people/leads) match the nightly backup manifest.
- [ ] No `uscreencdn.com` URLs left serving anything: count `videos` / `collections` rows whose live-rendered image fields still point at Uscreen's CDN (query, not eyeball).
- [ ] Leads CSV imported (Phase 6) — the LAST data Uscreen holds that we don't.
- [ ] Final fresh scrape/export sweep (people, member status, collection status) AFTER the last member-affecting change on Uscreen, BEFORE notice.
- [ ] ≥95% of paying subscribers adopted AND at least one full renewal cycle observed in `entitlements` with no payment gap (program plan Ph9 gate).
- [ ] Live channels relaying on our infra, founder-approved set, ≥1 week stable.
- [ ] DNS cut ≥1–2 weeks stable; support/complaint volume reviewed by founder.
- [ ] The 5 Zapier zaps switched OFF at cutover, then Zapier subscription cancelled (runbook H) — never before cutover.
- [ ] IAP members handled per plan (Apple/Google subs CANNOT migrate — grandfather via vouchers/resubscribe; founder accepts modeled churn).
- [ ] Founder sends written termination notice per contract; calendar the 30-day deletion; nothing left to fetch.

### Phase 9 — post-cutover (open items, all unproven — label them so)

Mobile + TV apps (program plan Ph7–8; Apple agreement accepted, bundle IDs must be the
foundation's own, never `tv.uscreen.*`); offline/bulk downloads differentiator; own push
stack; analytics repointed to first-party SQL; cost verification vs the ~€150–250/mo
target. None of this blocks cancellation; none of it is designed yet.

---

## Known wrong paths (fenced — each cost a real incident; full stories in `albunyaan-failure-archaeology`)

- **Bunny server-side fetch of Mux URLs** (`fetchFromUrl`) — accepts with success:true, ingests 0 bytes. Dead code. ffmpeg-pull + `curl -T` upload is the only real path.
- **Removing the on-failure cleanup** in `transferWorker` (nulling `uscreen_hls_url`, deleting the empty Bunny placeholder, rmSync'ing temps) — every piece exists because its absence caused a disaster (permanently-stuck published videos; 5,042 zero-byte Bunny orphans = 97% of the library listing on 2026-07-10). Fail-closed cleanup is a feature.
- **`npx`/`npm exec` for worker scripts** — hangs unpredictably. `node_modules/.bin/tsx` only. (Some older file headers still say `npx tsx` — the headers are stale, the rule is not.)
- **`spawnSync` in worker code** — silently serialized "parallel" workers to 1.
- **Touching the watchdog's hang discriminator** (`ppid != 1` ffmpeg/curl check) — the previous naive version SIGKILLed 5 healthy downloads per pass, an entire evening of zero progress. STOP-level change (see MODEL FITNESS).
- **Adding a heartbeat log to transfer()** — would keep the log fresh while all workers hang, blinding the stale-log signal. Rejected deliberately.
- **Concurrent Uscreen admin page loads** — trips hCaptcha, hangs everything. Harvest stays sequential, ONE page, 1.8s delays.
- **Closing the last CDP page** on the shared :9333 Chrome — breaks connectOverCDP. Park on about:blank, never close the last tab.
- **Trusting the Bunny library item count as progress** — createVideo fires per *attempt*; the 6,017-object listing was ~5,000 failed-attempt debris around 1,023 real videos. Progress = DB `bunny_video_id` count, nothing else.
- **`~/projects/albunyaan-command-center`** — a separate honesty-dashboard Next.js app. Its name suggests it runs the migration; it does not. The migration lives in THIS repo + `~/.albunyaan-cc/`.
- **Reading `~/.albunyaan-cc/*.env`** — never. The service-role key bypasses the entire DB; the Bunny key can delete the whole library. Reference variables by NAME; load with `set -a; source …; set +a` only when a command needs them.
- **`launchctl unload` of `com.albunyaan.*` agents** — blocked by a guardrail hook, by design. Loading a NEW agent is fine.
- **brew installs/upgrades while the migration runs** — broke ffmpeg's dylibs mid-run once (`brew reinstall ffmpeg` fixes it).

---

## MODEL FITNESS — what a Sonnet-class session may do alone vs where to STOP

A Sonnet-class session MAY do alone:
- Phase 0 snapshot, all count queries, `/migration-status`, reading logs/reports.
- Resume/pause the migration per the standard steps (founder confirms the Uscreen login).
- Run any verification harness read-only: `verify-rls.ts`, `verify-playback-lockdown.ts` (both modes), `e2e-*.ts`, `stripe-audit.ts` WITHOUT `--backfill`, `adopt-subscriptions.ts` dry-run.
- Draft founder checklists, export the `skip_no_hls` list, prepare the cancellation evidence pack.
- Import the Leads CSV with an exact row-count check.

STOP — tell the founder to switch to a stronger model / higher effort (and route through `albunyaan-change-control`) before:
- Changing the watchdog hang-discriminator, transfer concurrency/timeouts, or ANY fail-closed cleanup path (the three named STOP items from the owner).
- Writing or applying Supabase migrations / RLS policy changes, or reconciling the UNVERIFIED cloud-migration state.
- `adopt-subscriptions.ts --execute`, `stripe-audit.ts --backfill`, registering/altering the Stripe webhook, anything that writes near money.
- Flipping the Bunny library to token auth (Phase 2) — cheap to do, expensive to get half-right; the pre/post harness must bracket it.
- The DNS cutover plan and execution (Phase 7) and the cancellation decision (Phase 8).
- Designing the cloud transfer VPS or the post-cutover push stack (new architecture).
- Any bulk deletion on a third-party service (Bunny orphan sweeps needed founder's nod even for empty placeholders).

Founder-only (no model can do these): dashboard/DNS/identity steps (runbook A–G), Uscreen re-login in twin Chrome, raising `STOP_GB`, sending the termination notice, all sign-offs.

---

## Provenance and maintenance

Volatile facts here are stamped 2026-07-12. Re-verify before trusting:

- Counts + orchestrator + bundle: `cat ~/.albunyaan-cc/morning-report-$(date +%F).txt` and `tail -3 ~/.albunyaan-cc/watchdog.log ~/.albunyaan-cc/bundle-usage.log`
- Repo HEAD / WS state / in-flight work: `git -C ~/projects/albunyaan-platform log --oneline -5 && git -C ~/projects/albunyaan-platform status --short`
- Founder-step status (A–H): re-read `docs/founder-runbook.md` (it is updated in place; item H already flipped to RESOLVED once)
- Open security gaps: `docs/security-findings-report.md` § "Open & deferred"
- Playback lockdown state: `MODE=pre worker/node_modules/.bin/tsx worker/verify-playback-lockdown.ts` from repo root (if unsigned OPENS, Phase 2 is still pending)
- Bundle thresholds: `grep -E 'WARN_GB|STOP_GB|PREUSED_GB' ~/.albunyaan-cc/bundle-meter.sh`
- Pipeline flags/ordering: `grep -n 'harvest\|transfer\|duration_seconds' ~/projects/albunyaan-platform/worker/migrate-videos.ts | head`
- Program plan / phase definitions: `~/Funnel-Albunyaan-Upgrade/docs/platform-program-plan.md`; session war-log: `~/.claude/projects/-Users-a2020-Fable-5-PLAN/memory/albunyaan-platform-rebuild.md`
- Channel inventory: `head -12 ~/projects/albunyaan-platform/infra/live-relay/CHANNELS-INVENTORY.md`

If any check above contradicts this skill, the live state wins — update this file through
change control.
