# Albunyaan Platform — Project Summary (for external review)

*Written 2026-07-18 from the repo at branch `exit-phase`. Self-contained — no code access needed.*

## 1. What it does and the goal

Albunyaan (albunyaan.tv) is a foundation-run Islamic kids/family video-on-demand platform currently hosted on Uscreen, a SaaS OTT provider. This project — "the Uscreen exit" — is a self-built replacement for the **entire** Uscreen platform: database, storefront, member area, video delivery, billing, admin, live channels, email/push. The bar is a complete, *improved* replacement (no platform fees, faster catalog, own comms stack, content governance gates), after which DNS cuts over and Uscreen is cancelled. Completeness is the explicit hard part: ~15,861 videos, 686 collections, 425 people, a paying member cohort, and 29 live channels all have to survive the move with nothing forgotten.

## 2. Stack and architecture

pnpm monorepo, three packages plus SQL:

- **`apps/web`** — Next.js 16 + React 19 + Tailwind 4. Storefront, member area, `/admin`. Server-rendered; deployed to Vercel (repo is wired to a Vercel project; deploys were being triggered as of 2026-07-13).
- **`packages/core`** — domain types, parental-control logic, and the **server-only data layer** (catalog, search, entitlements, members, plans). It runs on the Supabase service-role client and must never reach a browser bundle.
- **`worker/`** — one-off and pipeline scripts run via `tsx`: Uscreen scrapers, catalog importers, the video-migration engine (`migrate-videos.ts`), Stripe adoption/audit/reconcile tools, and e2e verification harnesses.
- **`supabase/migrations/`** — schema contract, `0001`–`0011`. Conventions: money in cents, `timestamptz` UTC, `text + CHECK` instead of Postgres enums, and every imported table carries `external_id`/`source`/`raw jsonb` with a `unique(source, external_id)` so importers are idempotent upserts.

External services: **cloud Supabase** (Postgres, auth, storage), **Bunny Stream** (video CDN — destination of the migration; player embeds Bunny iframes), **Stripe** (the foundation's *own* account — members already pay through it today, bridged to Uscreen by 5 Zapier zaps that stay until cutover), **Mux** (Uscreen's underlying video host — source of the migration, accessed via tokenized HLS URLs).

