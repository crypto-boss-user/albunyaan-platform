---
name: albunyaan-validation-and-qa
description: >
  What counts as EVIDENCE on the Albunyaan platform (Uscreen exit). Load this
  whenever you are about to claim a number, declare a migration phase "done",
  verify counts against Supabase, run or extend the e2e harnesses
  (e2e-admin-gate / e2e-member-auth / e2e-playback-gate), run worker unit tests
  (phase1:test), run the web build gate (pnpm build), judge whether a video is
  truly migrated, interpret the morning report, or add any new automated check.
  Triggers: "verify", "how many", "is it done", "acceptance", "QA", "test",
  "counts don't match", "did the scrape work", "prove it works".
---

# Albunyaan — Validation & QA: what counts as evidence

This skill defines the project's evidence standard: how to count, what "done"
means per migration phase, which test harnesses exist and what each one proves,
and how to add new checks without weakening fail-closed behavior. All volatile
numbers are **as of 2026-07-12**.

Read `/Users/a2020/projects/albunyaan-platform/CLAUDE.md` first in every
session. Never contradict it.

## When NOT to use this skill

| You actually want to… | Use instead |
|---|---|
| Understand the three-location layout, tables, schema | `albunyaan-data-and-schema-reference`, `albunyaan-architecture-contract` |
| Start/resume/operate the video migration | `albunyaan-migration-runbook` |
| Diagnose a hung/failing migration run | `albunyaan-migration-debugging-playbook` |
| Learn why the code is shaped this way (past disasters) | `albunyaan-failure-archaeology` |
| Scrape Uscreen admin pages | `uscreen-scraping-reference` |
| Call the Bunny API / manage the Bunny library | `bunny-operations` |
| Cron jobs, watchdogs, reports, email/push automations | `albunyaan-ops-and-automations` |
| Change guarded code (concurrency, watchdog, fail-closed paths) | `albunyaan-change-control` — validation never authorizes a change |
| Env setup, pnpm workspace, dev servers | `albunyaan-build-and-env` |
| Overall replacement-campaign status and completeness tracking | `albunyaan-platform-replacement-campaign` |

## Vocabulary (each defined once)

- **Harvest / transfer**: the two phases of `worker/migrate-videos.ts` —
  harvest captures a tokenized Mux HLS URL per video (sequential, polite);
  transfer ffmpeg-downloads and uploads it to Bunny (parallel).
- **`export_manifest`**: cloud Supabase table (created in
  `supabase/migrations/0001_data_liberation.sql`), one row per
  `(entity, external_id)`. The video migration uses `entity='video_migration'`.
- **Local JSONL manifest**: a *different* manifest — `worker/lib/manifest.ts`
  writes `export-manifest.jsonl` on disk for the phase-1 Uscreen export. Unit
  tests cover this one; the video migration uses the cloud table. Don't mix
  them up.
- **Bunny encode status**: integer from Bunny's `getVideo` API
  (`worker/lib/bunny.ts`): `0 queued, 1 processing, 2 encoding, 3 finished,
  4 resolution-finished, 5 failed`.
- **Service role**: the Supabase key that bypasses RLS entirely. Full DB
  access — read-only use for validation; never paste it into output.
- **aal2**: Supabase auth "authenticator assurance level 2" — session upgraded
  by a verified TOTP factor. The admin gate requires it.
- **Entitlement**: row in `entitlements` that unlocks subscription playback.

## Running worker scripts — the direct tsx binary

Never `npx`/`npm exec` (CLAUDE.md rule — they hang unpredictably). As of
2026-07-12 the repo root has **no** `node_modules/.bin` (pnpm keeps only
`.pnpm/` there); the tsx binary lives in the worker package. From repo root:

```bash
cd /Users/a2020/projects/albunyaan-platform
worker/node_modules/.bin/tsx worker/<script>.ts
```

## 1. Verified-counts discipline

**Supabase REST silently clamps every page to 1000 rows.** A single
unpaginated read that returns 1000 rows is not a count — it is a truncation.
Two acceptable ways to count, and only these:

**A. Header count (`Prefer: count=exact`)** — for totals. This is the exact
pattern `~/.albunyaan-cc/morning-report.sh` and the `/migration-status`
command use:

```bash
set -a; source ~/.albunyaan-cc/cloud.env; set +a   # sourcing (executing) the file is required and allowed; READING it is what's forbidden — never cat/echo its values
curl -s --max-time 20 "${SUPABASE_URL}/rest/v1/videos?select=id&bunny_video_id=not.is.null&limit=1" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Prefer: count=exact" -I | tr -d '\r' | grep -i content-range
# → content-range: 0-0/1584   ← the number after "/" is the count
```

