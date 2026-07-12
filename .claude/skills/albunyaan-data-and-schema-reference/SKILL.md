---
name: albunyaan-data-and-schema-reference
description: >
  The data layer of the Albunyaan platform (Uscreen exit): cloud Supabase schema
  (migrations 0001–0011), the videos/export_manifest columns that drive the
  Uscreen→Bunny migration, verified live catalog counts, the ~/.albunyaan-cc
  scraped JSONL file catalog with row shapes, the Supabase 1000-row REST clamp
  and the mandatory pagination pattern, and the nightly gzipped-NDJSON backup
  system. Load this skill whenever a session must QUERY, COUNT, JOIN, IMPORT,
  BACK UP or REASON ABOUT data: "how many videos are migrated?", "what does
  export_manifest look like?", "which table holds X?", "what's in
  uscreen-videos-rich.jsonl?", "why is my query capped at 1000 rows?", "where
  are the DB backups?", "what did migration 000N add?", or before writing ANY
  query/importer that touches the Supabase project or the JSONL scrapes. NOT
  for running the migration (albunyaan-migration-runbook), debugging pipeline
  failures (albunyaan-migration-debugging-playbook), scraping Uscreen
  (uscreen-scraping-reference), Bunny API calls (bunny-operations), or editing
  schema/pipeline code (albunyaan-change-control first).
---

# Albunyaan data & schema reference

Ground-truth map of every place Albunyaan data lives. All numbers verified live on **2026-07-12** unless labeled otherwise. Read `/Users/a2020/projects/albunyaan-platform/CLAUDE.md` first if you haven't — this skill details it, never overrides it.

**Jargon, once:**
- **Uscreen** — the hosted OTT platform being exited (`app.uscreen.tv`). All `source='uscreen'` rows were liberated from it.
- **Bunny (Bunny Stream)** — the video CDN replacing Uscreen/Mux for playback. A migrated video has `videos.bunny_video_id` set.
- **Supabase** — hosted Postgres + PostgREST. Cloud project `albunyaan-platform`, ref `hfqdewsybdoxlmjkjoie` (per CLAUDE.md).
- **RLS** — Postgres Row Level Security. Here: ON everywhere, deny-by-default; the service role bypasses it and is the only write path.
- **JSONL / NDJSON** — one JSON object per line.
- **Manifest** — the `export_manifest` table: one bookkeeping row per (entity, external_id), makes every import/migration resumable.

## When NOT to use this skill

| You want to… | Use instead |
|---|---|
| Start/stop/health-check the video migration | `albunyaan-migration-runbook` |
| Root-cause a migration failure | `albunyaan-migration-debugging-playbook` |
| Learn the settled war stories behind the design | `albunyaan-failure-archaeology` |
| Scrape anything from Uscreen admin | `uscreen-scraping-reference` |
| Call the Bunny API / manage the library | `bunny-operations` |
| Change schema, importers, or pipeline code | `albunyaan-change-control` (approval gates), then `albunyaan-architecture-contract` |
| LaunchAgents, reports, email/push automations | `albunyaan-ops-and-automations` |
| Verify a finished import end to end | `albunyaan-validation-and-qa` |

## The three data homes

1. **Cloud Supabase** — the live database. Schema in git: `supabase/migrations/0001..0011`. Service-role-only access (RLS deny-by-default; 0006 opens read-only catalog + "my own rows" policies).
2. **`~/.albunyaan-cc/*.jsonl` + `*.json`** — raw scraper output from Uscreen admin. Source snapshots, never mutated by importers; importers read them and upsert into Supabase.
3. **`~/Backups/albunyaan-supabase/<stamp>/`** — nightly gzipped NDJSON dumps of every table, mirrored to OneDrive.

