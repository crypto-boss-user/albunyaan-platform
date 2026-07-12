---
name: albunyaan-failure-archaeology
description: >
  The settled-battle chronicle of the Albunyaan Uscreen-exit migration. Load this BEFORE
  touching worker/migrate-videos.ts, worker/lib/bunny.ts, or ~/.albunyaan-cc/migration-watchdog.sh
  for ANY reason — refactor, "simplification", cleanup, code review, or debugging. Load it when
  you see code that looks weird or redundant (explicit process.exit(0), deleteVideo() inside a
  catch block, nulling uscreen_hls_url on failure, an over-fetch ×5 with a skip-set, a ppid!=1
  awk in a shell script, a 25s Promise.race around a page.goto) and are tempted to remove it.
  Load it when a live symptom matches a past one: 403s from Mux, 0-byte Bunny videos, watchdog
  "HEALED hang" lines, harvest batches collapsing, macOS memory pressure, a round that prints
  "TRANSFER: N ready" then goes silent, a process that prints DONE but never exits, or temp
  mig-w*.mp4 files piling up. Every fix documented here looks like clutter to a fresh eye;
  removing any of them re-opens a documented incident.
---

# Albunyaan Failure Archaeology

This is the war-grave registry of the Uscreen→Bunny video migration (status as of
2026-07-12: ~1,584/15,861 videos migrated; all 197 published videos done). Between
2026-07-06 and 2026-07-12 this pipeline survived thirteen numbered critical bugs
plus the silent manifest-CHECK rejection (Battle 9). **Every one is FIXED in the
current code AND live.** The former honest caveat — Battles 4 and 6 wrote manifest
statuses (`skip_no_hls`, `done`) that the cloud DB's CHECK silently rejected — was
resolved 2026-07-12 by migration 0011 + commit `da5cced` (Battle 9; single home:
`albunyaan-data-and-schema-reference`, RESOLVED mismatch section). Each entry below is:
symptom → root cause → evidence → status (with the exact file and mechanism).

**The single rule of this skill: the fixes look like clutter. They are not.**
`process.exit(0)` after a promise, a `deleteVideo()` in a catch block, an awk
expression matching `ppid != 1`, a ×5 over-fetch — each of these is a scar. Removing
one re-opens the incident it closed, usually silently, usually overnight, usually
costing the founder's metered 400GB data bundle.

## When NOT to use this skill

| You want to… | Use instead |
|---|---|
| Run or resume the migration | `albunyaan-migration-runbook` |
| Diagnose a **live, currently happening** stall/failure | `albunyaan-migration-debugging-playbook` (this skill tells you what was already fixed; that one tells you what to do now) |
| Understand tables/columns (`videos`, `export_manifest`, …) | `albunyaan-data-and-schema-reference` |
| Call the Bunny API, clean the library | `bunny-operations` |
| Scrape Uscreen admin pages | `uscreen-scraping-reference` |
| Change any of the code documented here | `albunyaan-change-control` — mandatory, this skill only explains WHY the code is shaped this way |
| Repo layout / three-location map | `albunyaan-architecture-contract` |

## Glossary (terms used below, defined once)

- **Harvest**: Phase 1 of `worker/migrate-videos.ts` — a sequential Playwright loop over
  the shared Chrome (CDP port :9333) that opens each video's Uscreen admin page and
  captures its Mux HLS URL into `videos.uscreen_hls_url`.
- **Transfer**: Phase 2 — parallel workers (default `CONCURRENCY=5`) that ffmpeg-download
  each harvested HLS stream to a temp mp4 and `curl -T` upload it to Bunny Stream.
- **Mux token**: signed `?token=` JWT on the harvested HLS URL; lives ~159 minutes. Expired
  token ⇒ Mux returns `403 Forbidden`.
- **Orchestrator**: `~/.albunyaan-cc/migrate-overnight.sh` — bash loop: harvest batch →
  transfer batch → (every 5th round) poll. Runs `node_modules/.bin/tsx` directly (never
  `npx` — it hangs unpredictably).
- **Watchdog**: `~/.albunyaan-cc/migration-watchdog.sh` — LaunchAgent
  `com.albunyaan.migration-watchdog`, every ~5 min, no LLM. Kills a genuinely hung
  transfer child so the orchestrator self-resumes. Never restarts a down orchestrator
  (by design — the shared browser session needs a human).
- **Manifest**: `export_manifest` table, entity `video_migration` — per-video status
  (`fetched`/`done`/`failed`/`skip_no_hls`) + `last_error`. All four statuses persist
  since 2026-07-12 (migration 0011 widened the cloud CHECK — Battle 9). No backfill:
  `done`/`skip_no_hls` counts stay 0 until the next poll/harvest writes them — see
  `albunyaan-data-and-schema-reference`, RESOLVED mismatch section.