Add `&status=eq.published` for the published tier. Never quote or print the
key itself; only the count line.

**Denominator self-check (added 2026-07-12; single home — other skills point here):**
the totals **15,861** (all videos) and **197** (published) are hardcoded in prose,
reports, and scripts across the skill library and `morning-report.sh`, and will silently
go stale if the catalog changes. Re-derive them with the same pattern minus the
migration filter:

```bash
curl -s --max-time 20 "${SUPABASE_URL}/rest/v1/videos?select=id&limit=1" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Prefer: count=exact" -I | tr -d '\r' | grep -i content-range
# → …/15861 = the total-videos denominator; add &status=eq.published for the 197 denominator
```

**B. Pagination loop** — when you need the rows, not just the count. Reference
implementation: `poll()` in `worker/migrate-videos.ts` (reads `export_manifest`
in `.range(from, from+999)` steps, breaks when a page returns <1000). Any
supabase-js `.select()` that could exceed 1000 rows must loop like that, then
**verify the collected total against a header count**. This rule exists because
an unpaginated backup once silently captured a fraction of the catalog.

Red flags that a "count" is fake: exactly 1000; derived from one `.select()`
with no `.range()`; a scraper that printed 0 after an error (see §6).

## 2. Migration acceptance — when is ONE video migrated?

All three legs, in order. `bunny_video_id` being set is necessary, not
sufficient (the 0-byte-orphan disaster proved a Bunny GUID can point at an
empty placeholder — see `albunyaan-failure-archaeology`).

1. **Bunny encode `status >= 3 && status != 5`**: exactly the test in
   `poll()` (`migrate-videos.ts`): `>=3` and `!=5` → done; `==5` → encode
   failure (`bunny_encode_failed`); anything else → still encoding.
   Check via `--poll`'s printed summary
   (`worker/node_modules/.bin/tsx worker/migrate-videos.ts --poll`, needs
   `~/.albunyaan-cc/cloud.env` in env) or a per-guid `getVideo()` probe
   (`bunny-operations`).
2. **Manifest `status='done'` written by `--poll`** — functional again as of
   2026-07-12: migration 0011 widened the cloud CHECK to accept
   `done`/`skip_no_hls` (applied + verified live with sentinel rows) and
   `setManifest()` now logs `manifest write FAILED for <id> (<status>): <msg>`
   instead of swallowing the error (commit `da5cced`; single home:
   `albunyaan-data-and-schema-reference`, RESOLVED mismatch section).
   **Caveat: history was NOT backfilled** — the live `done` count stays **0
   until the next `--poll` run** (none yet as of 2026-07-12; migration
   paused). Before polls resume, a 0 count means "not yet written", not
   failure; once they resume, require this leg.
3. **Spot playback** (sample, not exhaustive): open the program page for a few
   of the videos on the dev site (`localhost:3010/programs/<slug>`) and see the
   player iframe actually play. The app emits a signed embed of the form
   `iframe.mediadelivery.net/embed/<libraryId>/<guid>?token=<64 hex>&expires=<10 digits>`
   (that exact shape is what `e2e-playback-gate.ts` asserts). For a single
   already-migrated video you can also probe from outside the app with
   `worker/verify-playback-lockdown.ts` (MODE=pre/post, cloud-safe, read-only
   HTTP probes).

Batch-level acceptance = `videos.bunny_video_id` non-null count (header
count, §1A) with a `--poll` run reporting zero still-encoding and zero
failed for the batch, plus passing spot playback. Since the 2026-07-12 fix
the manifest `done` count is a valid reconciliation target going forward —
but it remains 0 until the first post-fix `--poll` writes it (see leg 2's
caveat and §8).

## 3. Definition of done per migration phase (numbers as of 2026-07-12)

