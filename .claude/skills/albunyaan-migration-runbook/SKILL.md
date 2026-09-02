---
name: albunyaan-migration-runbook
description: >
  Operate the Uscreen→Bunny video migration end to end: start it from cold, check its
  health, pause it, resume it, and understand every moving part (orchestrator loop,
  harvest/transfer/poll phases, watchdog, bundle meter). Load this skill whenever a
  session must RUN or RESTART the migration, respond to "is the migration running?",
  "resume the migration", "orchestrator down", "restart migrate-overnight", "pause the
  migration", "bundle alert", watchdog "ORCHESTRATOR DOWN" log lines, or anything
  touching ~/.albunyaan-cc/migrate-overnight.sh or worker/migrate-videos.ts as an
  OPERATOR. Not for debugging novel failures (use albunyaan-migration-debugging-playbook)
  or editing the pipeline code (use albunyaan-change-control first).
---

> **⛔ ACHTERHAALD OP DIT PUNT — teambesluit 2026-09-02: het Bunny-account is door de eigenaar GESTOPT.**
> Het volledige originelen-archief staat geverifieerd op de NAS (16.024/16.024, sha256). Bunny is GEEN actieve
> dependency meer: niets uitvoeren richting Bunny, geen script/wachter mag een levend account aannemen, de
> saldo-bewaker is uit, de requality-ronde (±$300) vervalt, en `bunny_video_id`/showcase-play-links zijn dood
> (nooit meer als "werkend" rapporteren). Alles hieronder is historische referentie tot er een opvolger-platform
> gekozen is. Zie memory `bunny-account-gestopt` en CLAUDE.md.

# Albunyaan migration runbook — run and operate the Uscreen→Bunny video migration

You are operating a live, long-running data migration on the founder's personal Mac over a
**metered 400GB internet bundle**. Every command here is verified against the actual files
as of **2026-07-12**. Read `/Users/a2020/projects/albunyaan-platform/CLAUDE.md` before
acting; nothing in this skill overrides it.

## When NOT to use this skill

| Situation | Use instead |
|---|---|
| A transfer/harvest is failing in a NEW way, you need to root-cause | `albunyaan-migration-debugging-playbook` |
| You want to change pipeline code, timeouts, concurrency, watchdog logic | `albunyaan-change-control` (mandatory), then `albunyaan-architecture-contract` |
| "Why is the code shaped this weird way?" / history of a past disaster | `albunyaan-failure-archaeology` |
| Table/column meanings, manifest statuses, counts queries in depth | `albunyaan-data-and-schema-reference` |
| Scraping Uscreen admin (selectors, sessions, politeness) beyond harvest | `uscreen-scraping-reference` |
| Bunny API, library cleanup, encode settings, orphan sweeps | `bunny-operations` |
| Morning report, backups, email/push automations, other LaunchAgents | `albunyaan-ops-and-automations` |
| Verifying migrated videos actually play / QA of the catalog | `albunyaan-validation-and-qa` |
| Env setup, pnpm, tsx, building the repo | `albunyaan-build-and-env` |
| The overall Uscreen-exit program (billing cutover, live channels, apps) | `albunyaan-platform-replacement-campaign` |

## Glossary (each term defined once)

- **Uscreen** — the OTT platform being replaced (`app.uscreen.tv`). Hosts video on **Mux**.
- **Mux HLS URL** — the tokenized stream URL (`stream.mux.com/....m3u8?token=...`) captured
  from a Uscreen admin page. The token (a JWT `exp` claim) lives **~159 minutes**; after
  that every fetch is a 403.
- **Bunny** — Bunny Stream, the destination video host. Library ID + API key live in
  `~/.albunyaan-cc/cloud.env` (vars `BUNNY_LIBRARY_ID`, `BUNNY_API_KEY`). The API key can
  DELETE the whole library — never print it.
- **Harvest** — phase 1: visit each pending video's Uscreen admin page in the twin Chrome,
  capture its Mux HLS URL into `videos.uscreen_hls_url`. Sequential by design.
- **Transfer** — phase 2: ffmpeg-pull the file from Mux, curl-upload to Bunny, set
  `videos.bunny_video_id`. Parallel, no browser, no Uscreen contact.
