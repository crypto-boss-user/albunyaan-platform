---
name: albunyaan-migration-debugging-playbook
description: >
  Symptom→triage playbook for the Uscreen→Bunny video migration. Load this when
  the migration looks wrong: migrate.log is stale/quiet, watchdog.log says
  ORCHESTRATOR DOWN or HEALED hang, migrate.log shows LOGGED OUT / 403 Forbidden
  storms / "0 videos to harvest" / ffmpeg "dyld Library not loaded" errors,
  counts stopped climbing, Bunny library count doesn't match the tracked count,
  disk fills with mig-w*.mp4 temps, a BUNDLE-ALERT flag appeared, or a suspected
  hCaptcha trip. NOT for normal start/stop/resume operations (use
  albunyaan-migration-runbook) and NOT for the war-story background (use
  albunyaan-failure-archaeology).
---

# Albunyaan migration debugging playbook

Triage runbook for the **Uscreen→Bunny video migration** — the pipeline that copies all 15,861 videos from Uscreen's Mux hosting into our own Bunny Stream library. State as of 2026-07-12: **~1,584/15,861 migrated; all 197/197 published videos DONE** (the live-site tier is complete). Orchestrator is DOWN since 2026-07-11 23:12 by the founder's explicit instruction ("dont run them tonight") — the watchdog logging `ORCHESTRATOR DOWN` every 5 minutes is *expected* right now, not a fault.

**Read `/Users/a2020/projects/albunyaan-platform/CLAUDE.md` before acting. Never contradict it.**

## When NOT to use this skill

| You actually want to… | Use instead |
|---|---|
| Start, stop, pause, or resume the migration (incl. restarting the orchestrator) | `albunyaan-migration-runbook` |
| Understand a past incident in depth (root cause, timeline) | `albunyaan-failure-archaeology` |
| Look up tables/columns (`videos`, `export_manifest`) or counts semantics | `albunyaan-data-and-schema-reference` |
| Operate the Bunny API (list/delete videos, orphan sweeps, library hygiene) | `bunny-operations` |
| Debug harvesting/scraping of Uscreen itself (selectors, admin pages) | `uscreen-scraping-reference` |
| Watchdog/bundle-meter/morning-report automation internals | `albunyaan-ops-and-automations` |
| Change ANY behavior of the pipeline (code or scripts) | `albunyaan-change-control` first |
| Env setup, tsx, pnpm, build issues | `albunyaan-build-and-env` |

## Vocabulary (each term defined once)

- **Orchestrator** — `~/.albunyaan-cc/migrate-overnight.sh`: infinite bash loop alternating HARVEST → TRANSFER, logging to `~/.albunyaan-cc/migrate.log`. Started manually with `nohup`; **never auto-restarted by anything, by design** (it needs the shared browser session a human must vouch for).
- **Harvest** — phase 1 of `worker/migrate-videos.ts` (`--harvest N`): sequential, ONE browser tab, visits each Uscreen admin video page via the twin Chrome, captures the Mux HLS URL into `videos.uscreen_hls_url`. 1.8 s politeness delay between page loads — concurrent admin loads tripped hCaptcha once.
- **Transfer** — phase 2 (`--transfer`): parallel (CONCURRENCY=5 workers, env-overridable), no browser. Each worker: `createVideo` on Bunny → ffmpeg pulls Mux HLS to `$TMPDIR/mig-w<worker>-<extId>.mp4` → `curl -T` PUT to Bunny → writes `videos.bunny_video_id` → deletes temp.
- **Mux token** — the `?token=` JWT on each harvested HLS URL; lives **~159 minutes**. Expired token ⇒ Mux answers 403. Transfer runs a **preflight** that bulk-clears `uscreen_hls_url` on any URL whose token expires within 5 min, so those videos re-harvest fresh.
- **Twin Chrome** — Chrome for Testing with the founder's cloned Uscreen admin profile, on CDP port **9333** (`--user-data-dir="$HOME/.albunyaan-cc/chrome-emdb-clone"`). Never close its last open page (breaks `connectOverCDP` for every future script).
- **Watchdog** — `~/.albunyaan-cc/migration-watchdog.sh`, LaunchAgent `com.albunyaan.migration-watchdog`, every ~5 min: TAB-GC, temp sweep, hang-heal. Logs to `~/.albunyaan-cc/watchdog.log`.
- **Bundle meter** — `~/.albunyaan-cc/bundle-meter.sh`, LaunchAgent `com.albunyaan.bundle-meter`: founder is on a metered **400 GB** bundle (each video costs ~2× its size: down + up). Warns at 200 GB (`BUNDLE-WARN` flag), **auto-pauses the migration at 250 GB** (`BUNDLE-ALERT` flag). 34 GB used as of 2026-07-12 18:43.
- **Manifest** — the `export_manifest` table (created in `supabase/migrations/0001_data_liberation.sql`), rows with `entity='video_migration'`. Statuses the pipeline writes: `fetched`, `failed`, `skip_no_hls`, `done` — all persist since 2026-07-12 (migration `0011` widened the CHECK; `setManifest()` now logs write failures — commit `da5cced`). No backfill: `skip_no_hls`/`done` counts stay 0 until the next harvest/poll runs write them. See `albunyaan-data-and-schema-reference`, RESOLVED mismatch section, before trusting those counts.