Secrets live in `~/.albunyaan-cc/*.env` (chmod 600): `cloud.env` (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, BUNNY_LIBRARY_ID, BUNNY_API_KEY, BUNNY_CDN_HOST), plus `brevo.env`, `resend.env`, `webhook.env`, `supabase-cli.env`, `supabase-db-pw.env`. **Never print, cat, echo or commit their contents.** The service-role key bypasses ALL RLS; the Bunny key can delete the entire video library. `uscreen-storageState.json` (Playwright cookies for the founder's Uscreen admin session) is secret-equivalent — never print it either. Load env only via:

```bash
set -a; source ~/.albunyaan-cc/cloud.env; set +a
```

(No contradiction: sourcing EXECUTES the file to load vars into the shell — required and
allowed; READING/printing its contents into context or logs is what the rule forbids.)

## Querying the live DB (copy-paste)

Exact row count of any table (HEAD-style, costs nothing):

```bash
set -a; source ~/.albunyaan-cc/cloud.env; set +a
curl -s "$SUPABASE_URL/rest/v1/videos?select=id&limit=0" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Prefer: count=exact" -D - -o /dev/null | grep -i content-range
# → content-range: */15861
```

Add PostgREST filters as query params, e.g. `&status=eq.published`, `&bunny_video_id=not.is.null`, `&entity=eq.video_migration`.

## Migrations 0001–0011 (`supabase/migrations/`)

Conventions (0001 header, kept ever since): `text` + `CHECK`, never Postgres enums; money in cents; `timestamptz` UTC; every imported table carries `external_id` / `source` (default `'uscreen'`) / `raw jsonb` with `unique (source, external_id)` so importer reruns are idempotent upserts; RLS ON for every table, zero policies until 0006.

| File | Adds |
|---|---|
| `0001_data_liberation.sql` | The whole Phase-1 schema: `videos`, `categories`, `collections`, `collection_items` (ordered, `position`), `filters`, `filter_values`, `video_filter_values`, `authors`, `video_authors`, `video_categories`, `people`, `plans`, `subscriptions`, `leads`, `uscreen_events` (store-first webhook inbox), `export_manifest`. RLS ON, zero policies. |
| `0002_parental_local.sql` | Widens `videos.status` CHECK to add `'live'`; adds `videos.age_rating`, `videos.thumbnail_hue`; creates `households` (parent `pin_hash`), `profiles` (adult/kid, age_band, daily limits), `content_overrides` (block/allow per kid profile). |
| `0003_identity.sql` | `people.auth_user_id` → `auth.users`; `households.owner_person_id`; `platform_admins` roster; `handle_new_user()` signup trigger (link-or-create person; non-failing by design). |
| `0004_billing.sql` | `entitlements` (THE watch-time access check), `vouchers`, `voucher_redemptions`, `voucher_attempts` (rate-limit log), `stripe_events` inbox; `redeem_voucher(code)` SECURITY DEFINER RPC (atomic, 5-fails/hour limit). |
| `0005_live_watch.sql` | `videos.live_stream_url` + `videos.live_provider` (server-side only, never granted to clients); `watch_progress` (per profile, PK `(profile_id, video_id)`). |
| `0006_rls_policies.sql` | FIRST policies: anon+authenticated SELECT on catalog tables; `videos` visible only when `status in ('published','live')`; **column grants** on `videos` exclude `raw`, `uscreen_video_url`, `uscreen_hls_url`, `live_stream_url`, `live_provider`, `age_rating_source` (NB: with column grants `select=*` FAILS for anon/authenticated — request explicit columns); member "own rows" policies; `subscriptions`/`leads`/`vouchers`/`export_manifest`/`platform_admins`/event inboxes stay closed. No write policies anywhere. |
| `0007_admin_audit.sql` | `admin_audit_log` (before/after jsonb per admin mutation); `videos.age_rating_source` (`unrated`/`human`/`batch_classified`). |
| `0008_migration_state.sql` | **Billing-cutover** state machine (NOT the video migration — naming trap): `billing_migration_batches` + `billing_migration_items` for moving Uscreen cohorts to Stripe in resumable, auditable, per-person roll-back-able batches. Both empty as of 2026-07-12 (cutover not started). Video-migration state lives in `export_manifest` (0001). |
| `0009_pin_hardening.sql` | `households.pin_failed_attempts` / `pin_locked_until`; `reserve_pin_attempt(uuid)` RPC (row-lock-serialized attempt counter, 5 attempts / 15-min lock; service-role EXECUTE only). |
| `0010_email_change_throttle.sql` | `people.email_change_requested_at` cooldown stamp. |
| `0011_widen_export_manifest_status.sql` | Widens the `export_manifest.status` CHECK to also allow `'done'` and `'skip_no_hls'` (the video pipeline's statuses, silently rejected by the 0001 CHECK for weeks — see the RESOLVED mismatch below). Commit `da5cced`, branch `exit-phase`, 2026-07-12. |

All eleven are applied to the cloud project (WS2+ tables verified present live 2026-07-12; 0011 applied and verified live 2026-07-12 — constraint definition re-read, sentinel `done`/`skip_no_hls` rows inserted, persisted, deleted). `supabase/drafts/0001_init.draft.sql` is a parked pre-PRD draft — never apply it.

## videos — the columns that drive the migration

| Column | Role |
|---|---|
| `external_id` | Uscreen video id (e.g. `4246381`). Admin URL: `https://app.uscreen.tv/manage/videos/<external_id>/details`. |
| `uscreen_hls_url` | Harvested Mux HLS URL with `?token=` (~159-min life). `NULL` = needs (re-)harvest. Transfer failure **nulls it on purpose** so the video re-harvests a fresh token — never "optimize" that away. Never granted to clients. |
| `bunny_video_id` | Bunny GUID. Set **only after** a successful upload. `NULL` = not migrated. The web player renders the Bunny iframe when set, poster fallback otherwise — no code change needed as migration progresses. |
| `status` | `draft` / `published` / `scheduled` / `live` (0002). Harvest excludes `'live'` (live channels have no VOD file) and orders published-first. Only `published`/`live` are publicly visible (0006 policy). |
| `duration_seconds` | Parsed from the scraped `"17:02"`-style duration. Drives **smallest-first** ordering in both harvest and transfer (metered 400GB bundle; each video costs ~2× its size: download + upload). `NULL` sorts last. |

Migration selection predicates (from `worker/migrate-videos.ts`):
- **harvest**: `source='uscreen' AND status!='live' AND bunny_video_id IS NULL AND uscreen_hls_url IS NULL`, published first, shortest first, minus manifest-skipped rows.
- **transfer**: `source='uscreen' AND bunny_video_id IS NULL AND uscreen_hls_url IS NOT NULL` (expired-token preflight clears stale URLs back to harvest).

## export_manifest — semantics and a RESOLVED schema mismatch

Table (0001): `(entity, external_id)` unique, `status`, `attempts`, `last_error`, `raw_path`, `updated_at`. Generic importers (`worker/lib/manifest.ts`, `uscreen-export.ts`) use the lifecycle `pending → fetched → parsed → upserted | failed`, which was exactly the 0001 CHECK: `('pending','fetched','parsed','upserted','failed')`. Migration 0011 (2026-07-12) widens the CHECK to also allow `'done'` and `'skip_no_hls'`.

The video pipeline writes rows with `entity='video_migration'` via `setManifest()` in `worker/migrate-videos.ts`, intending:
- `fetched` — transferred to Bunny (set together with `bunny_video_id`)
- `failed` + `last_error` — any harvest/transfer error (`no_hls`, `hard_timeout`, ffmpeg/upload errors, `bunny_encode_failed`)
- `skip_no_hls` — two `no_hls` strikes → permanently stream-less, skip forever
- `done` — Bunny encode confirmed by `--poll`

**✅ RESOLVED 2026-07-12 (migration 0011 + commit `da5cced`, branch `exit-phase`) — formerly "VERIFIED LIVE MISMATCH".** What was wrong (kept as archaeology): `'skip_no_hls'` and `'done'` were NOT in the 0001 CHECK constraint, no migration widened it, and `setManifest()` discarded the upsert error object — so both writes failed *silently*, for weeks. Live counts observed while broken (2026-07-12, 3,699 `entity=video_migration` rows): `fetched` 1,582, `failed` 2,117, `done` **0**, `skip_no_hls` **0**. Consequences observed then:
- The two-strike skip never persisted (rows stayed `failed`/`no_hls` — 110 such rows); harvest's skip-set was always empty, and `migrate.log` had zero "known stream-less skipped" lines. Only the `limit*5` over-fetch mitigated batch collapse.
- `--poll`'s done-marking never persisted, so every poll round re-polled every migrated video against Bunny (`poll: finished 998, …` repeated with the same number each round).

The fix, all three legs verified against repo + live DB 2026-07-12:
1. `supabase/migrations/0011_widen_export_manifest_status.sql` — CHECK widened to `('pending','fetched','parsed','upserted','failed','done','skip_no_hls')`. **Already applied to the cloud DB and verified live 2026-07-12** (constraint definition re-read; sentinel `done`/`skip_no_hls` rows inserted, persisted, deleted).
2. `setManifest()` in `worker/migrate-videos.ts` now captures the supabase-js error and `console.error`s `manifest write FAILED for <id> (<status>): <msg>` — manifest write failures are no longer swallowed.
3. `poll()` in `worker/migrate-videos.ts` now paginates both the manifest done-set read and the migrated-videos read in 1000-row `.range()` pages (the old `.limit(5000)`, silently clamped to 1000, is gone).

**Backfill nuance — the counts stay 0 for now.** Historical data was NOT backfilled: manifest `done` and `skip_no_hls` counts remain **0** until the next `--poll` / `--harvest` runs actually write them, and two-strike skip state re-accumulates from scratch (prior strikes were never persisted). The ×5 over-fetch mitigation still covers stream-less videos meanwhile. The first `--poll` after restart will be a long one (empty done-set → polls all ~1,584 migrated), then shrinks on subsequent rounds as `done` rows accumulate — expected, not a regression. As of 2026-07-12 the migration has NOT been restarted and no poll has run yet (founder said no video transfers for now).

This section is the SINGLE authoritative home for as-built `export_manifest` truth — sibling skills (validation-and-qa §2/§8, failure-archaeology Battles 4/6, debugging-playbook symptom 4, bunny-operations `--poll`, migration-runbook glossary) reference it rather than restating. Since 0011, the `done`/`skip_no_hls` semantics siblings describe are the as-built semantics going forward, not merely intended. Any further schema/pipeline change here still routes through `albunyaan-change-control` (it touches fail-closed paths).

Count the manifest yourself:

```bash
for s in fetched failed done skip_no_hls; do
  echo -n "$s: "; curl -s "$SUPABASE_URL/rest/v1/export_manifest?select=id&entity=eq.video_migration&status=eq.$s&limit=0" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Prefer: count=exact" -D - -o /dev/null | grep -i content-range
done
```

## Catalog numbers (verified live 2026-07-12)

| Measure | Count | Note |
|---|---|---|
| `videos` | 15,861 | 15,664 draft + 197 published + 0 scheduled + 0 live (live channels not yet flagged; WS6 inventory lists 29). |
| `videos` migrated (`bunny_video_id` set) | 1,584 | ≈10%. All 197 published videos are migrated (live-site tier complete). |
| `videos` with fresh-ish `uscreen_hls_url` | 1,608 | includes already-migrated rows; success path doesn't null the URL. |
| `collections` | 686 | Scrape shows 692 unique collection ids (649 published / 43 unpublished); the 6-row delta vs the DB is unreconciled — UNVERIFIED cause. |
| `collection_items` | 16,150 | ordered membership. |
| `categories` | 25 | |
| `video_categories` | 17,953 | derived category→collection→video links. |
| `people` | 2,926 | fresh CSV import 2026-07-12 (commit `e25c3c2`, `worker/import-people-csv.ts`, fixture `worker/fixtures/uscreen-people-export.csv`). CLAUDE.md's "425 people" is the earlier `uscreen-people.jsonl` page-scrape import, superseded on this count. |
| `authors` | 0 | speaker/author import has not happened. |
| `households` / `profiles` | 1 / 3 | demo household. |
| `subscriptions`, `plans`, `entitlements`, `leads`, `billing_migration_*`, `stripe_events`, `uscreen_events`, `watch_progress` | 0 | not yet populated / cutover not started. |

The **published unit is collections** (649 published per the status scrape), not videos — Uscreen publishes series; the 197 published *videos* are what the storefront serves directly.

## The 1000-row REST clamp — trap and pattern

Supabase PostgREST silently clamps ANY response page to **1000 rows** — `.limit(5000)` or a `Range: 0-4999` header returns 1000 with **no error**. Live proof inside this very project: `--poll` used to select videos with `.limit(5000)`; with 1,584 migrated it processed exactly 1,000 (log: `poll: finished 998, still encoding 0, failed 2` = 1,000). Fixed 2026-07-12 (commit `da5cced`): `poll()` now paginates in 1000-row `.range()` pages.

**Rule: any read that can exceed 1000 rows MUST paginate AND verify the total.**

```ts
// supabase-js pagination (pattern used in migrate-videos.ts poll, manifest read)
const all: Row[] = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb.from('videos').select('id, external_id').range(from, from + 999);
  if (error) throw error;
  all.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
// VERIFY: compare all.length to a Prefer: count=exact head request before trusting it.
```

```python
# raw REST pagination (pattern from backup-catalog.py dump_table, PAGE=1000)
hdrs = {"Range-Unit": "items", "Range": f"{offset}-{offset+999}"}
# loop until a page returns < 1000 rows
```

## ~/.albunyaan-cc scraped-data catalog (line counts as of 2026-07-12)

JSONL (one object per line):

| File | Lines | Row shape (first line, verbatim keys) |
|---|---|---|
| `uscreen-videos-rich.jsonl` | 15,861 | `{"id":"4246381","title":"…","thumb":"https://alpha.uscreencdn.com/…jpg","duration":"17:02","status":"draft"}` — THE video source of truth; feeds `import-uscreen-catalog.ts`. |
| `uscreen-video-ids.jsonl` | 1,944 | `{"id":"4255266","title":"","page":1}` — early partial enumeration, superseded by videos-rich. |
| `uscreen-collection-status.jsonl` | 692 | `{"id":"4247706","title":"…","status":"published","videosCount":null,"page":1}` — 649 published / 43 unpublished. |
| `uscreen-collection-members.jsonl` | 692 | `{"id":"4247706","title":"…","videoIds":["4246385",…]}` — ORDERED; feeds `collection_items.position`. |
| `uscreen-collection-covers.jsonl` | 686 | `{"id":"4247706","cover":"https://alpha.uscreencdn.com/…jpg"}` — 686/686 collections covered. |
| `uscreen-category-collections.jsonl` | 25 | `{"id":"128768","title":"Channels Live 📡","collectionIds":[…],"videoIds":[]}` — category→collections structure; `videoIds` is `[]` on all 25 rows. |
| `uscreen-category-members.jsonl` | 25 | `{"id":"128768","title":"…","videoIds":[]}` — `videoIds` empty on all 25 rows (categories hold collections, not videos); superseded by category-collections. |
| `uscreen-member-status.jsonl` | 2,923 | `{"id":"32210782","email":"…","status":""}` — statuses: `""` 1,367 / `Churned` 967 / `Active` 589. Contains PII (emails) — don't paste rows into reports. |
| `uscreen-people.jsonl` | 425 | `{"id":"32139113","email":"…------","text":"…€0.00Jul 04, 2026","key":"32139113","page":1}` — messy early People-page scrape (email field has UI-text run-ons); superseded by the 2,926-row CSV import. PII. |

Plain JSON:

| File | Content |
|---|---|
| `uscreen-categories-list.json` | 25 × `{id, title}` |
| `uscreen-collections-list.json` | 12 × `{id, title}` — early partial; use `-full` |
| `uscreen-collections-list-full.json` | 692 × `{id, title}` |
| `storefront-covers.json` | `[{slug, img}]` storefront cover scrape |
| `metrics-prev.json` | previous-day marketing metrics snapshot (morning-report state) |
| `uscreen-storageState.json` | Playwright cookies — SECRET-equivalent, never print |

## Nightly backups (`backup-catalog.py`)

- **Trigger**: LaunchAgent `com.albunyaan.catalog-backup` (`~/Library/LaunchAgents/com.albunyaan.catalog-backup.plist`), daily **03:30**, runs `/usr/bin/python3 ~/.albunyaan-cc/backup-catalog.py`, stderr → `~/.albunyaan-cc/backup.log`.
- **What**: discovers every public-schema table from the PostgREST OpenAPI root (`GET $SUPABASE_URL/rest/v1/`), dumps each to `<table>.ndjson.gz` (gzipped NDJSON, paginated 1000 rows/page) under `~/Backups/albunyaan-supabase/<YYYY-MM-DD_HHMM>/`, writes `manifest.json` with per-table row counts, mirrors the folder to `~/Library/CloudStorage/OneDrive-StichtingalAsr/Albunyaan-DB-Backups/<stamp>/`, rotates **14 local / 7 OneDrive**. Schema itself is NOT backed up (it lives in git).
- **Restore/read**: `zcat ~/Backups/albunyaan-supabase/<stamp>/videos.ndjson.gz | head -1`.
- **Reliability as of 2026-07-12** (from `backup.log` + dir listing): good snapshots 07-07, 07-10, 07-12; **07-08, 07-09, 07-11 left EMPTY dirs** (network timeouts before any dump). The 07-10 and 07-12 runs dumped and mirrored fine but then **crashed in OneDrive rotation** (`PermissionError: Operation not permitted` on the OneDrive dir — macOS TCC in the LaunchAgent context) → exit 1 after the data was safe. Fixing either is an ops change → `albunyaan-ops-and-automations` + change control.
- **Staleness trap**: the 2026-07-12_0330 manifest predates that morning's people import (shows `people: 425`) and the WS2+ schema apply (lists only 19 tables — no `entitlements`, `billing_migration_*`, etc.). The NEXT successful backup should show 2,926 people and the full table set; if it still lists 19 tables, investigate `table_names()` against the OpenAPI root.

## MODEL FITNESS

A Sonnet-class session may do alone:
- Read-only queries/counts against Supabase (the curl recipes here), reading JSONL/backup files, reconciling numbers, writing reports.
- Writing NEW read-only scripts that follow the pagination + count-verify pattern.
- Re-running an existing importer unchanged after confirming idempotency (unique `(source, external_id)` upsert) — and verifying row counts after.

STOP and tell the founder to switch to a stronger model / higher effort (and route through `albunyaan-change-control`) before:
- Any schema change: new migration, altering RLS policies or column grants (0006 is a security surface). (The `done`/`skip_no_hls` mismatch fix — 0011 + `da5cced`-class pipeline edits — was exactly this class: it interacted with harvest skip logic, poll cost, and fail-closed transfer paths.)
- Any write/delete against live `videos`, `export_manifest`, `people` outside an existing importer; anything touching `bunny_video_id` or `uscreen_hls_url` semantics.
- Changing the backup script's table discovery, rotation, or destinations.
- Anything requiring the service-role key in a NEW context (new script, new machine, CI).

## Provenance and maintenance

Everything above was verified 2026-07-12 against the repo and the live DB. One-line re-checks for whatever may drift:

```bash
ls ~/projects/albunyaan-platform/supabase/migrations/                     # still 0001..0011?
wc -l ~/.albunyaan-cc/*.jsonl                                             # JSONL line counts
grep -o '"status":"[^"]*"' ~/.albunyaan-cc/uscreen-collection-status.jsonl | sort | uniq -c
set -a; source ~/.albunyaan-cc/cloud.env; set +a                          # then any count:
curl -s "$SUPABASE_URL/rest/v1/videos?select=id&bunny_video_id=not.is.null&limit=0" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" -H "Prefer: count=exact" -D - -o /dev/null | grep -i content-range   # migrated count
grep -n "check (status in" ~/projects/albunyaan-platform/supabase/migrations/0011_widen_export_manifest_status.sql   # CHECK still includes done/skip_no_hls?
grep -rn "skip_no_hls\|'done'" ~/projects/albunyaan-platform/worker/migrate-videos.ts | head            # pipeline still writes them?
ls ~/Backups/albunyaan-supabase/ && tail -5 ~/.albunyaan-cc/backup.log    # backup freshness/health
cat ~/Backups/albunyaan-supabase/$(ls ~/Backups/albunyaan-supabase | tail -1)/manifest.json             # latest per-table counts
plutil -p ~/Library/LaunchAgents/com.albunyaan.catalog-backup.plist | grep -A3 StartCalendarInterval    # still 03:30?
```