- **Orchestrator** — `~/.albunyaan-cc/migrate-overnight.sh`, the bash loop that alternates
  harvest→transfer forever. THE process that "is the migration".
- **Twin Chrome** — Chrome for Testing on CDP port **9333** with the cloned founder profile
  (`~/.albunyaan-cc/chrome-emdb-clone`), holding the logged-in Uscreen admin session.
- **Watchdog** — `~/.albunyaan-cc/migration-watchdog.sh`, a LaunchAgent that self-heals
  hung transfers every 5 minutes. It NEVER restarts the orchestrator (human-only, because
  the shared browser session needs eyes).
- **Bundle meter** — `~/.albunyaan-cc/bundle-meter.sh`, a LaunchAgent that meters en0
  traffic against the founder's 400GB bundle and auto-pauses the migration at 250GB.
- **Manifest** — the `export_manifest` table, entity `'video_migration'`: per-video status
  (`fetched`, `done`, `failed`, `skip_no_hls`) + `last_error`. All four persist since
  2026-07-12 — migration `0011_widen_export_manifest_status.sql` widened the cloud CHECK
  (applied + verified live) and `setManifest()` now logs write failures (commit
  `da5cced`). No backfill: `done`/`skip_no_hls` counts stay 0 until the next poll/harvest
  runs write them — see the RESOLVED mismatch section in
  `albunyaan-data-and-schema-reference` before trusting `done`/`skip_no_hls` counts.
  NOTE: despite its name,
  `supabase/migrations/0008_migration_state.sql` is BILLING-cutover bookkeeping, not this.

## Three-location map (do not confuse them)

1. `/Users/a2020/projects/albunyaan-platform` — the monorepo. The engine is
   `worker/migrate-videos.ts`; run it only via `node_modules/.bin/tsx` from `worker/`
   (**never `npx`/`npm exec`** — they hang unpredictably, hard rule from CLAUDE.md).
2. `~/.albunyaan-cc/` — operational state: orchestration scripts, all logs, scraped JSONL,
   the Chrome profile, and **chmod-600 secret env files** (`cloud.env`, `brevo.env`,
   `resend.env`, `supabase-cli.env`, `supabase-db-pw.env`, `webhook.env`). Never read,
   cat, or quote these files; only `source` `cloud.env` into a shell when a command needs it.
   (Sourcing EXECUTES the file to load vars into the shell — required and allowed; what is
   forbidden is READING it: no cat/echo/printing of its contents into context or logs.)
3. `~/projects/albunyaan-command-center` — a SEPARATE metrics/honesty dashboard. Its name
   suggests it runs the migration; **it does not**. Nothing in this runbook lives there.

## State as of 2026-07-12

- **1,584 / 15,861** videos have `bunny_video_id` (verified via REST count). **197/197
  published videos DONE** — the live-site tier is complete. (The published *unit* on the
  storefront is collections, ~692; video-level published = 197.)
- **Orchestrator DOWN** since 2026-07-11 23:12 (founder: "don't run them tonight").
  Watchdog logs `ORCHESTRATOR DOWN` every 5 min — expected, harmless, by design.
- Twin Chrome IS currently up on :9333 (Chrome 148). Only stray 5-min caffeinates running.
- Bundle: **34GB used of 400GB** (renewed 2026-07-11; meter includes `PREUSED_GB=30`).
  Neither `BUNDLE-WARN` nor `BUNDLE-ALERT` flag exists.
- Structure, enum, covers import phases: complete. Remaining work = the ~14,277 draft
  videos, smallest-first.

## How the engine works — `worker/migrate-videos.ts`

Run from `/Users/a2020/projects/albunyaan-platform/worker` with `cloud.env` sourced.