| Phase | Done means | Observable evidence (verified 2026-07-12) |
|---|---|---|
| Enumeration | Every Uscreen video row exists in `videos` | `ENUM_DONE total: 15861` — last line of `~/.albunyaan-cc/enum.log`. CLAUDE.md catalog line agrees: 15,861 videos / 686 collections / 25 categories / 425 people. **COMPLETE** |
| Structure import | Collections, items, categories, people linked; posters mirrored | `~/.albunyaan-cc/finalize.log` `DONE:` block — `videos: 15611, collections: 686, collection_items: 16150, categories: 25, video_categories: 17953, people: 425`, then `MIRROR_DONE mirrored=4174 skipped=52 failed=2` and `FINALIZE_DONE`. (The 15,611 predates final enum top-up to 15,861.) **COMPLETE** |
| Covers | Collection cover images applied + mirrored to own storage | `~/.albunyaan-cc/covers-finalize.log`: `COVERS_APPLIED 682` (of 686 scraped), `COVER_MIRROR_DONE done=682 skip=4 fail=0`, `COVERS_FINALIZE_DONE`. **COMPLETE** (4 skips = no source cover) |
| Video bodies | §2 acceptance per video, all 15,861 | `~/.albunyaan-cc/morning-report-2026-07-12.txt`: `1584/15861 total · 197/197 published`. Published tier (what the live site serves) **COMPLETE**; long tail ~10%, **IN PROGRESS**. Orchestrator DOWN since 2026-07-11 23:12 (by design never auto-restarts — shared browser needs a human; watchdog.log confirms every 5 min). Bundle: 34GB used of 400GB metered (`bundle-usage.log`; WARN 200 / auto-PAUSE 250 in `bundle-meter.sh`). |

The published *unit* for the storefront is **collections** (~692 published
collections per CLAUDE.md), not videos — don't report "197 published" as if it
were the whole live catalog surface.

Remember the campaign framing: the deliverable is a complete Uscreen
replacement (DB, apps, site, front+back end), not just video files moved.
"Done" claims about the *platform* belong to
`albunyaan-platform-replacement-campaign`; this skill only certifies the
measurable phases above.

## 4. The e2e harnesses (worker/)

All are Playwright scripts run with the direct tsx binary. All three below
**refuse to run against non-local Supabase** (they check `SUPABASE_URL` for
`127.0.0.1|localhost` and exit 2) because they create/delete users and rows.
They read `worker/.env` as env fallback. Exit code: 0 = all checks passed,
1 = any failure. They need the local Supabase stack + the web dev server up,
and (for the two auth ones) Mailpit at `127.0.0.1:54324`.

```bash
cd /Users/a2020/projects/albunyaan-platform
BASE_URL=http://localhost:3012 worker/node_modules/.bin/tsx worker/e2e-admin-gate.ts
BASE_URL=http://localhost:3010 worker/node_modules/.bin/tsx worker/e2e-member-auth.ts
BASE_URL=http://localhost:3012 worker/node_modules/.bin/tsx worker/e2e-playback-gate.ts
```

(Defaults if `BASE_URL` unset: member-auth 3010; admin-gate and playback-gate
3012.)

**e2e-admin-gate.ts** (WS7 admin security foundation) asserts, in a real
browser: anonymous `/admin` → redirect `/login`; logged-in **non**-admin →
**404** (existence not disclosed — not 403); admin at aal1 with no factor →
redirect `/admin/mfa/enroll`; TOTP enroll with a **real computed RFC-6238
code** → session aal2 → dashboard renders; a fresh login → `/admin/mfa`
step-up, real code unlocks; the enrollment landed in `admin_audit_log`.
Requires local Supabase with `[auth.mfa.totp]` enroll enabled (config.toml —
needs a stack restart); the harness detects and reports if it isn't.

**e2e-member-auth.ts** (WS3 member auth) asserts: `auth.admin.createUser`
links `people.auth_user_id` (0003 trigger); full magic-link flow through the
`/auth/confirm` interstitial — token hash is plain (not `pkce_`), a scanner's
bare GET sets **no** auth cookie and does not burn the token, the Continue
POST creates the session in a *different* browser context (cross-device);
unknown email on `/login` gets the same neutral "Check your email" state
(anti-enumeration); two-family isolation — family B sees only its own
profiles, A's PIN and the legacy 1234 PIN are rejected on B's `/parents`, a
forged `albn_profile` cookie carrying A's kid-profile id is ignored; email
change is double-confirm (`type=email_change`) and syncs `people.email`;
anonymous gets 200 on `/`, `/catalog`, `/programs/<slug>` and is redirected to
`/login` from `/account`, `/parents`, `/profiles`.

