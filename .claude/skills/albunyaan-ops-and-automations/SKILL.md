---
name: albunyaan-ops-and-automations
description: >
  The scheduled machinery: all com.albunyaan.* launchd agents (watchdog, bundle
  meter, morning report, nightly catalog backup, marketing drafts, push, metrics
  digest), their scripts in ~/.albunyaan-cc/, and the read-only commands to check
  each one's health. Load to see whether the automations run, interpret
  watchdog/bundle-usage/backup logs or the morning report, reload/disable/trigger
  a LaunchAgent, or resume after a BUNDLE-ALERT auto-pause.
---

> **⛔ ACHTERHAALD OP DIT PUNT — teambesluit 2026-09-02: het Bunny-account is door de eigenaar GESTOPT.**
> Het volledige originelen-archief staat geverifieerd op de NAS (16.024/16.024, sha256). Bunny is GEEN actieve
> dependency meer: niets uitvoeren richting Bunny, geen script/wachter mag een levend account aannemen, de
> saldo-bewaker is uit, de requality-ronde (±$300) vervalt, en `bunny_video_id`/showcase-play-links zijn dood
> (nooit meer als "werkend" rapporteren). Alles hieronder is historische referentie tot er een opvolger-platform
> gekozen is. Zie memory `bunny-account-gestopt` en CLAUDE.md.

# Albunyaan ops & automations

The platform is surrounded by eight launchd agents that watch, meter, report, back up
and draft — with no LLM and no human in the loop except where sending is involved.
This skill is the map of that machinery and the checklist to verify every piece of it
with commands, not vibes.

First: read `/Users/a2020/projects/albunyaan-platform/CLAUDE.md` (the project manifest).
Never contradict it. This skill only elaborates on it.

## Definitions (each defined once)

- **launchd / LaunchAgent**: macOS's scheduler. Per-user plist files in
  `~/Library/LaunchAgents/` define what runs and when. `StartInterval` = every N
  seconds; `StartCalendarInterval` = cron-like (Weekday 1 = Monday, 5 = Friday).
- **Ops dir**: `~/.albunyaan-cc/` — operational state directory (NOT a git repo).
  All orchestration scripts, logs, scraped JSONL and secret env files live here.
- **Orchestrator**: `~/.albunyaan-cc/migrate-overnight.sh` — the shell loop driving
  the Uscreen→Bunny video migration (harvest → transfer rounds). It is NOT one of the
  launchd agents; it is started by hand (`nohup`) and by design is never auto-restarted.
- **Twin Chrome**: Chrome for Testing on CDP port `:9333` with the founder's cloned
  profile (`~/.albunyaan-cc/chrome-emdb-clone`) holding the Uscreen admin session.
  Shared by harvest, push sender, and scrapers. Never close its last page.