| Mode | What it does | Key numbers (verified in source) |
|---|---|---|
| `--harvest [N]` | Sequential: reuse ONE tab in twin Chrome, visit `app.uscreen.tv/manage/videos/<extId>/details`, sniff the Mux `.m3u8?token=` response, write `videos.uscreen_hls_url` | default N=60; 15s goto timeout; 2.6s response-wait; **1.8s politeness delay** between videos (concurrent admin loads trip hCaptcha); 25s hard per-video timeout; over-fetches `limit*5` then drops `skip_no_hls` + `status='live'`; orders published-first then **shortest-duration-first** |
| `--transfer` | Parallel: for every video with a `uscreen_hls_url` and no `bunny_video_id`: `createVideo` on Bunny → ffmpeg pull (`-map 0:p:1 -sn -c copy`) to `$TMPDIR/mig-w<id>-<extId>.mp4` → `curl -T` streaming upload → set `bunny_video_id`, manifest `fetched` | **CONCURRENCY=5** (env-overridable, `Number(process.env.CONCURRENCY ?? 5)`); preflight bulk-clears URLs whose token expires within 5 min; queue sorted shortest-first; ffmpeg timeout = token runway − 5 min (floor 10, cap 150 min); upload curl: `--max-time 10800 --speed-limit 1024 --speed-time 60` |
| `--poll` | Updates Bunny encode status into the manifest (`done` / `failed: bunny_encode_failed`), skipping already-`done` rows; both the done-set read and the migrated-videos read are paginated 1000/page via `.range()` (Supabase REST silently clamps — the clamped `.limit(5000)` is gone since 2026-07-12, commit `da5cced`). `done` writes persist since migration 0011, but with no backfill the done-set starts empty: the FIRST post-restart poll re-polls all ~1,584 migrated (long round, expected), then shrinks — see `albunyaan-data-and-schema-reference` | prints `poll: finished N, still encoding N, failed N` |
| `--dry` | Harvest smoke test: opens its own new page, sniffs the Mux URL, prints per-video `harvested ✓`/`FAILED` — no Bunny calls, no DB writes | pass a small N (`--dry --harvest 3` style: N is read from the `--harvest` arg, default 60 — always give a small one) |

**Fail-closed contract (never "optimize" away):** on ANY transfer failure the worker
(1) deletes its temp mp4, (2) **nulls `videos.uscreen_hls_url`** so the video re-enters
harvest for a fresh token, (3) writes manifest `failed` + error, and (4) **deletes the
empty Bunny placeholder** (`deleteVideo`) that `createVideo` already created. Removing any
of these re-opens a documented past disaster (0-byte-orphan catastrophe: 97% of 6,017
Bunny entries were empty on 2026-07-10). See `albunyaan-failure-archaeology`.

Engine hygiene already baked in (do not regress): async `spawn` only (never `spawnSync`);
explicit `process.exit(0)` on success (CDP socket otherwise holds the process as a
zombie); harvest parks its tab on `about:blank` and never closes the LAST page in the
shared browser.

## How the orchestrator works — `~/.albunyaan-cc/migrate-overnight.sh`

Verbatim behavior of the round loop (HARVEST_BATCH=60, `TSX=node_modules/.bin/tsx`,
LOG=`~/.albunyaan-cc/migrate.log`):

1. `round=round+1`; log `--- round N HH:MM:SS ---`.
2. **Harvest**: `$TSX migrate-videos.ts --harvest 60 2>&1 | tee -a $LOG` (live-streamed;
   `tee`, not command substitution).
3. Greps the last 30 log lines for the harvest outcome:
   - **`LOGGED OUT`** → Uscreen session died. Enters a wait loop: every **300s** run
     `--harvest 1` as a probe, up to **24 tries (2 hours)**; resumes the moment a probe
     no longer says LOGGED OUT. The founder must re-login in the twin Chrome — the script
     only waits, it cannot log in.
   - **`0 videos to harvest`** → runs `--transfer` once more; if that prints
     `TRANSFER: 0 videos`, logs `ALL VIDEOS MIGRATED` and **breaks the loop** (the only
     clean completion condition). Otherwise loops back to harvest.
4. **Transfer**: `$TSX migrate-videos.ts --transfer 2>&1 | tee -a $LOG`.
5. **Every 5th round** (`round % 5 == 0`): `--poll` to sync Bunny encode status.
6. `sleep 2`, next round.

Because each round spawns a **fresh tsx process**, code fixes in `migrate-videos.ts` take
effect next round automatically — no orchestrator restart needed for engine changes.

**Log timestamp gotcha (verified in migrate.log):** the orchestrator's `--- round ---`
lines are LOCAL time (`date +%H:%M:%S`), but the engine's `[HH:MM:SS]` lines are **UTC**
(`toISOString`) — in CEST they trail the round header by 2 hours. Not a time warp.

## Log and state file inventory (all under `~/.albunyaan-cc/`)

