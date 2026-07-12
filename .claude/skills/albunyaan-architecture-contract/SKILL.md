---
name: albunyaan-architecture-contract
description: >-
  Load-bearing architecture and orientation contract for the Albunyaan
  platform (the self-built OTT replacement for Uscreen). Load this FIRST in
  any session that touches /Users/a2020/projects/albunyaan-platform,
  ~/.albunyaan-cc, or the video migration — before reading code, before
  proposing changes, before answering "where does X live?". Triggers:
  starting zero-context work on Albunyaan; confusion between the platform
  repo, the ~/.albunyaan-cc state dir, and the albunyaan-command-center
  dashboard; questions about RLS/data-layer design, the Bunny player,
  published-unit semantics, subscription adoption, the admin gate, or which
  invariant you are about to violate. NOT for step-by-step migration
  operation (albunyaan-migration-runbook), debugging a stuck run
  (albunyaan-migration-debugging-playbook), or making changes
  (albunyaan-change-control).
---

# Albunyaan Architecture Contract

**What this is.** The orientation + invariants document for the Albunyaan platform: a self-built OTT platform replacing Uscreen (app.uscreen.tv) — the "Uscreen exit". The mission is a **complete, functioning replacement** of the entire Uscreen platform (database, apps, site, front + back end), *improved* rather than cloned: no platform fees, faster catalog, own push/email stack, manhaj-gated content governance. Completeness is the hard part — nothing may be forgotten. You are almost certainly a zero-context session; this file plus `/Users/a2020/projects/albunyaan-platform/CLAUDE.md` are your ground truth. **CLAUDE.md wins on any conflict** — read it before acting.

**When NOT to use this skill** — go to the sibling instead:

| You need to… | Use |
|---|---|
| Run/resume/restart the video migration | `albunyaan-migration-runbook` |
| Diagnose a stuck/hung/failing migration run | `albunyaan-migration-debugging-playbook` |
| Understand a past disaster before touching related code | `albunyaan-failure-archaeology` |
| Change any code/config/schema safely | `albunyaan-change-control` |
| Look up tables, columns, counts, enums | `albunyaan-data-and-schema-reference` |
| Scrape anything from Uscreen admin | `uscreen-scraping-reference` |
| Call Bunny Stream APIs / manage the library | `bunny-operations` |
| Cron-like automations, reports, emails, push | `albunyaan-ops-and-automations` |
| Verify/QA a change or a migration batch | `albunyaan-validation-and-qa` |
| The overall replacement program & workstreams plan | `albunyaan-platform-replacement-campaign` |
| Build, env vars, dev server, secrets loading | `albunyaan-build-and-env` |

---

## 1. The three-location map (memorize this first)

Albunyaan work lives in THREE places. Confusing them is the #1 zero-context error.

| Location | What it is | What it is NOT |
|---|---|---|
| `/Users/a2020/projects/albunyaan-platform` | **THE platform repo.** pnpm monorepo (git; branch `exit-phase`, also `main`). Web app, domain core, worker scripts incl. `worker/migrate-videos.ts` (THE video migration engine), `supabase/migrations/`, `docs/`. | Not where orchestration state, logs, or secrets live. |
| `/Users/a2020/.albunyaan-cc/` | **Operational state dir** (NOT a git repo). Orchestration shell scripts (`migrate-overnight.sh`, `migration-watchdog.sh`, `bundle-meter.sh`, `morning-report.sh`, `finalize.sh`, `covers-finalize.sh`, `enum-watchdog.sh`, `run-pipeline.sh`, `weekly-email-draft.sh`, `weekly-push-notification.sh`, `monthly-acq-draft.sh`, `backup-catalog.py`), logs (`migrate.log`, `watchdog.log`, `bundle-usage.log`, `morning-report-*.txt`), scraped JSONL (`uscreen-*.jsonl`), the cloned Chrome profile `chrome-emdb-clone/`, and **all secret env files** (`cloud.env`, `brevo.env`, `resend.env`, `supabase-cli.env`, `supabase-db-pw.env`, `webhook.env` — chmod 600). | Not source code. Scripts here CALL the repo's worker scripts. |
| `/Users/a2020/projects/albunyaan-command-center` | A **separate** Next.js repo: local-first internal ops/"honesty" dashboard — reads real business numbers, triggers known automations, never deployed publicly (its own README). | **THE NAMING TRAP: despite the name, it does NOT run or command the migration.** The migration is `worker/migrate-videos.ts` in the platform repo, orchestrated by `~/.albunyaan-cc/migrate-overnight.sh`. |