- **Bundle**: the founder's metered 400 GB mobile-data bundle (renewed 2026-07-11).
  Every migration byte (Mux download + Bunny upload ≈ 2× each video's size) counts
  against it, plus all other Mac traffic on `en0`.
- **Brevo**: the email platform. Marketing automations create **drafts** there, never
  list-sends.
- **Manhaj gate**: `~/Marketing-Pipelines-Albunyaan/scripts/manhaj_gate.py` — the
  fail-closed content-compliance gate. It routes, it does not grade: PASS only for
  deterministically clean text; anything religious/visual → NEEDS_HUMAN; humans clear
  items via `scripts/approve.py`, logged to `logs/compliance/gate-log.jsonl`.

## Secrets discipline (hard rule)

Env files in `~/.albunyaan-cc/` (`cloud.env`, `brevo.env`, `resend.env`,
`supabase-cli.env`, `supabase-db-pw.env`, `webhook.env`) are chmod 600.
**NEVER `cat`, read, quote or paste their contents.** Load into your shell only:

```bash
set -a; source ~/.albunyaan-cc/cloud.env; set +a
```

(No contradiction: sourcing EXECUTES the file to load vars — required and allowed;
READING/printing its contents into context or logs is what the rule forbids.)

`SUPABASE_SERVICE_ROLE_KEY` bypasses RLS entirely (full DB read/write).
`BUNNY_API_KEY` can delete the whole video library. Treat both as radioactive:
reference by variable name only, never echo them, never write them to a log or file.

## 1. LaunchAgent inventory (verified 2026-07-12)

All eight are installed and loaded (last exit status 0 for each).

| Label (`com.albunyaan.`) | Schedule | Runs | Output / logs |
|---|---|---|---|
| `migration-watchdog` | every 300 s + at load | `bash ~/.albunyaan-cc/migration-watchdog.sh` | activity → `~/.albunyaan-cc/watchdog.log`; stderr → `watchdog-agent.log` |
| `bundle-meter` | every 300 s + at load | `bash ~/.albunyaan-cc/bundle-meter.sh` | usage → `~/.albunyaan-cc/bundle-usage.log`; stderr → `bundle-meter-agent.log` |
| `morning-report` | daily 08:00 | `bash ~/.albunyaan-cc/morning-report.sh` | report → `morning-report-YYYY-MM-DD.txt`; stdout/err → `morning-report.log` |
| `catalog-backup` | daily 03:30 | `/usr/bin/python3 ~/.albunyaan-cc/backup-catalog.py` | `~/.albunyaan-cc/backup.log` |
| `weekly-email-draft` | Mon 09:00 | `bash ~/.albunyaan-cc/weekly-email-draft.sh` | script log → `weekly-email-draft.log`; stderr → `weekly-email-draft-agent.log` |
| `weekly-metrics-digest` | Mon 10:00 | `python3 ~/Marketing-Pipelines-Albunyaan/scripts/collect_metrics.py` (WorkingDirectory = that repo) | digest → `~/.albunyaan-cc/weekly-digest-YYYY-MM-DD.md`; stderr → `weekly-digest-agent.log` |
| `weekly-push` | Fri 10:00 | `bash ~/.albunyaan-cc/weekly-push-notification.sh` | script log → `weekly-push.log`; stderr → `weekly-push-agent.log` |
| `monthly-acq-draft` | 1st of month 09:30 | `bash ~/.albunyaan-cc/monthly-acq-draft.sh` | script log → `monthly-acq-draft.log`; stderr → `monthly-acq-draft-agent.log` |

All log paths above without a directory are in `~/.albunyaan-cc/`.

### launchctl operations

```bash
# What is loaded + last exit status ("-  0  label" = loaded, last run exited 0)
launchctl list | grep albunyaan

# Trigger one run right now (does not change the schedule)
launchctl start com.albunyaan.morning-report
```

**`launchctl unload`/`bootout`/`remove` of any `com.albunyaan.*` agent is BLOCKED by
the guardrail hook (`~/.claude/hooks/guardrail.py`) — by design.** Disabling an agent,
and any plist edit (which requires an unload/reload), is a founder/change-control
decision; do not fight or route around the hook (see `albunyaan-build-and-env` §9).
Loading a brand-NEW agent plist (`launchctl load <new plist>`) is fine. Note that
interval agents re-exec their *shell script* fresh every cycle, so script edits need
no reload at all — only plist changes do, and those go to the founder.

Shell scripts can also be run directly (`bash ~/.albunyaan-cc/morning-report.sh`) —
they are self-contained and source their own env. The draft scripts have skip-guards
(see §5), so a manual run is safe and the scheduled run will then no-op.

Agents run only while the user is logged in and the Mac is awake. A calendar slot
missed because the Mac slept fires once on wake (that's why some artifacts are
timestamped e.g. 04:05 instead of 03:30, and 10:27 instead of 08:00).

## 2. migration-watchdog.sh — the self-healing guard

Every 5 min. It never restarts the orchestrator (by design — the shared twin-Chrome
session needs a human). What it does, in order:

1. **TAB-GC**: if no harvest is actively navigating (`pgrep -f "migrate-videos.ts --harvest"`
   empty), list twin-Chrome tabs via `http://127.0.0.1:9333/json/list` and close all
   but one `app.uscreen.tv` tab (each leaks ~150–300 MB; a 2026-07-09 accumulation
   force-quit the Mac). It opens a fresh `about:blank` FIRST (Chrome 111+ needs
   `PUT /json/new`) so it can never close the browser's last page — closing the last
   page breaks `connectOverCDP` for every future script. Fail-soft: a dead browser
   never breaks the healing below.
2. **Stale-temp sweep** every run: `find $TMPDIR -name "mig-w*.mp4" -mmin +100 -delete`
   (leaked failed-download temps hit ~5 GB on 2026-07-11 before this ran every pass).
3. **Orchestrator liveness**: if `migrate-overnight.sh` isn't running it logs
   `ORCHESTRATOR DOWN … needs manual restart` and exits. This line repeating every
   5 min in `watchdog.log` is EXPECTED whenever the migration is deliberately paused
   (it has been repeating since 2026-07-11 23:12 — founder said stop for the night).
   It is a reminder, not an alarm.
4. **Hang heal** (only when a `--transfer` child exists): if `migrate.log` is >5 min
   stale AND there are zero ffmpeg/Bunny-curl processes with a live parent
   (`ppid != 1`), it's a real hang → SIGTERM all transfer pids (wrapper AND inner
   node), then SIGKILL orphaned ffmpeg/curl (`ppid == 1` — orphaned curls would
   otherwise finish uploading to Bunny with nobody left to write back
   `bunny_video_id`, creating untracked duplicates). Orchestrator self-resumes.
   Quiet log + active ffmpeg = healthy long-form download; it does nothing.