| File | What |
|---|---|
| `migrate.log` | THE migration log (orchestrator + engine, appended forever) |
| `migrate-overnight-outer.log` | stdout/stderr of the `nohup`'d orchestrator itself |
| `watchdog.log` | watchdog actions: TAB-GC, HEALED, ORCHESTRATOR DOWN lines |
| `watchdog-agent.log` / `bundle-meter-agent.log` | LaunchAgent stderr (normally empty) |
| `bundle-usage.log` | one `<timestamp> NGB` line per 5 min |
| `bundle-state.txt` | meter baseline: `in_bytes out_bytes boot_epoch acc_bytes` |
| `BUNDLE-WARN` / `BUNDLE-ALERT` | flag files; their existence = warn/pause fired |
| `morning-report-YYYY-MM-DD.txt` | daily 08:00 snapshot incl. migration counts |

## launchd inventory relevant to migration

| LaunchAgent | Interval | Script | Role |
|---|---|---|---|
| `com.albunyaan.migration-watchdog` | **300s** + RunAtLoad | `migration-watchdog.sh` | TAB-GC (>1 Uscreen tabs → close, blank-page-first); sweep `$TMPDIR/mig-w*.mp4` older than 100 min; hang-heal: log stale >5 min AND zero ffmpeg/curl **with live parent (ppid≠1)** → SIGTERM all `--transfer` pids, SIGKILL orphaned (ppid 1) ffmpeg/curl. Logs but never restarts a down orchestrator. |
| `com.albunyaan.bundle-meter` | **300s** + RunAtLoad | `bundle-meter.sh` | Meters ALL en0 in+out from baseline + `PREUSED_GB=30`. At **200GB**: macOS notification + `BUNDLE-WARN`. At **250GB**: kills orchestrator + workers + orphan ffmpeg, writes `BUNDLE-ALERT`, notifies — migration stays paused until a human decides. Reboot-safe re-baselining. |

Adjacent agents (`com.albunyaan.morning-report`, `catalog-backup`, weekly/monthly drafts)
are covered in `albunyaan-ops-and-automations`. **Guardrail:** a Claude hook
(`~/.claude/hooks/guardrail.py`) blocks `launchctl bootout|unload|remove` of any
`com.albunyaan.*` agent — by design. Loading a NEW agent is fine.

## Health check — `/migration-status`

The slash command `/migration-status` (defined in `~/.claude/commands/migration-status.md`)
runs the full battery: process check, ffmpeg children, log freshness, REST counts, temp
bloat, and applies the proven verdict logic. Use it as the FIRST action on any
"how is the migration doing?" question. The count queries it uses (secrets stay in env,
never printed):

```bash
set -a; source ~/.albunyaan-cc/cloud.env; set +a
curl -s --max-time 15 "${SUPABASE_URL}/rest/v1/videos?select=id&bunny_video_id=not.is.null&limit=1" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Prefer: count=exact" -I | grep -i content-range     # → 0-0/<total migrated>
# add &status=eq.published for the published tier (197 = complete)
# denominators (15,861 total / 197 published) go stale silently — self-check them with the
# same query minus the bunny filter: albunyaan-validation-and-qa §1 (single home)
```

**Verdict logic (memorize):** log advancing OR ffmpeg/curl children active → HEALTHY
(quiet log + active ffmpeg = long-form video in flight — do NOT kill). Log stale 5+ min
AND zero active children → **first check `pgrep -f migrate-overnight.sh`**:
- **Empty ⇒ orchestrator DEAD** (whole process tree gone — not a hang; added 2026-07-12).
  There is nothing to SIGTERM and nothing will self-resume. The fix is the
  **FULL COLD RESTART** section below — but actually starting/resuming the orchestrator
  is a founder-go T3 decision (`albunyaan-change-control`); diagnose and report, don't
  restart on your own.
- **Alive ⇒ real hang** → SIGTERM the transfer child only; the orchestrator self-resumes
  within ~1 min.

`dyld`/`libx265` errors → `brew reinstall ffmpeg` (a brew upgrade broke ffmpeg mid-run
once) — but only if the dyld lines appear AFTER the latest `run started` marker;
migrate.log carries 617 historical dyld lines that predate later clean rounds (recency
check: debugging playbook §7). Transient `curl exit 56` / 403 waves → normal, the
fail-closed path re-queues them.