**Two traps to disarm immediately:** (1) `/Users/a2020/projects/albunyaan-command-center` is a *separate metrics dashboard* — it does not run the migration despite the name. (2) `supabase/migrations/0008_migration_state.sql` is *billing-cutover* state (`billing_migration_*` tables), not video-migration state; video-migration state lives in `videos.uscreen_hls_url` / `videos.bunny_video_id` + `export_manifest`.

## First 60 seconds — the standard health battery

The `/migration-status` slash command (`~/.claude/commands/migration-status.md`) runs this battery. Manually:

```bash
# 1. Is the orchestrator + a child alive?
ps aux | grep -iE "migrate-videos|migrate-overnight" | grep -v grep

# 2. Active workers (ffmpeg downloads / curl uploads with a LIVE parent)
ps -eo ppid,args | awk '$1 != 1 && ($2 ~ /ffmpeg$/ || $0 ~ /video\.bunnycdn\.com/) && $0 !~ /awk/'

# 3. Log freshness (compare mtime to now)
tail -5 ~/.albunyaan-cc/migrate.log; stat -f "%Sm" ~/.albunyaan-cc/migrate.log; date

# 4. What the watchdog thinks
tail -10 ~/.albunyaan-cc/watchdog.log

# 5. Counts (secrets: source only, NEVER print values)
set -a; source ~/.albunyaan-cc/cloud.env; set +a
curl -s --max-time 15 "${SUPABASE_URL}/rest/v1/videos?select=id&bunny_video_id=not.is.null&limit=1" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Prefer: count=exact" -I | grep -i content-range     # total migrated / 15861
# add &status=eq.published for the published tier (197 total)
```

Supabase REST **silently clamps any page to 1000 rows** — for counts always use `Prefer: count=exact` + `Content-Range` as above, never `length` of a fetched array. The denominators (15,861 total / 197 published) are hardcoded in prose and scripts and go stale silently — self-check them with the same query minus the bunny filter: `albunyaan-validation-and-qa` §1 (single home).

**⚠️ Log timestamp skew (verified 2026-07-12 in migrate.log):** the engine's bracketed `[HH:MM:SS]` lines are **UTC**, while run headers and `--- round ---` lines are **local CEST** — e.g. header `=== overnight migration run started Sat Jul 11 23:12:17 CEST 2026 ===` is immediately followed by `[21:12:21] HARVEST: …`, a 2-hour skew inside the same second. Never judge staleness by comparing an in-log `[HH:MM:SS]` to `date` output; use the file's mtime (battery step 3 / `stat -f %m`).