The `ppid != 1` discriminator is the fix for the costliest watchdog failure in the
project's history (an evening of zero progress from killing healthy workers). **Do
not touch this logic as a Sonnet-class session** — see Model fitness.

Health check:

```bash
tail -5 ~/.albunyaan-cc/watchdog.log       # expected: ORCHESTRATOR DOWN spam when paused,
                                           # TAB-GC / HEALED lines when running
launchctl list | grep migration-watchdog   # "-  0  com.albunyaan.migration-watchdog"
```

## 3. bundle-meter.sh — metered-bandwidth guard

Every 5 min. Counts ALL `en0` traffic in+out (`netstat -ib`), i.e. the whole Mac,
not just the migration. Constants inside the script (as of 2026-07-12):
`PREUSED_GB=30` (estimated spend between the 2026-07-11 bundle renewal and metering
start), `WARN_GB=200`, `STOP_GB=250` of the 400 GB bundle.

- State: `~/.albunyaan-cc/bundle-state.txt` = `base_in base_out boot_epoch acc_bytes`.
  Reboot-safe: on a boottime change or counter reset it folds the window into the
  accumulator and re-baselines.
- Every run appends a reading to `~/.albunyaan-cc/bundle-usage.log`
  (e.g. `2026-07-12 18:49:00 34GB`).
- **WARN (≥200 GB)**: one-shot macOS notification, creates flag file
  `~/.albunyaan-cc/BUNDLE-WARN`.
- **STOP (≥250 GB)**: auto-PAUSES the migration exactly like a manual pause —
  `pkill -f migrate-overnight.sh`, then `pkill -f migrate-videos.ts`, then SIGKILL
  orphaned ffmpeg — creates flag `~/.albunyaan-cc/BUNDLE-ALERT`, notifies with sound.
  Founder's explicit ask: "if it ever hits like 250GB of the 400GB, tell me, we will
  stop a bit."

Both notifications are one-shot: while the flag file exists, the meter takes no
further action (it will NOT re-kill), it only keeps logging usage.

**Resuming after a BUNDLE-ALERT auto-pause** (founder's decision, never yours — this
decision tree is the SINGLE home for bundle-flag handling; `albunyaan-migration-runbook`
defers here):

1. Confirm the founder explicitly wants to continue spending bundle.
2. **Leave `BUNDLE-ALERT` in place** if usage is still ≥250 GB — the existing flag is
   what prevents the meter from killing the migration again 5 minutes after you
   restart it. Only remove the flags (`rm ~/.albunyaan-cc/BUNDLE-ALERT ~/.albunyaan-cc/BUNDLE-WARN`)
   once a NEW bundle cycle has started.
3. On a new bundle cycle: `rm` both flags AND `rm ~/.albunyaan-cc/bundle-state.txt`
   (re-baselines counters on the next meter run). `PREUSED_GB=30` is hardcoded for
   the 2026-07-11 cycle — a new cycle needs that constant re-estimated, which is a
   script edit → route through albunyaan-change-control.
4. Restart the migration per albunyaan-migration-runbook (twin Chrome up → 12 h
   caffeinate → `nohup bash ~/.albunyaan-cc/migrate-overnight.sh >> ~/.albunyaan-cc/migrate-overnight-outer.log 2>&1 &`).

Health check:

```bash
tail -2 ~/.albunyaan-cc/bundle-usage.log            # fresh timestamp ≤5 min old = meter alive
ls ~/.albunyaan-cc/BUNDLE-* 2>/dev/null || echo "no bundle flags"   # flags = threshold crossed
```

As of 2026-07-12 18:49: 34 GB used, no flags.

## 4. morning-report.sh — daily 08:00 snapshot

Pure script, no LLM. Writes `~/.albunyaan-cc/morning-report-YYYY-MM-DD.txt` and fires
a macOS notification. Contents:

- **Migration counts** via Supabase REST with `Prefer: count=exact` and `limit=1`
  (header-only count — immune to the 1000-row REST clamp):
  numerator = `videos` rows where `bunny_video_id=not.is.null` (i.e. migrated), and
  the same filtered by `status=eq.published`. So `1584/15861 total` means "1,584
  migrated of 15,861 catalog videos", not row totals.
- **Deltas** vs the previous run, kept in `~/.albunyaan-cc/morning-report-state.txt`
  (`total=`/`pub=` lines).
- **Process state**: orchestrator alive? (`pgrep -f migrate-overnight.sh`), caffeinate
  on? — `orchestrator DEAD` is expected while the migration is deliberately paused.
- **Backup line**: newest dir under `~/Backups/albunyaan-supabase` + its
  `manifest.json` videos row-count.
- **Site probes**: HTTP codes for `https://albunyaan.tv` and
  `https://www.albunyaan.tv/catalog` (200/301/302 = ok).
- **Disk free** on `/`.

Alert conditions (prefix ⚠️ in the notification): orchestrator DEAD, site code not
2xx/3xx, backup dir MISSING.

**Known drift risks / defects (as of 2026-07-12):**

- Denominators **15861** and **197** are HARDCODED in the script (report line and
  notification summary). If the catalog or published set ever changes size, the
  report silently lies. Fix = change-controlled edit. Self-check the live denominators
  any time with the count query in `albunyaan-validation-and-qa` §1 (same pattern,
  no `bunny_video_id` filter).
- The backup check trusts the newest **directory name**. An empty backup dir (see §6)
  renders as `Backup: 2026-07-12_0330 (videos=)` — blank count, NO ⚠️ alert. Proven
  on the 2026-07-09 and 2026-07-11 reports. When reading a morning report, an empty
  `videos=` means the backup FAILED that night even though a dir name is shown.

```bash
cat ~/.albunyaan-cc/morning-report-$(date +%Y-%m-%d).txt   # today's report
bash ~/.albunyaan-cc/morning-report.sh                     # regenerate now (idempotent)
```

## 5. Marketing automations — fail-closed by design

All content automation follows one doctrine: **machines draft, humans send.** The
drafting repo is `~/Marketing-Pipelines-Albunyaan` (scripts, skills, lexicon, gate,
logs). Details of gate rules belong to that repo; what ops needs to know:

### weekly-email-draft (Mon 09:00) and monthly-acq-draft (1st, 09:30)

Both run headless Claude (`~/.local/bin/claude -p "/draft-weekly-subscriber-email"`
resp. `/draft-monthly-acquisition-email`) inside the marketing repo. Costs one Claude
session's tokens per run (~4–5/mo, accepted in plan). Safety properties:

- Output goes to Brevo as a **DRAFT** plus a test send to info@ only. The
  `brevo_client.py` tool has **no list-send code path** — sending to a list is
  impossible from these automations, not merely forbidden.
- The manhaj gate fails closed: broken lexicon → nothing can PASS; religious content
  → NEEDS_HUMAN until `scripts/approve.py` logs a human approval.
- **Skip-guards** prevent double-drafting: weekly skips if a `out/weekly-YYYY-MM-*.html`
  for this month exists AND any `out/weekly-*.html` is <6 days old; monthly skips if
  `out/monthly-acq-YYYY-MM-*.html` exists. (Minor cosmetic bug: `week_file` variable
  in weekly-email-draft.sh is defined but unused — harmless.)

```bash
tail -5 ~/.albunyaan-cc/weekly-email-draft.log ~/.albunyaan-cc/monthly-acq-draft.log
ls -t ~/Marketing-Pipelines-Albunyaan/out/ | head -5      # recent drafts
```

### weekly-push (Fri 10:00) — the one automation that SENDS