- **Twin Chrome**: Chrome for Testing with the founder's cloned profile at
  `--remote-debugging-port=9333 --user-data-dir=$HOME/.albunyaan-cc/chrome-emdb-clone`,
  holding the logged-in Uscreen admin session shared by every script.

---

## Battle 1 — The 0-byte Bunny orphan disaster (bug #9 + commit e380440)

**Symptom.** Bunny library `totalItems` = 6,017 while the DB had only 1,023 real
`bunny_video_id`s (2026-07-10). A 200-video sample of recent Bunny entries: **194/200
(97%) were 0-byte, status-0 empty placeholders**. The founder's mental model ("6,000
videos migrated!") was off by ~5,000.

**Root cause.** `transferWorker()` calls `createVideo()` (which instantly creates an
empty Bunny video object) **before** the ffmpeg download and upload. Any failure after
that point — overwhelmingly `403 Forbidden` on expired Mux tokens — left the empty
placeholder in the library forever. Over 4.5 days of `migrate.log`: **4,964 token-403
failures vs 1,102 successes** — ~80% of all transfer attempts were doomed before ffmpeg
even started, each burning a createVideo + ffmpeg + (later) deleteVideo round trip.

**Evidence.** Session memory bug #9 (2026-07-10 ~13:20); commit `e380440`
("stop wasting 80% of transfer attempts on expired Mux tokens") carries the counted
figures. Founder-approved bulk cleanup 2026-07-10 ~14:21 scanned 6,032 Bunny objects and
deleted 4,201 orphans; a second sweep 2026-07-11 ~23:20 deleted 409 more
(watchdog-false-kill-era debris, see Battle 2), bringing the library ≈ the tracked count.

**Status: FIXED**, two complementary mechanisms, both in current code:
1. **On-failure cleanup** — `worker/migrate-videos.ts`, `transferWorker()` catch block:
   `if (guid) await deleteVideo(cfg, guid).catch(() => {})`, with `deleteVideo()`
   implemented in `worker/lib/bunny.ts` (DELETE, 404-tolerant, 30s timeout).
2. **Preflight expired-token clear** — `transfer()` decodes each URL's token `exp` claim
   via `tokenExpSec()` and bulk-nulls `uscreen_hls_url` for anything expiring within
   5 min, so those videos re-harvest instead of burning a doomed attempt.

**Do not remove:** the `deleteVideo` in the catch (looks like optional tidying — it is
the only thing standing between every failure and a permanent Bunny orphan), nor the
preflight (looks like premature optimization — it is 80% of throughput on bad nights).
A residual-orphan sweep script exists but lives in an expired scratchpad
(`cleanup-bunny-orphans.py`) — UNVERIFIED whether the copy still exists; see
`bunny-operations` before writing a new one, and never bulk-delete without founder
approval.

---

## Battle 2 — Watchdog false-kill of healthy workers (bugs #8 + #12)

**Symptom.** Overnight 2026-07-10→11 the migrated count froze at 1,115 from ~18:30
onward while `watchdog.log` recorded "HEALED hang … reaped N orphans" every 15–20
minutes — **40 out of 40 rounds**. An entire evening of zero progress, with the watchdog
proudly logging each heal.

**Root cause (two layers, found a day apart).**
- *Bug #8 (2026-07-10)*: the "active work?" check only counted **ffmpeg** children. A
  worker mid-**upload** (curl PUT to Bunny) has no ffmpeg any more, so healthy
  multi-minute uploads read as hung and got killed. Caught red-handed: 3 curl processes
  with **PPID 1** (orphaned — parent already murdered mid-upload).
- *Bug #12 (2026-07-11 ~02:15) — the real killer since the day the watchdog was written*:
  `pgrep -f "migrate-videos.ts --transfer" | head -1` returns the **tsx WRAPPER** pid,
  but the workers' ffmpeg children belong to the **INNER node** pid (verified live:
  wrapper 14886, inner 14893, all 5 ffmpeg ppid=14893). So `active` was **always 0**,
  and every transfer that went log-quiet >5 min — i.e. every healthy long-form batch —
  was killed at the next cycle. Every "reaped N orphans" with N>0 in the old log was N
  healthy downloads being executed.