## Triage table

| # | Symptom | Discriminating check | Fix | Past incident |
|---|---|---|---|---|
| 1 | `migrate.log` stale > 5 min | `ps -eo ppid,args \| awk '$1 != 1 && ($2 ~ /ffmpeg$/ \|\| $0 ~ /video\.bunnycdn\.com/) && $0 !~ /awk/'` **then** `pgrep -f migrate-overnight.sh` | Active rows ⇒ healthy long download/upload — **LEAVE IT**. Zero rows + orchestrator pgrep EMPTY ⇒ **orchestrator DEAD, not hung** — go to symptom 5, do NOT SIGTERM anything. Zero rows + orchestrator alive ⇒ real hang: SIGTERM the `--transfer` pids only | Watchdog false-kill night 2026-07-08 (bug #8) |
| 2 | `LOGGED OUT` in migrate.log | `curl -s http://127.0.0.1:9333/json/list \| grep -c uscreen` (is twin Chrome even up?) | Founder logs back into `app.uscreen.tv/manage` in the twin Chrome window; orchestrator auto-probes every 5 min and resumes itself | Uscreen session expiry (recurring, by design) |
| 3 | Wave of `403 Forbidden` ffmpeg failures | `grep -c "403 Forbidden" ~/.albunyaan-cc/migrate.log` and check whether the SAME external_id repeats across rounds | Usually self-heals (token expiry → on-failure clear + preflight re-harvest). Worry only if the same id 403s round after round | Bug #6, 2026-07-07 (~141 published videos stuck on dead tokens) |
| 4 | `HARVEST: 0 videos to harvest` | Run the count query (battery step 5); check `TRANSFER: N videos ready` in log | 0 harvest + transfer backlog = normal drain; 0 harvest + `TRANSFER: 0 videos` = orchestrator prints `ALL VIDEOS MIGRATED` and exits cleanly | Harvest batch collapse 2026-07-11 (60/60 → 3/57) |
| 5 | Orchestrator DEAD: `ORCHESTRATOR DOWN` in watchdog.log, or stale log + NO `migrate-overnight.sh` process + zero ffmpeg/curl | `pgrep -f migrate-overnight.sh` (empty = confirmed dead) | Manual restart only — **by design, nothing auto-restarts it**. Follow the runbook's **FULL COLD RESTART** section; starting/resuming is a founder-go T3 decision (`albunyaan-change-control`) | Every deliberate pause (2026-07-08, 2026-07-11) |
| 6 | Suspected hCaptcha trip (harvest frozen at 0% CPU) | `pgrep -fl "migrate-videos"` — more than the orchestrator's one child = zombie processes fighting for the browser | Kill zombies first; if a captcha is truly on-screen in twin Chrome, founder solves it by hand. Never add harvest concurrency | hCaptcha 2026-07-06 (later traced mostly to zombie CDP processes) |
| 7 | `ffmpeg exit null: dyld[…]: Library not loaded: …libx265…dylib` | `ffmpeg -version` (fails or warns) AND the dyld lines are AFTER the latest `run started` marker (§7 recency check — 617 historical dyld lines predate clean rounds) | `brew reinstall ffmpeg`, verify `ffmpeg -version` exits 0. Historical-only dyld hits + healthy `ffmpeg -version` ⇒ do nothing | brew upgrade mid-run, 2026-07-08 (outer4 log ~14:49) |
| 8 | Bunny library count > tracked count / duplicate videos | `ps -eo pid,ppid,comm \| awk '$2==1 && $3 ~ /curl/'` (orphaned uploads) | `kill -9` orphaned curl; reconcile/delete untracked Bunny entries via `bunny-operations` | Orphaned-upload duplicates (watchdog heal path note, 2026-07-11) |
| 9 | Disk filling with temp mp4s | `ls -lh "${TMPDIR:-/tmp}"mig-w*.mp4` | `find "${TMPDIR:-/tmp}" -name "mig-w*.mp4" -mmin +100 -delete` (watchdog also sweeps every 5 min) | ~5 GB leak found 2026-07-11 |
| 10 | Migration stopped + `BUNDLE-ALERT` flag exists | `ls ~/.albunyaan-cc/BUNDLE-ALERT; tail -3 ~/.albunyaan-cc/bundle-usage.log` | This is the intended auto-pause at 250 GB. **Founder decides** whether to resume — do not restart on your own | Founder's metered-bundle mandate ("if it ever hits like 250GB… we will stop a bit") |
| 11 | High harvest failure rate — `harvested N (M failed)` lines with big M (e.g. `harvested 10 (8 failed)`) | `grep -E "harvested [0-9]+ \(" ~/.albunyaan-cc/migrate.log \| tail -12` for the cross-round trend; failure REASONS are not in the log — read recent `export_manifest.last_error` (query in §11) | Mostly `no_hls` ⇒ stream-less batch churn, see symptom 4. `hard_timeout`/goto errors ⇒ Uscreen session degrading (often precedes LOGGED OUT, symptom 2), slow admin pages, or network. Also rule out a second process hitting Uscreen (politeness violated, symptom 6). **Escalate** if a high rate persists across ~3 consecutive rounds with non-`no_hls` errors or repeating external_ids | `[20:41:39] harvested 10 (8 failed)` observed 2026-07-11 round 5, just before the night pause |

## Detail per symptom

### 1. Stale log — the hang discriminator (the single most important check)

A quiet `migrate.log` does **NOT** mean a hang. Long-form videos (multi-GB lectures) legitimately download/upload for 30–100+ minutes with zero log output. The proven discriminator:

- **Quiet log + ACTIVE ffmpeg/curl children with a live parent (`ppid != 1`) = healthy. LEAVE IT.**
- **Log stale > 5 min + ZERO active children = real hang → SIGTERM the transfer only.**

```bash
# age of the log in seconds
echo $(( $(date +%s) - $(stat -f %m ~/.albunyaan-cc/migrate.log) ))

# active check — MUST filter ppid != 1. Orphans (ppid 1) do NOT count as active:
ps -eo ppid,args | awk '$1 != 1 && ($2 ~ /ffmpeg$/ || $0 ~ /video\.bunnycdn\.com/) && $0 !~ /awk/'
```

**Before killing anything, confirm the orchestrator is even alive:** `pgrep -f
migrate-overnight.sh`. No output ⇒ the whole process tree is GONE — that is symptom 5
(orchestrator dead), not a hang: there is nothing to SIGTERM and nothing will self-resume.
Go to the runbook's FULL COLD RESTART (founder-go T3) instead of the kill sequence below.

If (and only if) stale + zero active + orchestrator alive:

```bash
kill $(pgrep -f "migrate-videos.ts --transfer")       # SIGTERM BOTH tsx wrapper + inner node
sleep 2
# orphaned ffmpeg/curl reparent to launchd (ppid 1) and survive SIGTERM — SIGKILL them.
# Orphaned curl especially: it would finish uploading to Bunny with no process left
# to write bunny_video_id → untracked duplicate (see symptom 8).
for p in $(ps -eo pid,ppid,comm | awk '$2==1 && $3 ~ /ffmpeg|curl/ {print $1}'); do kill -9 "$p"; done
```

The orchestrator's `| tee` pipe unblocks and the `while true` loop self-resumes within ~1 min — **do not restart the orchestrator**. The watchdog does exactly this automatically every 5 min; you only do it by hand if the watchdog itself is broken.

Why `ppid != 1` matters (incident, fixed 2026-07-11): the old watchdog matched children of `pgrep | head -1`, which is the **tsx wrapper** pid — the workers' ffmpeg children belong to the **inner node** pid, so "active" was always 0 and the watchdog killed 5 healthy long downloads every pass ("reaped 5 orphans" over and over; zero videos landed all evening). Never re-derive "active" from a specific parent pid; parent-alive matching is pid-topology-proof.

### 2. LOGGED OUT — founder re-login flow

Signature in `migrate.log`: `USCREEN LOGGED OUT — stopping harvest.` then `Uscreen session died — waiting for re-login (checking every 5 min)...`. The orchestrator probes with `--harvest 1` every 5 min and resumes by itself once the session is back. Your job is only:

1. Confirm twin Chrome is alive: `curl -s --max-time 5 http://127.0.0.1:9333/json/list | head -c 200`. If dead, relaunch per `albunyaan-build-and-env` §7 (the single home for the launch command — it resolves the `chromium-*` path drift; flags per repo `CLAUDE.md`).
2. Tell the **founder** to open the twin Chrome window and log into `https://app.uscreen.tv/manage` (fitrahmedia account). You cannot do this — it's his session/credentials.
3. Watch for `session restored, resuming.` in the log.

### 3. 403 storms — expired Mux tokens

Mux tokens live ~159 min. Both defenses are already in `worker/migrate-videos.ts` — **never "optimize" either away** (fail-closed contract):

- **On-failure clear**: transfer's catch nulls `videos.uscreen_hls_url` (and deletes the empty Bunny placeholder) so the video re-harvests with a fresh token. Before this existed (bug #6, 2026-07-07), ~141 published videos were permanently stuck retrying dead URLs.
- **Preflight**: `TRANSFER: clearing N expired-token URLs for re-harvest (preflight)` — bulk-clears tokens expiring within 5 min before spawning any worker.

Normal: a modest 403 tail when transfer reaches the end of a batch harvested >2.5 h ago, or one big preflight-clear wave right after resuming from a long pause. **Worry when**: the same external_id logs 403 across multiple rounds (means the clear isn't happening — code regression; stop and escalate, see MODEL FITNESS), or 403s with *fresh* tokens (Mux-side change; escalate).

### 4. "0 videos to harvest" ≠ done

Harvest only selects rows with `uscreen_hls_url IS NULL` **and** `bunny_video_id IS NULL` (source `uscreen`, `status != 'live'`, minus `skip_no_hls`-marked manifest rows). So `HARVEST: 0 videos to harvest` just means nothing needs a fresh token *right now* — thousands can still be pending transfer. The orchestrator already handles this: on 0-harvest it runs a transfer check; only `TRANSFER: 0 videos` too ⇒ `ALL VIDEOS MIGRATED … Done.` and a clean exit.

Related non-bug: live channels (`status='live'`) have no VOD file and are excluded outright; other stream-less videos get two `no_hls` strikes then — *by intention* — manifest status `skip_no_hls` forever. The two-strike + over-fetch (`limit*5`) logic is what addressed the 2026-07-11 harvest collapse (stream-less videos re-occupied every batch: 60/60 → 3/57 overnight). To count parked rows:

```bash
curl -s "${SUPABASE_URL}/rest/v1/export_manifest?select=external_id&entity=eq.video_migration&status=eq.skip_no_hls&limit=1" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Prefer: count=exact" -I | grep -i content-range
```

**This query returning 0 is expected for now, and no longer a bug.** Until 2026-07-12
the cloud DB's 0001 CHECK silently rejected `skip_no_hls` (and `done`) writes and
`setManifest()` swallowed the error — FIXED that day by migration
`0011_widen_export_manifest_status.sql` (applied + verified live) and commit `da5cced`
(`setManifest()` now logs `manifest write FAILED …`). But history was NOT backfilled:
the ~110 stream-less candidates still sit at `failed`/`last_error='no_hls'`, and the
count stays 0 until future harvest runs re-accumulate two-strike state (the ×5
over-fetch covers them meanwhile). See `albunyaan-data-and-schema-reference`, RESOLVED
mismatch section, before interpreting `done`/`skip_no_hls` counts.

### 5. ORCHESTRATOR DOWN — manual restart by design

`ORCHESTRATOR DOWN (migrate-overnight.sh not running) — needs manual restart (shared browser/session).` every ~5 min in `watchdog.log` is the watchdog no-op'ing, not failing. Nothing will ever auto-restart the orchestrator: it depends on the twin Chrome's human-vouched Uscreen session and the founder's bundle budget. Check first whether the founder paused it deliberately (as on 2026-07-11: down since 23:12 is intentional). The same dead state can present as symptom 1 first (stale log, zero ffmpeg/curl) — the discriminator is an empty `pgrep -f migrate-overnight.sh`. Restart procedure (twin Chrome check → `caffeinate` → `nohup bash ~/.albunyaan-cc/migrate-overnight.sh`) is the **FULL COLD RESTART** section of `albunyaan-migration-runbook` — follow it there by name; don't improvise flags. Actually starting/resuming the orchestrator is a founder-go T3 decision (`albunyaan-change-control` sign-off list) — diagnose freely, restart only with an explicit founder go in the current conversation.

### 6. hCaptcha trips

Original trigger: 3–4 *concurrent* Uscreen admin page loads. Harvest has been strictly sequential (one tab, 1.8 s delay) ever since — a captcha now almost always means **something else is also hitting Uscreen** through the shared browser:

```bash
pgrep -fl "migrate-videos"        # >1 tsx child besides the orchestrator's = zombies
curl -s http://127.0.0.1:9333/json/list | /usr/bin/python3 -c 'import json,sys; [print(t["url"]) for t in json.load(sys.stdin) if t.get("type")=="page"]'
```

Kill stray `migrate-videos` processes (the 2026-07-06 "captcha" was very likely a zombie process holding the CDP socket — `process.exit(0)` fix landed since). If a captcha is genuinely rendered, the founder solves it by hand in the twin Chrome window. The fix is never "add concurrency handling" — harvest stays sequential, period.

### 7. ffmpeg dylib breakage

Signature (verified in `migrate-overnight-outer4.log`): `ffmpeg exit null: dyld[…]: Library not loaded: /opt/homebrew/opt/x265/lib/libx265.215.dylib`. Cause: a `brew install/upgrade` (even of something unrelated) bumped a shared lib under ffmpeg mid-run. Every transfer fails instantly with `exit null`.

**Recency check first (added 2026-07-12):** migrate.log is appended forever and carries
**617 historical dyld lines** (the 2026-07-08 incident, log lines ~18754–20032) that
predate many later clean rounds. Only dyld lines AFTER the most recent
`=== … run started …` marker mean ffmpeg is broken NOW:

```bash
tail -n +$(grep -n "run started" ~/.albunyaan-cc/migrate.log | tail -1 | cut -d: -f1) \
  ~/.albunyaan-cc/migrate.log | grep -c dyld     # 0 = historical only, do nothing
```

If (and only if) that count is nonzero, or `ffmpeg -version` itself fails:

```bash
ffmpeg -version || brew reinstall ffmpeg && ffmpeg -version
```

Failures already re-queued themselves (uscreen_hls_url cleared, placeholders deleted) — no manual repair needed after the reinstall. Avoid running `brew upgrade` while the migration is live.

### 8. Orphaned curl uploads → untracked Bunny duplicates

If a transfer process dies (watchdog kill, crash, bundle pause) while a worker is mid-upload, the `curl -T` child reparents to launchd (ppid 1) and **keeps uploading**. It finishes; Bunny gets a full video; but the process that would have written `videos.bunny_video_id` is dead — so the video is untracked, will be re-transferred later, and the library gains a duplicate. The watchdog heal path SIGKILLs orphaned curl for exactly this reason.

```bash
ps -eo pid,ppid,comm | awk '$2==1 && $3 ~ /curl/'    # any output right after a kill/pause = act
```

`kill -9` them. Library-side reconciliation (finding Bunny entries whose guid appears in no `videos.bunny_video_id` row and deleting them) is `bunny-operations` territory. Historical note: the 2026-07-10 **0-byte orphan disaster** (97% of the 6,017 Bunny entries were empty — createVideo succeeded, then ffmpeg/upload 403'd on expired tokens) is the *inverse* shape: empty placeholders, fixed by on-failure `deleteVideo` in the worker. Both patterns make "Bunny count ≠ tracked count" your reconciliation trigger.

### 9. Temp file sweep

Worker temps: `$TMPDIR/mig-w<worker>-<extId>.mp4`. Success deletes them; the failure path deletes its own; but kills/crashes leak multi-GB files (~5 GB observed 2026-07-11). The watchdog now sweeps `-mmin +100` on **every** run. Manual:

```bash
ls -lh "${TMPDIR:-/tmp}"mig-w*.mp4 2>/dev/null
find "${TMPDIR:-/tmp}" -name "mig-w*.mp4" -mmin +100 -delete
```

Never delete younger files — active downloads write continuously so their mtime stays fresh; +100 min is safely dead. (The watchdog sweep is purely age-based: `-mmin +100` on every run, `-mmin +90` inside its heal path — no size threshold; verified 2026-07-12 in `migration-watchdog.sh`.)

**When to investigate (concrete thresholds, added 2026-07-12):** any `mig-w*.mp4` present while `pgrep -f "migrate-videos.ts --transfer"` is empty = leaked, regardless of age — sweep and find what died. During an active transfer, normal steady state is ≤5 in-flight files (one per CONCURRENCY=5 worker, smallest-first queue so usually small); more than 5 files, or a combined `du -ch` total past ~2 GB, deserves a look before it becomes the ~5 GB pile-up observed 2026-07-11.

### 10. Bundle pause

`~/.albunyaan-cc/BUNDLE-ALERT` exists + `STOP: … migration PAUSED, founder to decide` in `bundle-usage.log` ⇒ the meter crossed 250 GB and killed the orchestrator + workers + orphans on purpose. **This is a founder-decision gate, not a fault** — never restart the migration over it yourself. If the founder approves a resume after a bundle renewal, the meter's baseline (`bundle-state.txt`), hardcoded `PREUSED_GB=30`, and the two flags need resetting — that procedure is `albunyaan-ops-and-automations`; the restart itself is `albunyaan-migration-runbook`. Current usage: `tail -1 ~/.albunyaan-cc/bundle-usage.log` (34 GB of 400 as of 2026-07-12 18:43).

### 11. High harvest-side failure rate

Signature: the every-10 progress line `[HH:MM:SS]   harvested N (M failed)` with a big M, or `HARVEST DONE: N harvested, M failed`. Real example (2026-07-11 22:41 CEST, round 5): `harvested 10 (8 failed)` — the founder paused for the night ~30 min later. Triaged retroactively 2026-07-12 with the query below: all 8 were `last_error='no_hls'` (stream-less batch churn — benign, first bullet).

Harvest failures log **no per-video reason** to migrate.log (verified in `harvest()` — only the counters). The reasons land in `export_manifest.last_error`: `no_hls` (page loaded, no Mux stream), `hard_timeout` (25 s per-video cap), or a truncated exception message. Pull the recent mix:

```bash
# after the battery's source line; prints ids + reasons only, no secrets
curl -s --max-time 15 "${SUPABASE_URL}/rest/v1/export_manifest?select=external_id,last_error,updated_at&entity=eq.video_migration&status=eq.failed&order=updated_at.desc&limit=30" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"
```

Read the mix:

- **Mostly `no_hls`** → a batch dense in stream-less videos. Expected churn while the `skip_no_hls` skip-set re-accumulates from scratch after the 2026-07-12 fix (symptom 4 / RESOLVED mismatch — no backfill of prior strikes); the ×5 over-fetch covers them meanwhile. Not an emergency.
- **`hard_timeout` / goto or navigation errors** → the Uscreen admin session is degrading (often the prelude to a full `LOGGED OUT`, symptom 2), admin pages are slow, or the network is. Check twin Chrome liveness and watch the next round.
- **Anything suggesting a second actor on the shared browser** (harvest frozen, extra `migrate-videos` pids) → politeness violated, symptom 6.

**Escalate** (MODEL FITNESS: stop, founder + stronger model) when a high failure rate persists ~3 consecutive rounds with non-`no_hls` errors, or the SAME external_ids fail round after round — both smell like a regression or an Uscreen-side change, not weather.

## Secrets discipline

`~/.albunyaan-cc/cloud.env` (and the other `*.env` files there) are chmod-600 and hold `SUPABASE_SERVICE_ROLE_KEY` (**full RLS bypass on the whole DB**) and `BUNNY_API_KEY` (**can delete the entire video library**). Load them only via `set -a; source ~/.albunyaan-cc/cloud.env; set +a`; never `cat`, echo, or paste values into logs, commits, or chat. (No contradiction: **sourcing EXECUTES the file** so the vars enter your shell — required and allowed; what the never-open rule forbids is READING/printing its contents into context or logs.) RLS is deny-by-default and the data layer is service-role-only **by design** at this stage.

## MODEL FITNESS — what a Sonnet-class session may do alone

**OK alone (mechanical, reversible, covered above):**
- Run the health battery / `/migration-status`; read logs; run count queries.
- Apply the hang discriminator and SIGTERM a confirmed-hung transfer child; SIGKILL ppid-1 ffmpeg/curl orphans.
- `brew reinstall ffmpeg`; sweep `mig-w*.mp4` temps older than 100 min.
- Relay the LOGGED OUT re-login request to the founder; restart the orchestrator per `albunyaan-migration-runbook` after a founder-approved resume.

**STOP — tell the founder to switch to a stronger model / higher effort (and go through `albunyaan-change-control`):**
- Any change to the watchdog's hang-discriminator logic (`active=` line, ppid semantics, thresholds) — one wrong character silently killed a whole night's work once.
- Changing transfer `CONCURRENCY`, harvest sequentiality, the 1.8 s politeness delay, or batch sizes.
- Touching any fail-closed path: on-failure `uscreen_hls_url` nulling, `deleteVideo` placeholder cleanup, the token preflight, the two-strike `skip_no_hls` logic, temp-cleanup ages.
- Bulk operations against the Bunny library (mass delete/reconcile) — the API key can destroy everything.
- Editing bundle-meter thresholds/baselines, schema changes, or anything in `supabase/migrations/`.
- Diagnosing a symptom NOT in the table above whose fix would modify code.

## Provenance and maintenance

All claims verified 2026-07-12 against the live repo, scripts, and logs. Re-verify before trusting, in one line each:

- Pipeline behavior/flags: `sed -n '1,60p' ~/projects/albunyaan-platform/worker/migrate-videos.ts` (and read the rest — it is the ground truth for §§1,3,4,9).
- Watchdog discriminator + sweeps: `cat ~/.albunyaan-cc/migration-watchdog.sh`
- Orchestrator loop / LOGGED OUT / done-detection: `cat ~/.albunyaan-cc/migrate-overnight.sh`
- Bundle thresholds + flags: `grep -E "WARN_GB|STOP_GB|PREUSED_GB|ALERTFLAG" ~/.albunyaan-cc/bundle-meter.sh`
- Health battery source: `cat ~/.claude/commands/migration-status.md`
- Bunny client (curl -T, timeouts, status codes): `cat ~/projects/albunyaan-platform/worker/lib/bunny.ts`
- Current counts: morning report `cat ~/.albunyaan-cc/morning-report-$(date +%F).txt` or the REST count query in the battery.
- Orchestrator up/down right now: `pgrep -f migrate-overnight.sh; tail -3 ~/.albunyaan-cc/watchdog.log`
- Volatile numbers in this file (migrated counts, bundle GB, "orchestrator down since") drift daily — trust the commands, not the prose, after 2026-07-12.