`~/.albunyaan-cc/weekly-push-notification.sh` → `cd ~/projects/albunyaan-platform/worker`
→ `node_modules/.bin/tsx send-push-notification.mjs` (never npx). Sends the next
founder-approved item from `~/Marketing-Pipelines-Albunyaan/state/push-notifications-bank.json`
to all push-enabled app users (~1,287) through the Uscreen admin UI over twin Chrome
(`connectOverCDP('http://127.0.0.1:9333')`). Its rails, all fail-closed:

1. The bank file's **sha256 must have a PASS/APPROVED entry** in
   `logs/compliance/gate-log.jsonl`. Any byte-level edit to the bank invalidates the
   sha and BLOCKS sending (exit 3) until the founder re-approves via
   `scripts/approve.py`. Rotation state lives in a separate file
   (`state/push-rotation.json`) precisely so sending doesn't mutate the approved bank.
2. **Waits for a harvest-free browser window** (up to 2 h) — same
   one-admin-scraper-at-a-time rule as everything touching twin Chrome.
3. `DRY_RUN=1` fills the form and screenshots to `logs/publish/` but never clicks send.
4. Enforces Uscreen limits (title ≤65, message ≤178 chars) — refuses over-length.
5. Every real send appended to `~/Marketing-Pipelines-Albunyaan/logs/publish/push-log.txt`.

Requires the twin Chrome to be up and logged in at Fri 10:00; if the browser is down
or logged out it exits with an error (check `weekly-push.log`). Test safely any time:

```bash
cd ~/projects/albunyaan-platform/worker
DRY_RUN=1 node_modules/.bin/tsx send-push-notification.mjs
```

### weekly-metrics-digest (Mon 10:00)

`collect_metrics.py` — deterministic, no LLM. Pulls Brevo list sizes (per-list GETs —
the bulk lists endpoint returns 0 for totalSubscribers), last 8 campaigns with
open/click stats, migration counts from Supabase, the last bundle-meter reading, and
the local Uscreen member snapshot (`~/.albunyaan-cc/uscreen-member-status.jsonl`,
with a staleness warning if >7 days). Writes `~/.albunyaan-cc/weekly-digest-YYYY-MM-DD.md`,
keeps week-over-week deltas in `~/.albunyaan-cc/metrics-prev.json`. Stripe/YouTube
deliberately absent until keys exist — do not "fix" that.

## 6. backup-catalog.py — nightly 03:30 catalog backup

Dumps every public-schema table from cloud Supabase via REST to gzipped NDJSON under
`~/Backups/albunyaan-supabase/<YYYY-MM-DD_HHMM>/` (+ `manifest.json` with per-table
row counts), mirrors the folder to
`~/Library/CloudStorage/OneDrive-StichtingalAsr/Albunyaan-DB-Backups/`, rotates
(keep 14 local / 7 OneDrive). Pages at 1000 rows (the PostgREST clamp — larger pages
truncate silently). Schema itself lives in git (`supabase/migrations`) — this covers
DATA only. A good night ≈ 15,861 `videos` rows, ~16,150 `collection_items`, ~17,953
`video_categories`.

**OPEN DEFECTS (verified in backup.log, as of 2026-07-12):**

1. **Empty-backup nights**: 3 of the last 6 nightly dirs (2026-07-08, -09, -11) are
   EMPTY — 0 files, no manifest. Cause: an HTTPS `TimeoutError` while enumerating
   tables kills the whole run after `mkdir` but before any dump; there is no retry.
   The morning report still shows the dir name (see §4). **A backup dir's existence
   proves nothing — check the manifest.**
2. **OneDrive rotate crashes**: even successful runs die at the end with
   `PermissionError: Operation not permitted` on the OneDrive dir (macOS TCC denies
   `/usr/bin/python3` under launchd), so the final `BACKUP OK` summary has never
   printed, exit status is nonzero, and OneDrive retention is not enforced. The
   OneDrive **copy** itself sometimes succeeds (07-10, 07-12 present) — the mirror is
   best-effort right now.

Both fixes are change-controlled edits (retry/fail-soft, TCC grant). Until then,
verify backups by content:

```bash
# Newest local backup: must have ~20 files and a manifest with videos=15861
d=~/Backups/albunyaan-supabase/$(ls -t ~/Backups/albunyaan-supabase | head -1)
ls "$d" | wc -l && python3 -c "import json;print(json.load(open('$d/manifest.json'))['tables'])"
bash -c 'ls "/Users/a2020/Library/CloudStorage/OneDrive-StichtingalAsr/Albunyaan-DB-Backups"'  # mirror set
python3 ~/.albunyaan-cc/backup-catalog.py    # manual run any time (safe, additive)
```