## FULL COLD RESTART (the standard resume — verify every step, absence of error ≠ success)

Step 0 — pre-flight sanity:

```bash
tail -3 ~/.albunyaan-cc/watchdog.log        # expect ORCHESTRATOR DOWN lines
ls ~/.albunyaan-cc/BUNDLE-ALERT 2>/dev/null && echo "BUNDLE PAUSE ACTIVE — founder decision needed, STOP"
tail -2 ~/.albunyaan-cc/bundle-usage.log    # how much bundle is left? If near 200/250GB, ask founder first
pgrep -f migrate-overnight.sh && echo "ALREADY RUNNING — do not double-start"
```

Never double-start: two orchestrators share one log and one browser and corrupt each
other's round detection.

Step 1 — twin Chrome up and logged in?

```bash
curl -s --max-time 3 http://127.0.0.1:9333/json/version | head -2
```

If that answers, Chrome is up — skip to the login check. If not, launch it per
**`albunyaan-build-and-env` §7** — the single home for the twin-Chrome launch command,
which also resolves the `chromium-*` version-dir path drift after playwright upgrades
(a hardcoded path goes stale silently). Then verify:

```bash
sleep 5; curl -s --max-time 3 http://127.0.0.1:9333/json/version | head -2   # MUST answer
```

Then verify the Uscreen session: navigate a tab to `https://app.uscreen.tv/manage` (via
chrome-devtools MCP on :9333, or ask the founder to click). If it lands on a login page,
**the founder must log in manually** — no script can do this. Do not proceed logged-out;
the orchestrator would just spin in its LOGGED-OUT wait loop burning probe rounds.

Step 2 — keep the Mac awake (everything silently pauses if it sleeps):

```bash
pkill -f "caffeinate -i -t 300" 2>/dev/null   # clear stray 5-min ones
caffeinate -i -s -m -d -t 43200 &             # 12 hours
ps aux | grep "caffeinate -i -s" | grep -v grep   # MUST show it
```

Step 3 — start the orchestrator (env pattern + nohup, exactly this):

```bash
set -a; source ~/.albunyaan-cc/cloud.env; set +a
nohup bash ~/.albunyaan-cc/migrate-overnight.sh >> ~/.albunyaan-cc/migrate-overnight-outer.log 2>&1 &
```