**Evidence.** `watchdog.log` 2026-07-08 entries ("HEALED hang: log 543s stale, 0 active
ffmpeg → … reaped 5 orphans"); session memory bugs #8/#12 with live pid topology. The
heal history before 2026-07-11 02:11 is retroactively untrustworthy. Deploy gotcha worth
remembering: the LaunchAgent's 5-min cycle **raced the edit** and executed the old code
one last time at 02:10:57 — when changing a LaunchAgent-run script, expect one stale
execution.

**Status: FIXED** in `~/.albunyaan-cc/migration-watchdog.sh`:
- The active check is pid-topology-proof — it counts ANY ffmpeg or bunny-curl **with a
  live parent**:
  `active=$(ps -eo ppid,args | awk '$1 != 1 && ($2 ~ /ffmpeg$/ || $0 ~ /video\.bunnycdn\.com/) && $0 !~ /awk/' | wc -l ...)`.
  `ppid==1` orphans deliberately do NOT count as active — if they did, leftover orphans
  from a prior kill would suppress healing forever.
- The kill step kills **all** matching pids (wrapper + inner), not `head -1` — killing
  only the wrapper leaves the inner node running headless.
- Orphaned **curl** uploads are SIGKILLed too (they survive SIGTERM): left alive they
  silently finish uploading to Bunny with nobody left to write `bunny_video_id` back —
  a duplicate, untracked video plus a wasted future re-transfer.
- A rejected alternative, on the record: adding a heartbeat `setInterval` log to
  `transfer()` was considered and **rejected** — it would keep the log fresh even with
  all workers stuck, blinding the stale-log hang signal entirely. Do not re-invent it.

Zero false kills since 2026-07-11 02:11. The hang discriminator ("log stale >5 min AND
zero live-parent ffmpeg/curl = real hang; quiet log + active children = healthy
long-form, leave it") is proven in both directions — see the CLAUDE.md migration
section, which states the same contract.

---

## Battle 3 — ffmpeg fixed 40-minute timeout SIGKILL loop

**Symptom.** Long lectures (the library has 31–136+ minute videos; a 136-min video is
~3.9GB) never completed: ffmpeg was SIGKILLed at exactly 40 minutes, the video requeued,
downloaded again, was killed again. **634 such SIGKILLs** in 4.5 days of migrate.log;
the worst videos failed **20+ times**, each attempt burning ~40 minutes of metered
bandwidth for nothing.

**Root cause.** `runFfmpeg()` had a hard-coded `40 * 60_000` kill timer — chosen when
the median video was a 15-minute episode, lethal for the long tail.

**Evidence.** Commit `e380440` (counts 634 kills, 20+ retries); the current code comment
above `localTranscodeUpload()` in `worker/migrate-videos.ts` preserves the numbers.

**Status: FIXED** in `worker/migrate-videos.ts` `localTranscodeUpload()`: the timeout is
now the Mux **token's remaining life** minus a 5-minute upload margin, floored at 10 min
and capped at 150 min (`tokenExpSec()` decodes the JWT `exp` claim; fallback 40 min if
the token is undecodable). A download that cannot finish inside its token's life is
doomed anyway — killing it exactly then is correct; killing it earlier was the bug.

**Do not remove:** `tokenExpSec()` looks like a one-off helper; it powers BOTH this
timeout and Battle 1's preflight.

---

## Battle 4 — Harvest batch collapse / `skip_no_hls` (bug #13)

**Symptom.** Overnight 2026-07-11, harvest yield collapsed round-over-round:
**60/60 → 12/48 failed → 3/57 failed**. The pipeline starved: transfer had nothing fresh
to work with while harvest ground the same failures forever.

**Root cause.** Permanently stream-less videos — the ~21 `status='live'` channels (no
VOD file) and a block of old drafts with dead sources — sit at the **front** of the
deterministic `order status desc` sort and were re-picked every round. Nothing ever
excluded them, so they occupied the whole 60-slot batch, forever.

**Evidence.** Session memory bug #13 (2026-07-11 ~03:50); the collapse figures live in
the code comment at the top of `harvest()`.

**Status: FIXED — fully live since 2026-07-12 (see the resolved caveat below).** In
`worker/migrate-videos.ts` `harvest()`, three parts:
1. `.neq('status', 'live')` — live channels excluded outright.
2. **Over-fetch ×5** (`.limit(limit * 5)`) then post-filter against a skip-set built from
   `export_manifest` rows with status `'skip_no_hls'`, sliced back to `limit`.
3. **Two-strike rule**: first `no_hls` failure writes manifest status `'failed'` (could
   be a slow page load); a **second consecutive** `no_hls` writes `'skip_no_hls'` =
   permanently skipped.

**Live-DB caveat — RESOLVED 2026-07-12 (migration 0011 + commit `da5cced`; Battle 9):**
until then the `'skip_no_hls'` write did NOT persist — the 0001 `export_manifest` CHECK
rejected it and `setManifest()` swallowed the error (`skip_no_hls` count was **0**; the
~110 candidates sat at `failed`/`no_hls`), so the skip-set was always empty and the ×5
over-fetch was the only mitigation actually operating. The CHECK now accepts
`skip_no_hls` (verified live) and manifest write failures are logged. No backfill:
strike state re-accumulates from scratch as future harvest runs write it, with the ×5
over-fetch still covering stream-less videos meanwhile (see
`albunyaan-data-and-schema-reference`, RESOLVED mismatch section).

**Do not remove:** the ×5 over-fetch looks wasteful and the two-strike bookkeeping looks
paranoid; together they are the only thing preventing the front of the sort from
re-clogging every batch. Related caution: manifest entries with
`last_error='no_hls'/'hard_timeout'` written 02:00–07:45 on 2026-07-11 may be
throttled-internet casualties, not genuinely dead videos — the two-strike rule gives
them another fair chance automatically; do not manually mark them dead.

---

## Battle 5 — Tab/memory blowup: macOS force-quit night (bug #10)

**Symptom.** The Mac ran out of application memory overnight (macOS "force quit
applications" dialog) — everything, including the migration, at risk of being killed by
the OS.

**Root cause.** `harvest()` called `ctx.newPage()` every round and **deliberately never
closed it** — an over-correction of the Battle 7-adjacent rule "never close the last CDP
page" (the correct rule is never close the *LAST* page, not never close *ANY* page).
Each leaked tab = a heavy Uscreen admin SPA that auto-loads a Mux player, ~150–300MB.
Dozens of rounds per night = dozens of tabs.

**Evidence.** Founder report + session memory bug #10 (2026-07-11 ~00:20); mechanism
documented in the `harvest()` tab-reuse comment.

**Status: FIXED**, belt and braces:
1. `worker/migrate-videos.ts` `harvest()` — **reuses** a tab (prefers a parked
   `about:blank`, then any Uscreen tab, creates only if the context is empty), **parks**
   it on `about:blank` at the end (navigate ≠ close, so the ≥1-page rule holds), and
   sweeps surplus `manage/videos/` tabs from HARD_TIMEOUT recreations or crashed runs.
2. `~/.albunyaan-cc/migration-watchdog.sh` **TAB-GC** — every 5 min, only when no
   harvest is running (`pgrep -f "migrate-videos.ts --harvest"` guard), if >1 Uscreen
   tabs exist: open `about:blank` **first** via `curl -X PUT :9333/json/new` (PUT is
   required on Chrome 111+), then close every Uscreen tab via `/json/close/<id>`.
   Fail-soft throughout, and placed BEFORE the hang-heal logic because that logic
   early-exits on several healthy paths.

**Do not remove:** the "open a blank page FIRST" line in TAB-GC looks redundant — it is
the guarantee that closing every Uscreen tab can never leave the browser page-less
(Battle 7's failure mode). Tabs verified bounded at 1 overnight 2026-07-11.

---

## Battle 6 — Poll starvation: the 72-minute freeze

**Symptom.** The orchestrator went silent 02:10→03:22 on 2026-07-11 (**72 minutes**, no
harvest, no transfer) every time the 5th-round `--poll` ran.

**Root cause.** `poll()` iterated **every** migrated video (1,115 and growing linearly)
with one Bunny API call + one manifest upsert each — and that night Bunny's API was also
degraded (~6.1s for a trivial GET vs ~0.3s normal, measured). The orchestrator runs poll
in the foreground, so the whole pipeline froze for the duration.

**Evidence.** Session memory bug #13 addendum (2026-07-11 ~03:50); the 02:10→03:22
window is preserved in the `poll()` code comment.

**Status: FIXED — fully live since 2026-07-12 (migration 0011 + commit `da5cced`;
Battle 9).** In `worker/migrate-videos.ts` `poll()`: videos already marked `'done'`
in the manifest are skipped, and BOTH reads — the manifest done-set and the
migrated-videos list — are **paginated in 1000-row `.range()` pages** because
Supabase REST silently clamps any range to 1000 rows (a hard-learned, repo-wide
lesson — see CLAUDE.md; the migrated-videos read used a silently-clamped
`.limit(5000)` until `da5cced`). Effect: poll cost proportional to still-encoding
videos. **Formerly-live caveat, RESOLVED 2026-07-12:** the `'done'` write was
rejected by the 0001 CHECK and `setManifest()` swallowed the error (`done` count
**0**), so the skip-set was always empty and every poll re-polled every migrated
video. Post-fix nuance: no backfill — the done-set starts empty, so the FIRST poll
after restart re-polls all ~1,584 migrated (one long round — expected, not a
regression), then shrinks as `done` rows accumulate. No poll has run since the fix
(migration paused as of 2026-07-12).

**Do not remove:** the pagination loop looks like it could be one `.select()` — it
cannot; the truncation is silent and the `done` set would quietly stop growing past
1000, re-inflating poll time.

---

## Battle 7 — Zombie CDP socket / the missing `process.exit(0)` (commit 98e3380)

**Symptom.** A run printed "HARVEST DONE" and then sat there as a live process — one
`--harvest 5` test process was confirmed **still alive 44+ minutes later**. The
orchestrator never advanced to transfer. Multiple zombie processes accumulated, all
holding CDP connections into the shared browser and navigating the same pages —
very likely the actual cause of the hCaptcha trigger and "stuck on the same page for
20 minutes" symptoms that were first misdiagnosed as separate issues.

**Root cause.** None of `harvest()/transfer()/poll()/dryHarvest()` ever called
`process.exit(0)` on success. Playwright's `connectOverCDP()` keeps an open WebSocket
that holds Node's event loop alive forever. And the orchestrator's `$TSX … | tee -a $LOG`
pipe blocks until the process **exits**, not until output stops — so the zombie also
silently stalled the bash loop between phases.

**Evidence.** Commit `98e3380` ("Fix root cause: missing process.exit(0) left zombie
processes all night") with the full 44-minute observation; the mechanism is preserved in
the comment block at the bottom of `worker/migrate-videos.ts`.

**Status: FIXED** — the dispatch promise ends in
`run.then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); })`.

**Do not remove:** an explicit `process.exit(0)` at the end of a script is a classic
lint-brain deletion target ("the process exits naturally"). Here it does not. This is
the single most tempting-to-delete line in the codebase.

**Sibling scar (same commit family, 958fd04):** a manual cleanup script once closed
EVERY page in the shared browser, which broke `connectOverCDP` for all future scripts
("Browser context management is not supported") until a page was reopened via the raw
CDP HTTP API (`curl -X PUT 'http://127.0.0.1:9333/json/new?about:blank'`). Hence the
hard rule: **never close the last page** — park on `about:blank` instead.

---

## Battle 8 — Temp mp4 leak (~5GB of `mig-w*.mp4` corpses)

**Symptom.** ~5GB of stale `mig-w*.mp4` files observed in `$TMPDIR` on 2026-07-11, on a
machine that was already fighting memory/disk pressure.

**Root cause.** Two leaks: (1) only the **success** path removed the temp file — a
failed or aborted download left its multi-GB partial behind; (2) the watchdog's temp
sweep lived only **inside the heal path**, so once transfers stopped hanging (Battle 2
fixed) the sweep never ran again.

**Evidence.** Watchdog script comment ("~5GB observed 2026-07-11"); session memory
2026-07-11 resume notes; earlier 2026-07-07 housekeeping purged 12 stale temps.

**Status: FIXED**, both ends:
1. `worker/migrate-videos.ts` `transferWorker()` catch block:
   `fs.rmSync(path.join(os.tmpdir(), \`mig-w${workerId}-${v.external_id}.mp4\`), { force: true })`.
2. `~/.albunyaan-cc/migration-watchdog.sh`: `find "$TMP" -name "mig-w*.mp4" -mmin +100 -delete`
   runs **every** watchdog cycle (before any early exit), plus a `-mmin +90` sweep inside
   the heal path. Active downloads write continuously so their mtime stays fresh —
   +100 min is safely dead; do not tighten it below a long download's write interval.

---

## Battle 9 — Silent manifest CHECK rejection + swallowed upsert error (migration 0011, commit `da5cced`)

**Symptom.** None at runtime — that was the problem. `migrate.log` looked healthy, but
live counts read `done` **0** and `skip_no_hls` **0** while ~1,584 videos were migrated;
every 5th-round poll printed `poll: finished 998, …` with the same number each round;
zero "known stream-less skipped" lines ever appeared. The defect was discovered not by
an alert but by **documentation authoring**: writing
`albunyaan-data-and-schema-reference` on 2026-07-12 forced a live re-count that
contradicted the code's intended semantics.

**Root cause.** Three stacked defects:
1. The 0001 `export_manifest` CHECK allowed only
   `('pending','fetched','parsed','upserted','failed')` — Postgres rejected the video
   pipeline's `'done'` and `'skip_no_hls'` writes.
2. `setManifest()` discarded the supabase-js error object (supabase-js *returns* errors
   instead of throwing), so the rejection was completely silent — for weeks.
3. Independently, `poll()` fetched migrated videos with `.limit(5000)`, silently clamped
   to 1,000 by PostgREST, so ~584 of 1,584 migrated videos were never polled at all.

Net effect: Battle 4's two-strike skip and Battle 6's done-skip were both inert in
production while appearing FIXED in code review.

**Evidence.** Live counts 2026-07-12: `fetched` 1,582 / `failed` 2,117 / `done` 0 /
`skip_no_hls` 0 (3,699 `entity=video_migration` rows); the 0001 CHECK definition;
`poll: finished 998, still encoding 0, failed 2` = exactly 1,000 processed with 1,584
migrated.

**Status: FIXED (2026-07-12, migration 0011 + commit `da5cced`, branch `exit-phase`).**
1. `supabase/migrations/0011_widen_export_manifest_status.sql` widens the CHECK to
   include `'done'` and `'skip_no_hls'` — **applied to the cloud DB and verified live
   2026-07-12** (constraint definition re-read; sentinel `done`/`skip_no_hls` rows
   inserted, persisted, deleted).
2. `setManifest()` in `worker/migrate-videos.ts` captures the error and logs
   `manifest write FAILED for <id> (<status>): <msg>`.
3. `poll()` paginates the migrated-videos read in 1000-row `.range()` pages.

No backfill: `done`/`skip_no_hls` counts stay 0 until future `--poll`/`--harvest` runs
write them (none yet — migration paused 2026-07-12, founder's call), and the first
post-restart poll re-polls all ~1,584 migrated before shrinking. Single authoritative
home for manifest truth: `albunyaan-data-and-schema-reference`, RESOLVED mismatch
section.

**Do not remove:** the `if (error) console.error(...)` line in `setManifest()` looks
like noise-logging — it is the only tripwire against this entire failure class. The
lesson generalizes: **a supabase-js write can fail without throwing; absence of an
error message is not confirmation that a write landed — count what actually
persisted.**

---

## Other settled battles (mined from commits, code comments, and session memory)

These are equally load-bearing; they just weren't in the headline nine.

| Battle | Symptom | Root cause | Fix (FIXED, where) |
|---|---|---|---|
| **curl OOM on big uploads** (bug #2, commit `fa919fa`, 2026-07-06) | 1.7GB video failed instantly, "curl: option --data-binary: out of memory"; would have silently killed most of the library | `curl --data-binary @file` reads the WHOLE file into memory (the original code comment claiming it streams was simply wrong) | `curl -T` (--upload-file) streams in chunks — `worker/lib/bunny.ts` `uploadFile()`. Never reintroduce `--data-binary` here |
| **spawnSync fake concurrency** (bug #4, commit `9623f97`, 2026-07-06) | CONCURRENCY=5 configured; direct sampling never showed >1 ffmpeg/curl running | `spawnSync` blocks Node's single JS thread for the whole child run — 5 workers silently took turns | async `spawn` + Promise on 'close'/'error' in both `runFfmpeg()` (migrate-videos.ts) and `uploadFile()` (bunny.ts). Verified: sustained 5 simultaneous ffmpeg. Rule is in CLAUDE.md: never `spawnSync` in worker code |
| **Stuck expired-token videos** (bug #6, 2026-07-07) | Published+migrated count flat at 56/197 for hours while drafts raced ahead; same external IDs 403ing every round | On failure, `uscreen_hls_url` was never cleared — harvest skips anything with a URL set, transfer retried the same dead token forever; ~141 published videos orphaned | catch block nulls `uscreen_hls_url` so the video re-enters harvest for a fresh token — `transferWorker()` in migrate-videos.ts. **This is the fail-closed contract; never "optimize" it away** (CLAUDE.md says the same) |
| **brew broke ffmpeg mid-run** (bug #7, 2026-07-07) | Every transfer failed instantly for 40 min (rounds 479–482: 0 migrated, 479 failed), `dyld: Library not loaded: libx265.215.dylib` | `brew install imagemagick` upgraded the shared `x265` formula, deleting the dylib ffmpeg 8.1 was linked against | `brew reinstall ffmpeg`. Standing rule (CLAUDE.md): avoid brew operations while migration runs, or verify ffmpeg immediately after |
| **Bunny API stall froze all 5 workers** (bug #11, 2026-07-11) | Round logs "TRANSFER: N videos ready" then total silence — no ✓/✗, no ffmpeg ever spawned | `createVideo()` used raw `fetch()` with no timeout; a stalled Bunny API call froze every worker before any child process existed | `AbortSignal.timeout(30_000)` on createVideo/fetchFromUrl/getVideo/deleteVideo — `worker/lib/bunny.ts` (`API_TIMEOUT_MS`). Partly a misdiagnosis of Battle 2, kept as verified defensive hygiene (Bunny genuinely degraded to ~6.1s/GET that night) |
| **1-hour upload cap burned the bundle twice** (2026-07-11) | A 1.1GB upload died at exactly 3600s on the slow shared line; file discarded; bundle paid again for the re-download | `--max-time 3600` too tight for multi-GB uploads at ~1.2MB/s shared across 5 workers | `--max-time 10800` (3h) + `--speed-limit 1024 --speed-time 60` (abort if <1KB/s for 60s catches genuinely dead uploads fast) — `uploadFile()` in bunny.ts |
| **caffeinate about to expire** (2026-07-06) | A `caffeinate -t 300` (5 min!) was the only thing keeping the Mac awake; sleep = everything silently paused all night, zero error | Wrong caffeinate invocation from an earlier session | Standard resume step uses `caffeinate -i -s -m -d -t 43200` (12h). Verify on resume: `pmset -g | grep sleep` should say "sleep prevented by caffeinate" |
| **5.3× Bunny storage bloat** (2026-07-06) | Storage cost per video ~5× the video size | Bunny library settings "Keep original files" AND "MP4 fallback" both ON (stored original + MP4 + HLS ladder) | Both turned OFF in the Bunny dashboard (`/stream/697882/encoding`); the player uses the HLS iframe embed. Not retroactive for already-uploaded videos. Dashboard SPA gotcha: reachable only with `waitUntil:'commit'` |
| **hCaptcha from concurrent admin loads** (design-era) | hCaptcha appeared once 3–4 admin video pages loaded at once; session at risk | Uscreen bot detection | Harvest is sequential, ONE page, 1.8s politeness delay (`page.waitForTimeout(1800)` in harvest()). Never parallelize harvest. (Some early "hCaptcha" sightings were actually Battle 7's zombie pileup — both fixes stand) |
| **npx hangs** (design-era) | Worker scripts hung unpredictably under `npx`/`npm exec` | Unresolved; not worth root-causing | Always the direct binary: `worker/node_modules/.bin/tsx worker/<script>.ts` from repo root, or `cd worker` first (no `node_modules/.bin` exists at the repo root; CLAUDE.md rule, orchestrator header comment repeats it) |
| **One video hung harvest 20+ min** (commit `958fd04`) | Single video blocked an overnight batch despite goto's own timeout — likely stale page/listener state after hours of navigations | Playwright page state degrades over long-lived sessions | Hard 25s `Promise.race` per video; on HARD_TIMEOUT: close page, recreate fresh, mark failed, continue — `harvest()` in migrate-videos.ts |
| **Cleanup script fought the live migration** (2026-07-10) | Watchdog heals continued for a few rounds AFTER the Battle 2 code fix deployed | The bulk orphan-cleanup script was hammering the same Bunny API concurrently with live transfers | Not a code fix — an operational lesson: don't run bulk Bunny operations while transfer rounds are active |

---

## The do-not-delete ledger

If you are reviewing, refactoring, or "simplifying" and meet any of these, STOP —
each maps to an incident above:

| Code that looks wrong | File | It is actually… |
|---|---|---|
| `run.then(() => process.exit(0))` | migrate-videos.ts | Battle 7 — without it the CDP socket holds the process alive forever and the orchestrator's tee pipe stalls |
| `deleteVideo(cfg, guid).catch(() => {})` in a catch block | migrate-videos.ts | Battle 1 — the only barrier against 0-byte Bunny orphans |
| `update({ uscreen_hls_url: null })` on failure | migrate-videos.ts | bug #6 — the re-harvest contract; removing it permanently strands videos |
| `.limit(limit * 5)` + skip-set + two-strike `skip_no_hls` | migrate-videos.ts | Battle 4 — prevents batch starvation (fully live since 2026-07-12: migration 0011 accepts `skip_no_hls`; the skip-set re-fills as future harvests write strikes — see Battles 4 and 9) |
| Token-based ffmpeg timeout (`tokenExpSec`, floor 10 / cap 150 min) | migrate-videos.ts | Battle 3 — a fixed timeout re-creates the 634-SIGKILL loop |
| Tab reuse + park-on-about:blank + surplus-tab sweep | migrate-videos.ts | Battle 5 — a `newPage()` per round re-creates the force-quit night |
| `fs.rmSync(...mig-w....mp4, { force: true })` in the catch | migrate-videos.ts | Battle 8 — failed downloads leak multi-GB temps |
| `ppid != 1` awk + kill-ALL-tpids | migration-watchdog.sh | Battle 2 — `head -1`/children-of-wrapper checks murder healthy workers |
| Orphan reap uses `kill -9` and includes curl | migration-watchdog.sh | orphans survive SIGTERM; orphaned curl silently uploads untracked duplicates |
| Temp sweep BEFORE the early-exit paths | migration-watchdog.sh | Battle 8 — inside the heal path it never runs on healthy nights |
| `curl -X PUT .../json/new` before closing tabs (TAB-GC) | migration-watchdog.sh | Battle 5/7 — closing the last CDP page breaks connectOverCDP for everyone |
| `curl -T` (never `--data-binary`) | lib/bunny.ts | bug #2 — OOM on >1GB files |
| async `spawn` (never `spawnSync`) | migrate-videos.ts + lib/bunny.ts | bug #4 — spawnSync serializes all "parallel" workers |
| `AbortSignal.timeout(30_000)` on every Bunny call | lib/bunny.ts | bug #11 — a stalled fetch freezes all workers pre-ffmpeg |
| `--max-time 10800 --speed-limit 1024 --speed-time 60` | lib/bunny.ts | 1h cap threw away paid-for bundle data |
| Sequential harvest + `waitForTimeout(1800)` | migrate-videos.ts | hCaptcha; parallel harvest risks the founder's admin session |
| Smallest-first `.order('duration_seconds', asc)` | migrate-videos.ts | metered-bundle economics (each video costs ~2× its size, down+up); founder-approved ordering — a change is a change-control matter |
| Rejected idea: heartbeat log in transfer() | (absent by design) | would blind the watchdog's stale-log signal — do not add |

---

## MODEL FITNESS

A Sonnet-class session may do **alone**:
- Read this archive; verify any fix still exists (Provenance commands below).
- Correlate a live symptom against these battles and report the match.
- Append a NEW settled battle to this file after founder confirmation, with evidence.
- Run read-only status checks (`/migration-status`, log greps, counts).

**STOP and tell the founder to switch to a stronger model / higher effort** before:
- Changing the watchdog hang-discriminator, its kill logic, or its ordering
  (Battle 2 was a pid-topology subtlety that survived three days of review).
- Changing `CONCURRENCY`, harvest batch size, politeness delay, or the
  smallest-first ordering (bundle economics + hCaptcha risk interact non-obviously).
- Touching ANY fail-closed path: the on-failure `uscreen_hls_url` null, the
  `deleteVideo` cleanup, the temp `rmSync`, the two-strike skip logic.
- Removing or "simplifying" anything in the do-not-delete ledger.
- Any bulk operation against the Bunny library (the API key can delete the entire
  library) or any query pattern change against Supabase with the service-role key
  (full DB bypass). Secrets stay in `~/.albunyaan-cc/*.env` (chmod 600) — reference by
  variable NAME only, never read or quote them.

All such changes also go through `albunyaan-change-control` regardless of model.

---

## Provenance and maintenance

Primary sources verified 2026-07-12: `worker/migrate-videos.ts`, `worker/lib/bunny.ts`,
`~/.albunyaan-cc/migration-watchdog.sh`, `~/.albunyaan-cc/migrate-overnight.sh`,
`~/.albunyaan-cc/watchdog.log`, repo git log (commits `fa919fa`, `958fd04`, `98e3380`,
`9623f97`, `e380440`, `0e26407`, `da5cced` on `exit-phase`), and session memory
`~/.claude/projects/-Users-a2020-Fable-5-PLAN/memory/albunyaan-platform-rebuild.md`
(bugs #2–#13 with timestamps and measurements).

Re-verify any claim before relying on it (all from `/Users/a2020/projects/albunyaan-platform`):

```bash
# Battle 1: on-failure Bunny cleanup + preflight still present
grep -n "deleteVideo(cfg, guid)" worker/migrate-videos.ts
grep -n "clearing .* expired-token URLs" worker/migrate-videos.ts
# Battle 2: pid-topology-proof active check + kill-all
grep -n 'ppid,args' ~/.albunyaan-cc/migration-watchdog.sh
grep -nF 'for tpid in $tpids' ~/.albunyaan-cc/migration-watchdog.sh
# Battle 3: token-runway ffmpeg timeout
grep -n "runwayMs" worker/migrate-videos.ts
# Battle 4: live-exclusion + over-fetch + two-strike
grep -n "neq('status', 'live')\|limit(limit \* 5)\|skip_no_hls" worker/migrate-videos.ts
# Battle 5: tab reuse/park + watchdog TAB-GC
grep -n "about:blank" worker/migrate-videos.ts ~/.albunyaan-cc/migration-watchdog.sh
# Battle 6: poll skips done + 1000-row pagination
grep -n "eq('status', 'done').range" worker/migrate-videos.ts
# Battle 7: explicit exit
grep -n "process.exit(0)" worker/migrate-videos.ts
# Battle 8: temp cleanup both ends
grep -n "mig-w" worker/migrate-videos.ts ~/.albunyaan-cc/migration-watchdog.sh
# Battle 9: widened CHECK + surfaced manifest errors + paginated poll read
grep -n "skip_no_hls" supabase/migrations/0011_widen_export_manifest_status.sql
grep -n "manifest write FAILED" worker/migrate-videos.ts
# bunny.ts scars: -T upload, timeouts, speed guards
grep -n '"-T"\|API_TIMEOUT_MS\|speed-limit' worker/lib/bunny.ts
# Commit provenance
git log --oneline | grep -iE "fix|zombie|concurrency|expired"
# Watchdog heal/false-kill history (heals before 2026-07-11 02:11 are tainted — Battle 2)
grep -c "HEALED" ~/.albunyaan-cc/watchdog.log
```

Volatile facts date-stamped 2026-07-12: migrated count (~1,584/15,861), orchestrator
DOWN since 2026-07-11 ~23:12 (founder-ordered pause; watchdog logs ORCHESTRATOR DOWN
every 5 min by design), bundle usage (~34GB/400GB per bundle-meter — earlier bundle
figures in memory refer to a prior bundle), Bunny library ≈ tracked count after the
2026-07-11 23:20 orphan sweep. Re-check counts via the `albunyaan-migration-runbook`
skill or `/migration-status` rather than trusting this page.

When a NEW battle is settled: append it here in the same symptom → root cause →
evidence → status format, add its scar to the do-not-delete ledger, and date-stamp it.
Delete nothing that is merely old — this file's value is that the graves stay marked.