## 7. Dormant one-shot scripts (do NOT run)

`~/.albunyaan-cc/` also holds finished-phase scripts with no LaunchAgents:
`run-pipeline.sh`, `run-pipeline2.sh`, `finalize.sh`, `covers-finalize.sh`,
`enum-watchdog.sh`. They drove the structure/enum/covers import phases, which are
COMPLETE. They are kept as evidence (see albunyaan-failure-archaeology), not as
tools. Re-running them would re-scrape/re-import against a live catalog.

## 8. Measure, don't eyeball — full health sweep

Run this block to know the state of every subsystem right now. All read-only.

```bash
# 1. All eight agents loaded, last exit 0
launchctl list | grep albunyaan

# 2. Watchdog heartbeat (a line every ~5 min; ORCHESTRATOR DOWN = paused, expected)
tail -3 ~/.albunyaan-cc/watchdog.log

# 3. Bundle: fresh reading + no threshold flags
tail -2 ~/.albunyaan-cc/bundle-usage.log
ls ~/.albunyaan-cc/BUNDLE-* 2>/dev/null || echo "no bundle flags"

# 4. Migration processes (orchestrator + keep-awake)
pgrep -fl migrate-overnight.sh || echo "orchestrator NOT running"
pgrep -x caffeinate >/dev/null && echo "caffeinate on" || echo "caffeinate OFF (Mac may sleep)"

# 5. Today's morning report (watch for empty 'videos=' on the Backup line)
cat ~/.albunyaan-cc/morning-report-$(date +%Y-%m-%d).txt 2>/dev/null || echo "no report today yet"

# 6. Ground-truth migration count straight from Supabase (header-only, clamp-proof)
set -a; source ~/.albunyaan-cc/cloud.env; set +a
curl -s "${SUPABASE_URL}/rest/v1/videos?select=id&bunny_video_id=not.is.null&limit=1" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Prefer: count=exact" -I | grep -i content-range

# 7. Newest backup is REAL (files + manifest), not an empty dir
d=~/Backups/albunyaan-supabase/$(ls -t ~/Backups/albunyaan-supabase | head -1)
echo "$d: $(ls "$d" | wc -l | tr -d ' ') files"; ls "$d/manifest.json" 2>/dev/null || echo "NO MANIFEST — backup failed"

# 8. Twin Chrome up? (needed by harvest + push sender)
curl -s --max-time 3 http://127.0.0.1:9333/json/version >/dev/null && echo "twin Chrome UP" || echo "twin Chrome DOWN"

# 9. Marketing: last draft runs + last pushes
tail -2 ~/.albunyaan-cc/weekly-email-draft.log ~/.albunyaan-cc/monthly-acq-draft.log ~/.albunyaan-cc/weekly-push.log 2>/dev/null
tail -3 ~/Marketing-Pipelines-Albunyaan/logs/publish/push-log.txt 2>/dev/null

# 10. Site up
curl -s --max-time 15 -o /dev/null -w "albunyaan.tv=%{http_code}\n" https://albunyaan.tv
```

For a migration-specific deep check, use the `/migration-status` slash command
(referenced in CLAUDE.md) or the albunyaan-migration-runbook skill.

## Model fitness

New rule from the owner: every skill states what a Sonnet-class session may do alone
and where it must STOP and tell the founder to switch to a stronger model / higher
effort.

**Sonnet-class alone — go ahead:**
- Everything in §8 (read-only health sweep) and interpreting the logs/reports.
- `launchctl list` / `start` of existing, unmodified agents; `launchctl load` of a brand-NEW agent plist.
- Manual runs of morning-report.sh, collect_metrics.py, backup-catalog.py,
  `DRY_RUN=1` push tests.
- Verifying backups by content; flagging empty-backup nights to the founder.
- Removing BUNDLE flags / restarting the migration **when the founder has explicitly
  decided** — per §3 and the albunyaan-migration-runbook steps.

**STOP — escalate to a stronger model / higher effort (and change control):**
- `launchctl unload`/`bootout`/`remove` of any `com.albunyaan.*` agent, or any plist
  edit requiring a reload — blocked by the guardrail hook by design; a founder
  (change-control) decision, not a model-tier question.