**e2e-playback-gate.ts** (WS5 entitlement gate) asserts all four gate states
on real program pages: anonymous + subscription video → paywall and the page
HTML contains **no** `iframe.mediadelivery.net` URL and **no**
`bunny_video_id`; anonymous + free video (live channel) → no paywall;
logged-in member without entitlement → the "renew" paywall variant, still no
embed; member with an active entitlement → player iframe whose src is
**signed** (`token=` 64 hex + `expires=` 10 digits — dev server must have
`BUNNY_EMBED_TOKEN_KEY` set). It temporarily sets a fake GUID on slug
`the-journey-to-the-high-morals-episode-1` and cleans up in `finally`.

Related harnesses (same invocation pattern): `worker/e2e-admin-crud.ts`
(admin videos/vouchers/members CRUD + audit, local-only),
`worker/verify-rls.ts` (RLS/grant matrix for migrations 0001–0008; safe
against cloud; `--no-members` skips the two-member checks),
`worker/verify-playback-lockdown.ts` (cloud-safe outside-in probe of
unsigned/signed/direct-CDN playback; MODE=pre baseline, MODE=post is the
lockdown acceptance test).

## 5. Unit tests and build gates

- **Worker unit tests**: root `package.json` → `"phase1:test": "pnpm --filter
  @albunyaan/worker test"` → worker `"test": "vitest run"`. Five suites in
  `worker/test/`: `email.test.ts` (normalizeEmail — lowercase+trim only, plus
  tags/gmail dots preserved), `export-dry-run.test.ts` (dry-run must never
  touch network/browser — deps throw on any touch), `import-people.test.ts`
  (runs against the REAL 2025-10-07 Uscreen people CSV in `worker/fixtures/`),
  `manifest.test.ts` (local JSONL manifest resumability), `process-events.test.ts`
  (store-first event processing). Run from repo root: `pnpm phase1:test`.
- **Web build gate**: `pnpm build` at repo root (→ `next build` for
  `@albunyaan/web`). This is the CLAUDE.md "build check" — run it before
  calling any web change done. Type gate: `pnpm --filter @albunyaan/web lint`
  (which is `tsc --noEmit`; there is no eslint here). Worker type gate:
  `pnpm --filter @albunyaan/worker typecheck`.
- There is no CI as of 2026-07-12 — these gates only run when you run them.

## 6. Honest-reporting rule: print `?`, never 0