(The script re-sources `cloud.env` itself and `cd`s to the worker dir — the outer source
is belt-and-braces for the shell you're in.)

Step 4 — confirm the first round is REAL (within ~60s):

```bash
sleep 20; tail -5 ~/.albunyaan-cc/migrate.log
# expect: "=== overnight migration run started ... ===", "--- round 1 ... ---",
#         then "[UTC-time] HARVEST: 60 videos to harvest (sequential...)"
pgrep -fl migrate-overnight.sh   # exactly one
```

If the log shows `LOGGED OUT` instead → go back to step 1's login check.

Step 5 — hand off to the machines: watchdog + bundle meter are already loaded LaunchAgents
(RunAtLoad, every 300s) and resume protecting automatically. Within 10 minutes,
`tail -2 ~/.albunyaan-cc/watchdog.log` should have STOPPED saying ORCHESTRATOR DOWN.

## PAUSE safely (manual — same recipe the bundle meter uses)

```bash
pkill -f "migrate-overnight.sh"; sleep 1
pkill -f "migrate-videos.ts"; sleep 2
for p in $(ps -eo pid,ppid,comm | awk '$2==1 && $3 ~ /ffmpeg/ {print $1}'); do kill -9 "$p"; done
find "${TMPDIR:-/tmp}" -name "mig-w*.mp4" -mmin +90 -delete
pkill -f "caffeinate -i -s" 2>/dev/null    # optional: let the Mac sleep
pgrep -f "migrate-videos|migrate-overnight" && echo "STILL ALIVE — repeat" || echo "paused clean"
```

Everything is resumable/idempotent: interrupted videos have their `uscreen_hls_url`
cleared (or their token simply expires and the transfer preflight clears it) and re-enter
harvest with a fresh token. In-flight mid-upload work is lost but re-queued — pausing
mid-round wastes at most the current round's bundle spend. Orphaned curl uploads MUST be
killed (the watchdog's reason: they finish uploading to Bunny but nothing records the
`bunny_video_id` → untracked duplicate). Leave the LaunchAgents loaded; a down
orchestrator makes them harmless no-op loggers.

**Resume after a 250GB bundle auto-pause:** founder decides first. Flag handling is
NOT "rm and restart" — if usage is still ≥250 GB in the SAME bundle cycle, **leave
`BUNDLE-ALERT` in place deliberately**: the existing flag is what stops the meter from
killing the migration again 5 minutes after you restart it. Remove the flags (and
`bundle-state.txt`) only once a NEW bundle cycle has started. The authoritative
flag-removal decision tree is `albunyaan-ops-and-automations` §3 — follow it, then run
the FULL COLD RESTART above. Raising `STOP_GB` in `bundle-meter.sh` is change-control
territory; on a NEW bundle, `PREUSED_GB`/baseline must be re-anchored (a founder-gated
script edit) — flag it, don't silently guess.

## MODEL FITNESS — what this session may do alone

A **Sonnet-class session MAY do alone** (mechanical, proven procedures):
- Run `/migration-status`, read logs, report counts.
- The FULL COLD RESTART, PAUSE, and bundle-pause resume procedures exactly as written —
  but starting/resuming the orchestrator requires an explicit founder go in the current
  conversation (change-control T3, founder sign-off list items 3–4; no standing
  approvals), and the founder must confirm the Uscreen login.
- SIGTERM a genuinely hung transfer child per the verdict logic; sweep orphans/temps.
- `brew reinstall ffmpeg` on the dyld/libx265 signature.
- Re-run `--poll`, or a small `--harvest 5` probe to test the Uscreen session.

**STOP and tell the founder to switch to a stronger model / higher effort** before:
- Changing the watchdog's hang-discriminator (`ppid != 1` awk), its thresholds, or kill
  logic — a past false-kill bug silently murdered an entire evening of healthy transfers.
- Changing `CONCURRENCY`, harvest politeness (1.8s / sequential), batch size, ordering,
  or timeout formulas — each number is a scar from a specific incident.
- Touching ANY fail-closed path (HLS-null on failure, placeholder `deleteVideo`, temp
  cleanup) or the manifest state machine.
- Editing `bundle-meter.sh` thresholds/baseline, or anything that spends bundle faster.
- Diagnosing a hang/failure pattern NOT listed in the verdict logic (novel root-causing —
  also load `albunyaan-migration-debugging-playbook`).
- Any bulk operation against the Bunny library (deletes especially) — `bunny-operations`,
  and founder sign-off.

Also honest-limits reminders: sessions cannot log into Uscreen (founder-only), cannot
unload `com.albunyaan.*` agents (guardrail hook), and must never read the chmod-600 env
files — reference `SUPABASE_SERVICE_ROLE_KEY`, `BUNNY_API_KEY`, etc. by NAME only. The
service-role key bypasses all RLS; the Bunny key can delete the entire library.

## Provenance and maintenance (re-verify before trusting, one line each)

- Orchestrator loop/completion/poll cadence: `cat ~/.albunyaan-cc/migrate-overnight.sh`
- Engine modes, politeness, CONCURRENCY, fail-closed path: `grep -n "CONCURRENCY\|1800\|deleteVideo\|uscreen_hls_url: null" ~/projects/albunyaan-platform/worker/migrate-videos.ts`
- Watchdog discriminator + intervals: `cat ~/.albunyaan-cc/migration-watchdog.sh; grep -A1 StartInterval ~/Library/LaunchAgents/com.albunyaan.migration-watchdog.plist`
- Bundle thresholds/state: `grep -E "WARN_GB|STOP_GB|PREUSED_GB" ~/.albunyaan-cc/bundle-meter.sh; tail -1 ~/.albunyaan-cc/bundle-usage.log`
- Live counts: the two `content-range` curls in the Health-check section (source `cloud.env` first)
- Orchestrator/Chrome liveness: `pgrep -fl migrate-overnight.sh; curl -s --max-time 3 http://127.0.0.1:9333/json/version | head -2`
- Chrome for Testing binary: `ls "$HOME/Library/Caches/ms-playwright/" | grep chromium`
- Slash command text: `cat ~/.claude/commands/migration-status.md`
- Latest operational snapshot: `cat ~/.albunyaan-cc/morning-report-$(date +%F).txt`