- Any edit to `migration-watchdog.sh` hang-discriminator, TAB-GC, or orphan-reaping
  logic (the `ppid != 1` check and kill ordering encode hard-won incident fixes).
- Any edit to `bundle-meter.sh` thresholds, accounting, or kill logic, including
  re-estimating `PREUSED_GB` for a new bundle cycle.
- Any edit to the fail-closed paths: manhaj gate, approve.py, the push sender's
  rails, brevo_client's no-list-send property, or the transfer-failure cleanup in
  `worker/migrate-videos.ts` (deleteVideo + `uscreen_hls_url` nulling).
- Changing transfer concurrency, harvest batch size/politeness, or LaunchAgent
  schedules that interact with twin-Chrome contention (weekly-push vs harvest).
- Fixing the backup script's timeout/TCC defects (§6) — touches data-safety.

A **real** (non-DRY) push send outside the Friday schedule additionally requires the
founder's explicit go — it reaches ~1,287 real users.

## When NOT to use this skill

| You actually need | Use instead |
|---|---|
| Start/stop/resume the migration, orchestrator internals | albunyaan-migration-runbook |
| A stuck/hung/failing migration right now | albunyaan-migration-debugging-playbook |
| Why the watchdog/meter/cleanup rules exist (incident history) | albunyaan-failure-archaeology |
| Table/column/enum reference, counts semantics | albunyaan-data-and-schema-reference |
| Bunny API, library ops, orphan sweeps | bunny-operations |
| Scraping Uscreen admin (harvest, snapshots) | uscreen-scraping-reference |
| Editing any guarded script or schedule | albunyaan-change-control |
| Repo layout, env loading, build/dev commands | albunyaan-build-and-env |
| System invariants and design contracts | albunyaan-architecture-contract |
| Campaign/comms strategy for the Uscreen exit | albunyaan-platform-replacement-campaign |
| Verifying a change end-to-end | albunyaan-validation-and-qa |

## Provenance and maintenance

Everything above was verified against the live system on **2026-07-12**. Volatile
facts and their one-line re-verification commands:

| Claim | Re-verify with |
|---|---|
| 8 agents, schedules, log paths | `ls ~/Library/LaunchAgents/com.albunyaan.*` then `cat` each plist |
| Agents loaded, exit 0 | `launchctl list \| grep albunyaan` |
| Watchdog behavior (TAB-GC, ppid!=1, sweeps) | `cat ~/.albunyaan-cc/migration-watchdog.sh` |
| Meter constants (PREUSED 30 / WARN 200 / STOP 250), flag names | `grep -E "_GB=\|FLAG" ~/.albunyaan-cc/bundle-meter.sh` |
| Current bundle usage (34 GB @ 2026-07-12) | `tail -1 ~/.albunyaan-cc/bundle-usage.log` |
| Hardcoded 15861/197 in morning report | `grep -n "15861\|197" ~/.albunyaan-cc/morning-report.sh` |
| Migration count (1,584 migrated / 197 published done @ 2026-07-12) | §8 step 6 curl |
| Orchestrator DOWN since 2026-07-11 23:12 | `grep -m1 "ORCHESTRATOR DOWN" ~/.albunyaan-cc/watchdog.log` + `tail` |
| Backup defects (empty nights, OneDrive PermissionError) | `grep -n "PermissionError\|TimeoutError" ~/.albunyaan-cc/backup.log`; §8 step 7 |
| Backup retention (14 local / 7 OneDrive), 1000-row paging | `grep -n "KEEP_\|PAGE" ~/.albunyaan-cc/backup-catalog.py` |
| Push rails (sha gate, harvest wait, DRY_RUN, 65/178 limits) | `sed -n 1,55p ~/projects/albunyaan-platform/worker/send-push-notification.mjs` |
| Draft skip-guards, headless-claude path | `cat ~/.albunyaan-cc/weekly-email-draft.sh ~/.albunyaan-cc/monthly-acq-draft.sh` |
| Gate is route-not-grade, approve.py is the only human-clear path | headers of `~/Marketing-Pipelines-Albunyaan/scripts/manhaj_gate.py` and `approve.py` |

If any re-verification contradicts this file, trust the system, update this file —
and route the underlying change through albunyaan-change-control.