Operational state (orchestration shell scripts, logs, scraped JSONL, secrets, a cloned Chrome profile holding the founder's Uscreen admin session) lives *outside* the repo in a local state directory, driven by macOS LaunchAgents (migration watchdog, bandwidth meter, nightly DB backup, morning report, drafts-only marketing automations).

### Security architecture (deliberate, not an oversight)

- **RLS is deny-by-default.** Every table has RLS on with zero policies except one migration that opens (a) public catalog reads and (b) "my own rows" for authenticated members. There are **no** INSERT/UPDATE/DELETE policies anywhere — all writes go through the service role (server actions/workers) or SECURITY DEFINER RPCs. Sensitive tables (subscriptions, leads, event logs, vouchers, admin roster) are fully closed.
- The `videos` table has **column grants**: clients can read only safe columns; source URLs (Uscreen/Mux/live-stream) are service-role-only. A `select *` fails for clients by design.
- Because the app's data layer uses the service role (which bypasses RLS), **visibility filters are duplicated in code** at every catalog/search read path. RLS and code filters are belt-and-suspenders; a past security review found a draft-catalog leak when the code side was missing.
- **Admin gate**: every `/admin` page *and* every admin server action independently calls a `requireAdmin()` check (Next.js layouts are not a security boundary). Fail-closed order: no session → login; not on the admin roster → **404** (not 403 — the surface's existence isn't disclosed); rostered but no second factor → mandatory TOTP step-up; insufficient role → 404. Admin mutations write before/after rows to an audit log.

## 3. Key flows

### Video migration pipeline (the long pole)

Two-phase, resumable, bookkept per-video in an `export_manifest` table:

1. **Harvest** — a browser (Chrome for Testing over CDP, using a clone of the founder's logged-in Uscreen admin profile) visits each video's admin page and captures its Mux HLS URL. Deliberately **sequential, one page, 1.8 s delay between loads** — concurrent admin loads trip hCaptcha and kill the session. Mux tokens live ~159 minutes, so harvested URLs are perishable.
2. **Transfer** — parallel (5 workers), no browser: ffmpeg pulls the Mux HLS stream to a local file, curl uploads it to Bunny Stream. (Bunny cannot server-side-fetch tokenized Mux URLs, hence the download-then-upload shape.)

Load-bearing details a reviewer should know before suggesting changes:

- **Ordering is smallest-first within published-first.** The founder runs this over a metered 400 GB data bundle and each video costs ~2× its size (down + up); smallest-first lands ~10× more videos per GB. An automated meter warns at 200 GB and auto-pauses the pipeline at 250 GB.
- **Fail-closed cleanup**: on any transfer failure the code deletes the just-created (empty) Bunny video object and nulls the stored HLS URL so the video re-harvests fresh. This clause is the fix for a real incident (~5,000 zero-byte orphan objects accumulated in the Bunny library) — it looks removable and is not.
- An orchestrator shell loop alternates harvest → transfer rounds; a watchdog distinguishes "hung" from "healthy long upload" by checking for live ffmpeg/curl children with correct pid topology — an earlier naive version of that check killed healthy uploads every round for a night. It never auto-restarts the orchestrator (the browser session needs a human).

### Playback and entitlements

The player component renders a Bunny iframe when a video has a `bunny_video_id`, else the caller shows a poster placeholder — so **zero code changes are needed as the migration progresses**; videos light up one by one. Entitlement is checked *before* the player renders (a Paywall branch replaces it); the player itself never gates. Embed URLs are signed server-side (`SHA256(secret + videoId + expires)`, 6 h TTL). Crucially, signing only has teeth once "Embed View Token Authentication" is flipped on the Bunny library — until then URLs work unsigned, which is the current (unverified) state; see §5.

**Published-unit semantics**: Uscreen publishes *collections* (series), not videos — 692 scraped, 686 imported. But only ~197 videos carry `status='published'` and that set is exactly what the live site serves. The interim visibility rule is video-status-based ("Variant B"); a collection-membership rule ("Variant A") is drafted and commented in the RLS migration but deliberately not adopted — switching today would surface ~15,000 videos of which ~90% have no Bunny file yet (broken cards) and would hide 178 currently-published ones. Founder decision: don't switch until the migration catches up.

### Billing: adopt, don't recreate

Members already pay through the foundation's own Stripe account, so billing migration is **not** cancel-and-recreate. An adoption script reads each matched customer's live subscriptions (read-only — it never writes to Stripe) and upserts entitlements through the exact same snapshot-apply function the Stripe webhook uses. Dry-run by default, `--execute` to apply, batches tracked in dedicated tables so cutover is resumable and item-level auditable. The 5 Zapier zaps bridging Stripe→Uscreen stay live until cutover day.

### Member auth

Magic-link login with household isolation, parental-control PIN (salted scrypt, atomic lockout against brute force), a signed parent-unlock cookie, and rate-limited email change (relying on Supabase's double-confirm email-change staying enabled).

## 4. Current state (2026-07-18)

**Works, verified:**

- Full catalog in cloud Supabase: 15,861 videos / 686 collections / 25 categories / 425 people, with real posters mirrored to own storage. Nightly automated backup (row-count-verified).
- **Published tier 100% migrated**: all 197 published videos play from Bunny — the live-site-equivalent catalog is fully functional on the new stack.
- Auth, parental controls, entitlement-gated playback (code side), Stripe webhook + adoption tooling, admin area with CRUD (videos/vouchers/members), SSR search, voucher/coupon redemption (recently rebuilt from a stub and e2e-tested), legal/content pages with real copy, a URL redirect map (17/18 categories matched), a written cutover runbook, and staged-but-inert Sentry/Plausible monitoring.
- e2e harnesses for the admin gate, member auth, playback gating, and coupon redemption; a security review with 15/16 findings fixed.

**Half-done / paused:**

- **Bulk video migration: 1,584 / 15,861 (~10%)**. The orchestrator is currently down (by design it needs a manual restart — the shared browser holds the founder's Uscreen session). Data bundle at 55/400 GB. Remaining ~14k videos ≈ weeks of running; a cheap VPS to run the transfer side (removing the bundle constraint) is designed but deferred.
- **Live channels**: 29-channel inventory done; a hardened ffmpeg relay kit (VPS → Bunny Stream Live, with systemd watchdog and HLS fallback) is built and locally tested, but no VPS is deployed and Bunny Live availability on the account is unverified.
- **Founder-side prerequisites** (external dashboards, not code): custom SMTP + auth-dashboard config (stock limits would take ~300 hours to email the cohort), Stripe API key (blocked on Stripe identity verification — this also blocks the reconcile tooling), DNS TTL prep, Sentry/Plausible account creation. A founder runbook sequences these; completion status of each is unverified from the repo side.
- Deployment exists on Vercel but public cutover (DNS) has not happened; the cutover runbook is drafted but not yet walked through with the team.

## 5. Known problems and open questions

1. **Playback lockdown is code-side only until proven otherwise.** Signed-embed code is in place, but whether Bunny's Embed View Token Authentication has been flipped and the signing key provisioned in production is unverified. Until confirmed, assume the raw Bunny embed GUIDs visible in page source are playable by anyone who extracts them. This is the top security gap.
2. **Checkout doesn't cross-check price**: the checkout action never asserts that the live Stripe price equals the plan's stored `amount_cents` — a dashboard-edited price would silently change what the join page charges.
3. No ordering guard between concurrent Stripe webhook deliveries (sub-second race window; self-heals; accepted as low risk).
4. Stripe reconciliation script exists but is unscheduled and can't run until the Stripe key lands.
5. Email change is rate-limited but doesn't require re-authentication; safety depends on a Supabase dashboard setting staying on.
6. The Variant A/B visibility switch (§3) must be revisited once migration progresses — easy to forget.
7. Migration throughput is hostage to a metered consumer connection; the pipeline has a long history of environment-induced failures (hCaptcha, token expiry, throttled uplink, watchdog false-kills) — all currently fixed, but the fixes are subtle and look like clutter.
8. One category redirect of 18 unmatched in the redirect map; some doc files inside the repo are stale by admission (notably the worker README).

## 6. What a reviewer needs to know to give useful feedback

- **Hard external constraints shaped the odd-looking designs.** Sequential 1.8 s harvest (hCaptcha), download-then-upload transfer (Bunny can't fetch tokenized Mux URLs), ~159-minute Mux token TTL (drives the "null the URL and re-harvest on failure" logic), smallest-first ordering (metered bundle), Supabase REST silently truncating any request over 1000 rows (every bulk read must paginate and verify counts).
- **Several "obviously removable" pieces are incident fixes**: the delete-empty-Bunny-object-on-failure clause, the two-strike skip for stream-less videos, the watchdog's ffmpeg/curl child-process discriminator, async `spawn` instead of `spawnSync` in workers (spawnSync silently serialized the "parallel" workers). Suggesting their removal re-opens documented outages.
- **Service-role-only data layer is a stated pre-launch posture, not negligence**: the rule is real per-user policies + auth before any public deploy; the interim design is deny-all RLS + code-side filters + column grants. Critique the *end state* plan, not the interim as if it were final.
- **The published unit is collections, not videos** — any feedback on catalog visibility, counts, or "why are only 197 of 15,861 published" needs that frame.
- **Cutover is decision-gated and sequenced** (finish video bodies → verify playback lockdown → SMTP/auth → adopt billing cohort → live channels → deploy → DNS → cancel Uscreen), with an explicit golden rule: members hear about the new platform only *after* it's proven working.
- Useful review targets right now: the signed-embed scheme and its failure modes; the adopt-not-recreate billing flow (idempotency, partial-failure recovery); the checkout price-check gap; the RLS end-state design; and the cutover runbook's ordering and rollback story.