A broken measurement must be *visibly* broken. `0` is a claim ("I looked,
there are none"); `?` is honesty ("I could not look"). Reference
implementation in `~/.albunyaan-cc/morning-report.sh`:

- `TOTAL=${TOTAL:-?}` — a failed count curl yields `?` in the report, not 0;
- deltas and the state file are **skipped** when the value is `?` (a bogus
  baseline would poison the next day's delta);
- the backup check prints `videos=?` if the manifest is unreadable.

Apply this to every scraper and report you touch: on selector miss, HTTP
error, timeout, or empty page where content is expected → print `?`/`UNKNOWN`
and exit non-zero (or set an explicit alert), never a silent zero. Scrapers
fail honest; they never guess.

## 7. Adding a new check without weakening fail-closed behavior

Rules for any new validation (script, assertion, report line):

1. **Checks fail the run.** New assertions must flip the exit code (the
   `check()`/`record()` + `process.exit(failed ? 1 : 0)` pattern in the e2e
   harnesses), not just print a warning.
2. **Never widen a catch.** The transfer failure path in `migrate-videos.ts`
   must keep all four steps: remove the temp mp4, null `uscreen_hls_url`
   (forces re-harvest with a fresh token), manifest `failed`, and
   `deleteVideo(guid)` for the empty Bunny placeholder. A "check" that
   swallows an error to keep its own numbers clean is a regression.
3. **Keep the local-only guard.** Anything that creates/deletes users or rows
   must retain the `127.0.0.1|localhost` refusal (exit 2). Cloud validation is
   read-only (header counts, paginated selects, HTTP probes).
4. **Count correctly** (§1) — a check that reads one unpaginated page can pass
   falsely at exactly the moment it matters.
5. **Unknown ≠ zero** (§6).
6. **Clean up in `finally` and on crash** — the harnesses purge their test
   users both before (stale-run debris) and after; copy that.
7. Changing an existing check's *threshold or semantics* (e.g. what encode
   status counts as done) is a change-control event → `albunyaan-change-control`.

## 8. Known validation caveats (honest edges)

- **Manifest `done`/`skip_no_hls` rejection — FIXED 2026-07-12** (migration
  `0011_widen_export_manifest_status.sql` + commit `da5cced`, branch
  `exit-phase`; the single authoritative home for the full history is
  `albunyaan-data-and-schema-reference`, RESOLVED mismatch section).
  Historically the 0001 CHECK rejected both statuses and `setManifest()`
  discarded its upsert error, so the rejection was *silent* — counts sat at
  `done` 0 / `skip_no_hls` 0, every poll re-polled all migrated videos, and
  harvest's skip-set was always empty. Now: the cloud CHECK accepts both
  (0011 applied + verified live with sentinel rows 2026-07-12),
  `setManifest()` logs `manifest write FAILED …` on error, and `poll()`
  paginates its reads. Remaining caveat: **no backfill** — `done` and
  `skip_no_hls` counts stay 0 until the next `--poll`/`--harvest` runs write
  them (none yet as of 2026-07-12; migration paused); two-strike skip state
  re-accumulates from scratch, with the ×5 over-fetch covering stream-less
  videos meanwhile; the first post-restart poll re-polls all ~1,584 migrated
  (long round — expected, then shrinks).
- `finalize.log`'s `videos: 15611` vs today's 15,861 denominator: enumeration
  completed after that finalize snapshot; 15,861 (CLAUDE.md, enum.log,
  morning report) is the authoritative total.
- Spot playback (§2 leg 3) is a manual sample as of 2026-07-12 — no script
  bulk-verifies playback of migrated videos. A bulk playback prober is an open
  candidate, not an existing tool.

## MODEL FITNESS (owner mandate)

A Sonnet-class session may do **alone**:
- Run every command in this skill: header counts, paginated counts, `--poll`,
  the three e2e harnesses, `pnpm phase1:test`, `pnpm build`, spot playback.
- Interpret the morning report / logs and report phase status using §3.
- Add a new **read-only** check that follows all seven rules in §7.
- Fix a check that broke for mechanical reasons (selector renamed, port moved).

**STOP and tell the founder to switch to a stronger model / higher effort**
before:
- Changing the acceptance thresholds themselves (encode-status semantics,
  what `done` means, the hang discriminator in the watchdog).
- Touching any fail-closed path: the transfer catch block, the preflight
  expired-token clear, the `uscreen_hls_url` nulling, placeholder deletion.
- Changing transfer `CONCURRENCY`, harvest politeness delay, or ordering.
- Relaxing the `export_manifest` check constraint or any RLS policy/grant
  (service-role-only data layer is BY DESIGN pre-launch).
- Removing or bypassing the local-only guards in the e2e harnesses.
Say explicitly: "This is a guarded validation path — escalate to a stronger
model/higher effort and go through albunyaan-change-control."

Secrets discipline: the service-role key bypasses the whole DB; the Bunny key
can delete the whole video library. Reference env vars by NAME
(`SUPABASE_SERVICE_ROLE_KEY`, `BUNNY_API_KEY`, `BUNNY_EMBED_TOKEN_KEY`); never
read, echo, or quote `~/.albunyaan-cc/*.env` contents.

## Provenance and maintenance (re-verify before trusting)

- Migration counts: rerun the §1A curl (total + `&status=eq.published`).
- Phase evidence: `tail -3 ~/.albunyaan-cc/enum.log ~/.albunyaan-cc/covers-finalize.log ~/.albunyaan-cc/finalize.log` and `cat ~/.albunyaan-cc/morning-report-$(date +%Y-%m-%d).txt`.
- Orchestrator/bundle state: `tail -2 ~/.albunyaan-cc/watchdog.log ~/.albunyaan-cc/bundle-usage.log`.
- Encode-status semantics: `grep -n "status >= 3" /Users/a2020/projects/albunyaan-platform/worker/migrate-videos.ts` and `grep -n "BUNNY_STATUS" worker/lib/bunny.ts`.
- e2e assertion sets: re-read the header comments of `worker/e2e-admin-gate.ts`, `worker/e2e-member-auth.ts`, `worker/e2e-playback-gate.ts`.
- Test wiring: `grep -n "phase1:test" package.json` and `grep -n '"test"' worker/package.json`.
- tsx binary location: `ls worker/node_modules/.bin/tsx` (root `node_modules/.bin` did not exist 2026-07-12).
- Ports: web dev 3010 (CLAUDE.md); harness defaults in each script's `BASE` line.
- Manifest constraint drift: `cat supabase/migrations/0011_widen_export_manifest_status.sql` (CHECK includes `done`/`skip_no_hls` since 2026-07-12) vs `grep -n "skip_no_hls\|'done'" worker/migrate-videos.ts`.