Additional evidence sources (read-only): docs hub `~/Funnel-Albunyaan-Upgrade/docs/` (program plan, decisions, PRDs); session memory `~/.claude/projects/-Users-a2020-Fable-5-PLAN/memory/albunyaan-platform-rebuild.md`.

**Secrets discipline (hard rule).** NEVER read, print, cat, or quote any `*.env` file in `~/.albunyaan-cc/`. Reference variables by NAME only. Load into a shell with `set -a; source ~/.albunyaan-cc/cloud.env; set +a` (sourcing EXECUTES the file to load vars — required and allowed; READING/printing its contents into context or logs is what's forbidden). Why it matters: `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS entirely (full DB read/write); `BUNNY_API_KEY` can delete the whole video library (`worker/lib/bunny.ts` exports `deleteVideo`). Note: `worker/adopt-subscriptions.ts` references `~/.albunyaan-cc/stripe.env`, which does **not exist yet** as of 2026-07-12 (Stripe key blocked on founder identity verification, founder-runbook step D).

## 2. Monorepo layout

pnpm workspace (`pnpm@11.1.1`; members: `apps/*`, `packages/*`, `worker`):

| Path | Package | Contents |
|---|---|---|
| `apps/web` | `@albunyaan/web` | Next.js 16 + React 19 + Tailwind 4 storefront + member area + `/admin`. Dev: `cd apps/web && pnpm dev -p 3010` → localhost:3010. `lib/` holds session, stripe, sanitize, `bunny-embed.ts`, `admin.ts`, `supabase/server.ts`. |
| `packages/core` | `@albunyaan/core` | Domain types, parental logic (`src/parental.ts`), sanitize, tokens, and `src/data/` — the **server-only data layer** (catalog, search, entitlements, members, admins, plans…) running on the service-role client. Must never reach browser bundles. |
| `worker` | `@albunyaan/worker` | Scrapers (`scrape-*.mjs`, `uscreen-scraper.ts`), importers (`import-uscreen-catalog.ts`, `import-people*.ts`), **`migrate-videos.ts`** (the video migration engine), `adopt-subscriptions.ts`, `stripe-audit.ts`, `reconcile-stripe.ts`, e2e/verify scripts (`verify-rls.ts`, `verify-playback-lockdown.ts`, `e2e-*.ts`). ⚠ `worker/README.md` is STALE (still says "all stubs") — trust code + git log, not that README. |
| `supabase/migrations` | — | `0001_data_liberation.sql` … `0010_email_change_throttle.sql` (schema contract; see §4.1). Also `supabase/drafts/` (never-applied drafts), `functions/`, `templates/`. |
| `docs/` | — | `founder-runbook.md` (DNS/SMTP/auth-dashboard/Stripe setup sequence), `security-findings-report.md` (READ IT — §6 below), `ws1-visibility-decision-pack.md` (published-unit evidence), `legal/`. |
| `infra/live-relay` | — | IPTV live-relay kit (WS6: VPS ffmpeg → Bunny Stream Live). |
| `reference/` | — | Real-site captures (`real-site-ia.json`, screenshots) used for parity checks. |

**Run worker scripts as** `worker/node_modules/.bin/tsx worker/<script>.ts` from repo root (or `cd worker && node_modules/.bin/tsx <script>.ts`) — **NEVER `npx`/`npm exec`** (they hang unpredictably; CLAUDE.md rule). Note (verified 2026-07-12): the repo root has **no** `node_modules/.bin` at all — the tsx binary exists only under `worker/`; CLAUDE.md's shorter `node_modules/.bin/tsx worker/<script>.ts` form assumes you are already in `worker/`. The direct-binary rule's home is `albunyaan-build-and-env` §3.

## 3. Workstream (WS) structure

Work lands as WS-numbered commits on `exit-phase`. Verified from `git log --oneline` (40 commits as of 2026-07-12, HEAD `5c0bed9`):

| WS | Theme | Key commits |
|---|---|---|
| WS0 | Forensics/baseline | `561c407` (stripe-audit, uscreen-events runner, /api/health) |
| WS1 | Catalog visibility | `cfcddad` (enforce published/live in data layer), `83303d8` (env-agnostic live row), `e25c3c2` (decision pack) |
| WS2 | Schema | `2e70424` (migrations 0003–0008 + verify-rls harness) |
| WS3 | Member auth | `2e94923` (magic links + household isolation), `cd664b7`, `813c5dd` (PIN hardening, 0009), `c71d53f` (signed parent-unlock cookie, 0010) |
| WS4 | Stripe billing | `2d3861d`, `f81a7cc` (adversarial-review fixes) |
| WS5 | Playback lockdown | `9a3ea3e` (entitlement-gate playback + signed Bunny embeds, code-side) |
| WS6 | Live channels | `f4eb3a9` (29-channel inventory), `0e2a13e` (live-relay kit) |
| WS7 | Admin security | `5c0bed9` (roster gate + mandatory TOTP) |
| WS8 | Subscription adoption | `a2e7fbf` (adopt-not-recreate) |
| WS9 | Search | in `2d3861d` (SSR search) |
| WS10 | Legal | `b812493` (terms + privacy drafts) |

Pre-WS commits are the migration-engine hardening battles (see `albunyaan-failure-archaeology`).

## 4. Load-bearing design decisions — and WHY

Do not "fix", "simplify", or route around any of these without `albunyaan-change-control`.

### 4.1 RLS deny-by-default; service-role-only data layer — BY DESIGN

- Every table is created RLS-ON with **zero policies** (deny-by-default). `0006_rls_policies.sql` is the ONLY opening: (1) public catalog reads for anon+authenticated, (2) "my own rows" for authenticated members. **No INSERT/UPDATE/DELETE policies exist anywhere** — all writes go through the service role (server actions/workers) or SECURITY DEFINER RPCs (`redeem_voucher`).
- `videos` has **column grants**: clients may read only safe columns; `raw`, `uscreen_video_url`, `uscreen_hls_url`, `live_stream_url`, `live_provider` stay service-role-only. Consequence: `select=*` FAILS for anon/authenticated — clients must request explicit columns.
- Deliberately CLOSED tables (0006 comment block — "Do not open them"): `subscriptions`, `leads`, `uscreen_events`, `stripe_events`, `export_manifest`, `vouchers`, `voucher_attempts`, `platform_admins`.
- The app's data layer (`packages/core/src/data/client.ts`) uses the **service role**, which BYPASSES RLS — so visibility filters must also be applied in code (`VISIBLE_STATUSES` at every catalog/search read path, fixed in `cfcddad` after security finding #14). RLS and code filters are belt-and-suspenders; removing either reopens the draft-catalog leak.
- **Rule (CLAUDE.md):** real policies + auth are required before ANY public deploy. Until then, service-role-only is intentional, not an oversight to "fix".
- Schema conventions (0001/0007/0008 headers): money in cents; `timestamptz` UTC; `text + CHECK`, never Postgres enums; every imported table carries `external_id`/`source`/`raw jsonb` with `unique (source, external_id)` so all importers upsert idempotently.

### 4.2 Player: Bunny iframe when `bunny_video_id` is set, poster fallback

`apps/web/components/VideoPlayer.tsx`: renders a signed Bunny Stream iframe when `videos.bunny_video_id` is set; returns `null` otherwise (caller shows the poster placeholder). **WHY:** the media migration runs incrementally over 15,861 videos — this design means **zero code changes are needed as migration progresses**; each video "lights up" the moment its `bunny_video_id` lands.

- **Entitlement is gated BEFORE the player renders** — `apps/web/app/programs/[slug]/page.tsx` renders the `Paywall` branch instead of `VideoPlayer` when the viewer lacks access (`hasActiveEntitlement`). The player itself does not check access; do not move the gate into it.
- **Signed embeds (WS5, `apps/web/lib/bunny-embed.ts`):** `token = SHA256_HEX(BUNNY_EMBED_TOKEN_KEY + videoId + expires)`, TTL 6h, key server-only (never `NEXT_PUBLIC_`). While the key is unset, URLs are emitted unsigned (accepted until Bunny's "Embed View Token Authentication" is flipped on the library); after the flip, a missing key fails VISIBLY (embed refuses to load), never silently open. Scheme is proven by `worker/verify-playback-lockdown.ts` before the flip is trusted. Whether the library flip + key provisioning has been done in production: **UNVERIFIED as of 2026-07-12** — check before claiming playback is locked down.
- `/watch/[slug]` is only a redirect to `/programs/[slug]` (kept for v0 URLs).

### 4.3 The published UNIT is COLLECTIONS, not videos

Uscreen publishes **collections** (series): 692 scraped from admin (649 published / 43 unpublished; 6 unpublished ones were never imported → 686 in the DB). Only **197 videos** carry `status='published'` and that is what the live site serves — all 197 are already on Bunny (100% playable). The interim RLS/data-layer rule is video-status-based ("Variant B"); "Variant A" (visible when a member of a published collection) is written out ready-to-swap in a comment block in `0006_rls_policies.sql`, but adopting it today would surface ~15,002 videos of which only ~1,371 had Bunny files at decision time (91% broken cards) and would *hide* 178 currently-published videos. Full evidence: `docs/ws1-visibility-decision-pack.md`. **Do not switch variants until the Bunny migration catches up — founder decision.**

### 4.4 Subscriptions: ADOPT, don't recreate (WS8)

The web cohort already pays through the foundation's **own** Stripe account (5 Zapier zaps bridge payment→Uscreen access today; zaps stay until cutover — runbook item H). So billing migration is NOT cancel-and-recreate: `worker/adopt-subscriptions.ts` reads each matched customer's LIVE subscriptions and upserts entitlements through the SAME `applySubscriptionSnapshot()` the webhook uses. **INVARIANT: it never writes to Stripe** (only `subscriptions.list`, a GET). Dry-run by DEFAULT; `--execute` to apply; `--limit N` / `--cohort <legacy_cohort>` to scope. Cutover batches are tracked in `billing_migration_batches`/`billing_migration_items` (0008) — resumable, auditable, item-level roll-back-able.

### 4.5 Admin gate: roster + mandatory TOTP (WS7)

`apps/web/lib/admin.ts`: every `/admin` page AND every admin server action calls `requireAdmin()` first — **layouts are NOT a security boundary in Next** (skippable on client nav; server actions never touch them), so the layout's call is UX only and each leaf enforces again. Gate order, fail-closed: no session → `/login`; not on `platform_admins` roster (table in `0003_identity.sql`, zero policies) → **404, not 403** (the admin surface's existence is not disclosed); roster row but session `aal1` → TOTP step-up (`/admin/mfa`) or first-time enrollment; outranked role → 404. Roles rank `owner > admin > editor > support`. Admin mutations get before/after rows in `admin_audit_log` (0007).

### 4.6 Video migration engine: two-phase by design

(Operation: `albunyaan-migration-runbook`. Architecture facts you must not violate:)

- **Harvest** (Phase 1) is **sequential, ONE browser page, 1800ms politeness delay** — 3-4 concurrent Uscreen admin page loads tripped hCaptcha. Uses the shared Chrome-for-Testing at CDP `http://127.0.0.1:9333` (profile `~/.albunyaan-cc/chrome-emdb-clone`, founder's cloned Uscreen session). **Never close the LAST page in that browser** — it breaks `connectOverCDP` for everyone.
- **Transfer** (Phase 2) is **parallel (`CONCURRENCY` env, default 5)**, no browser, no Uscreen contact: ffmpeg pulls Mux HLS → curl upload to Bunny (Bunny cannot server-fetch Mux tokenized URLs). Mux tokens live ~159 min.
- **Ordering is smallest-first within published-first** (`order status desc, duration_seconds asc`): the founder is on a metered 400GB bundle and every video costs ~2× its size (down + up) — smallest-first buys ~10× more videos per GB/hour.
- **Fail-closed cleanup:** on transfer failure the code deletes the just-created (empty) Bunny video and nulls `uscreen_hls_url` so the video re-harvests fresh (migrate-videos.ts ~lines 230-263). This clause is the fix for the 0-byte-orphan disaster (5,042 empty Bunny entries, 2026-07-10). **Never "optimize" it away.**
- Bookkeeping in `export_manifest` (entity `video_migration`; `skip_no_hls` = two-strike skip for stream-less videos).
- Worker code uses async `spawn`, **never `spawnSync`** (it blocks the event loop and silently serializes "parallel" workers — commit `9623f97`).

## 5. Cross-cutting invariants checklist

Before ANY change, confirm you are not violating one of these:

- [ ] `worker/node_modules/.bin/tsx` (from repo root — no `node_modules/.bin` exists at the root; or `cd worker` first), never `npx`/`npm exec`, for worker scripts.
- [ ] `spawn`, never `spawnSync`, in worker code.
- [ ] Never close the last CDP page on the shared `:9333` Chrome.
- [ ] Harvest sequential + 1.8s delay; transfer parallel `CONCURRENCY=5`.
- [ ] Fail-closed transfer cleanup (deleteVideo + null `uscreen_hls_url`) stays intact.
- [ ] Smallest-first, published-first ordering stays intact (metered bundle).
- [ ] Supabase REST clamps pages to **1000 rows and truncates SILENTLY** — always paginate and verify row counts against expected totals.
- [ ] Scrapers fail honest (explicit statuses), never guess or fabricate.
- [ ] Marketing automations are fail-closed and drafts-only; push notifications require manhaj-gate approval (governance lives in `~/Marketing-Pipelines-Albunyaan`; the weekly/monthly draft scripts in `~/.albunyaan-cc/` write drafts, a human sends).
- [ ] RLS deny-by-default + service-role-only data layer stays until real policies + auth land (pre-public-deploy gate).
- [ ] No write policies for anon/authenticated, ever, without change control.
- [ ] Secrets: never read/quote env files; name variables only.
- [ ] Never contradict `/Users/a2020/projects/albunyaan-platform/CLAUDE.md`.

## 6. Known weak points (stated plainly)

Source: `docs/security-findings-report.md` (15/16 confirmed findings fixed; report cross-checked at commit `83303d8`). Still open as written there, adjusted for later commits:

1. **Playback lockdown is code-side only until proven flipped.** The report's highest-priority gap (public unsigned embeds, no entitlement check) was addressed by WS5 (`9a3ea3e`, AFTER the report): entitlement gating + signed URLs are in the code (verified in `programs/[slug]/page.tsx` + `bunny-embed.ts`). But signing only bites once Bunny's Embed View Token Authentication is enabled AND `BUNNY_EMBED_TOKEN_KEY` is provisioned — **status UNVERIFIED**; until confirmed, assume raw embed GUIDs in page source are playable by anyone.
2. **No ordering guard between concurrent Stripe webhook deliveries** (low; sub-second window, self-heals; no advisory lock in `stripe-apply.ts`).
3. **`worker/reconcile-stripe.ts` is unscheduled** and cannot run without a live Stripe key (blocked on founder verification, runbook step D).
4. **`changeEmailAction` rate-limited but no re-authentication**; Supabase "secure email change" double-confirm must stay ON (runbook C.3).
5. **`apps/web/README.env.md` is operationally stale** (bypass token in URL; missing `charge.dispute.*` in the subscribe list) — following it literally misconfigures the webhook.
6. **`checkoutAction` never asserts live Stripe price == `plans.amount_cents`** — a dashboard-edited price silently changes what `/join` charges.
7. **Cloud auth dashboard was stock-default** (no custom SMTP, localhost Site URL, 2-emails/hour limit ≈ 300 hours to activate the cohort) — `docs/founder-runbook.md` is the fix sequence; completion status of each step is founder-side, verify before assuming done.
8. `worker/README.md` is stale (claims "stubs"); one moderate build-time-only `postcss` advisory noted, not re-run since.

## 7. Current state snapshot (as of 2026-07-12 — VOLATILE, re-verify)

- Videos migrated to Bunny: **1,584 / 15,861 (~10%)**; **published tier COMPLETE: 197/197** (the whole live site plays from Bunny). Structure/enum/covers import phases complete.
- Orchestrator (`~/.albunyaan-cc/migrate-overnight.sh`): **DOWN** — watchdog logs `ORCHESTRATOR DOWN … needs manual restart (shared browser/session)` every 5 min, continuously since the evening of 2026-07-11. **By design it never auto-restarts**: the shared Chrome/Uscreen session needs a human. Use `/migration-status`, then `albunyaan-migration-runbook` to restart.
- Metered bundle: **34GB used of 400GB** (`bundle-meter.sh`: WARN at 200GB, auto-PAUSE at 250GB per founder agreement; state in `~/.albunyaan-cc/bundle-usage.log`).
- Catalog in cloud Supabase (project `albunyaan-platform`, ref `hfqdewsybdoxlmjkjoie`): 15,861 videos / 686 collections / 25 categories / 425 people (CLAUDE.md). Nightly backup LaunchAgent `com.albunyaan.catalog-backup` at 03:30.
- Branch `exit-phase` @ `5c0bed9` (WS7).

## 8. MODEL FITNESS — what a Sonnet-class session may do alone

**OK alone (Sonnet, medium effort):** orientation, reading logs/reports, running `/migration-status`, read-only DB queries (paginated!), writing drafts, adding tests, doc fixes, small UI work in `apps/web` that doesn't touch auth/billing/playback gating, restarting the orchestrator per `albunyaan-migration-runbook` **AFTER an explicit founder go in the current conversation** (restarting the orchestrator is a change-control T3 item — no standing approvals; see `albunyaan-change-control`, founder sign-off list item 3).

**STOP — tell the founder "escalate to a stronger model / higher effort" before touching:**

- The watchdog's hang-discriminator logic in `migration-watchdog.sh` (the ppid/ffmpeg-children check — a past false-kill wasted an entire night).
- Transfer `CONCURRENCY`, harvest delay/sequencing, or the smallest-first ordering.
- Any fail-closed path: transfer cleanup (deleteVideo + null `uscreen_hls_url`), stale-token clearing, webhook 5xx-on-transient-failure, `stripe-apply.ts` semantics.
- RLS policies, column grants, or anything in `supabase/migrations/` (schema is a contract; also see `albunyaan-change-control`).
- Entitlement/paywall/PIN/admin-gate logic; the Bunny embed-signing scheme or its flip.
- Anything spending the metered bundle at scale, deleting Bunny videos, or writing to Stripe.

Rationale: these are the exact spots where past one-line "improvements" caused the catalogued disasters (`albunyaan-failure-archaeology`). Wrong-but-plausible edits here are silent and expensive.

## 9. Provenance and maintenance

Everything above was verified 2026-07-12 against the repo at `5c0bed9` and live files in `~/.albunyaan-cc/`. Re-verify before trusting drift-prone claims:

- Repo/branch/HEAD: `cd /Users/a2020/projects/albunyaan-platform && git log --oneline -5 && git branch`
- Three locations exist: `ls /Users/a2020/projects/albunyaan-platform /Users/a2020/.albunyaan-cc /Users/a2020/projects/albunyaan-command-center`
- Migration count + orchestrator health: `tail -3 ~/.albunyaan-cc/watchdog.log && ls ~/.albunyaan-cc/morning-report-*.txt | tail -1 | xargs head -5` (or run `/migration-status`)
- Bundle usage: `tail -2 ~/.albunyaan-cc/bundle-usage.log` (thresholds: `grep -E 'WARN_GB|STOP_GB' ~/.albunyaan-cc/bundle-meter.sh`)
- Migrations list: `ls /Users/a2020/projects/albunyaan-platform/supabase/migrations`
- RLS surfaces/closed tables: `sed -n '1,60p;150,175p' supabase/migrations/0006_rls_policies.sql`
- Player + gate still wired as described: `grep -n "Paywall\|VideoPlayer\|hasActiveEntitlement" apps/web/app/programs/\[slug\]/page.tsx`
- Embed signing: `sed -n '1,31p' apps/web/lib/bunny-embed.ts`; flip status: check Bunny dashboard + whether `BUNNY_EMBED_TOKEN_KEY` is provisioned (name only — do not print values).
- Admin gate: `sed -n '1,65p' apps/web/lib/admin.ts`
- Security-report open items: `sed -n '61,73p' docs/security-findings-report.md`
- Engine invariants (delay/concurrency/cleanup): `grep -n "1800\|CONCURRENCY\|deleteVideo\|uscreen_hls_url: null" worker/migrate-videos.ts`
- Published-unit numbers: `sed -n '1,35p' docs/ws1-visibility-decision-pack.md`
