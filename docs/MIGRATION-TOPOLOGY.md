# Migration topology — split mode (Mac harvest / VPS transfer)

Adopted 2026-07-22 (CPLAT-MIGRATION-BRIEF.md Task 3 Option B; MASTER-PLAN v2.3
Phase 2). Replaces the single-machine `migrate-overnight.sh` loop for the bulk
backlog. Deployment kit: `infra/split-migration/`.

## What runs where

| Piece | Machine | Why it lives there |
|---|---|---|
| Harvest (`migrate-videos.ts --harvest`, via `harvest-loop.sh`) | Mac | Needs the founder's logged-in Uscreen admin session in the :9333 twin Chrome. Sequential, one page, 1.8 s delay (hCaptcha). |
| Transfer (`migrate-videos.ts --transfer`, via `albunyaan-transfer.service`) | VPS (Hetzner, ~20 TB traffic) | Pure bandwidth (Mux download + Bunny upload); moves the ~2× video-size cost off the founder's metered 400 GB home bundle. |
| Poll (`--poll`, every 5th transfer round) | VPS | Same loop, no browser needed. |
| Throughput sampler (`albunyaan-throughput.timer`, 10 min) | VPS | Appends `utc,total_migrated,member_visible_migrated` to `/var/log/albunyaan/throughput.csv` via Supabase exact-count headers. |
| Watchdog, bundle meter, TAB-GC, nightly backup | Mac | Unchanged. The bundle meter now guards only harvest traffic; the watchdog's ORCHESTRATOR DOWN lines are expected noise in split mode. |

## How work flows (the DB is the queue — nothing is shipped between machines)

1. Mac harvest writes a fresh Mux HLS URL (token ~159 min) to
   `videos.uscreen_hls_url`, member-visible-first smallest-first
   (`member_visible` DESC, `duration_seconds` ASC — migration 0012, populated
   by `worker/set-member-visible.ts` from the collection scrapes; 15,180
   member-visible, verified against migration-truth.md).
2. VPS transfer loop (≤60 s later) reads all rows with a URL and no
   `bunny_video_id`, preflight-clears already-expired tokens (they re-enter
   harvest), then 5 workers: createVideo → ffmpeg pull → curl -T upload →
   write `bunny_video_id`. On ANY failure: temp file removed, `uscreen_hls_url`
   nulled (re-harvest contract), empty Bunny placeholder deleted. These
   fail-closed paths are unchanged and load-bearing (failure-archaeology).
3. Poll marks Bunny-encode-finished videos `done` in `export_manifest`.

## Invariants that did NOT change

Sequential harvest + 1.8 s delay; CONCURRENCY=5; token-runway ffmpeg timeout;
smallest-first within tier; the fail-closed transfer triple; `curl -T`
streaming upload; async `spawn`; 1000-row pagination everywhere; secrets by
name only (`/root/.albunyaan-cc/cloud.env` on the VPS, mode 600, root-only).

## Single-runner rule

Exactly one transfer runner may exist. Split mode ⇒ `albunyaan-transfer.service`
on the VPS is that runner; `migrate-overnight.sh` must stay off (harvest-loop.sh
refuses to start alongside it). Going back to single-machine mode ⇒ disable the
VPS service first: `systemctl disable --now albunyaan-transfer`.

## Stop everything

```bash
ssh -i ~/.ssh/albunyaan-vps root@<VPS_IP> systemctl stop albunyaan-transfer   # VPS transfers
touch ~/.albunyaan-cc/harvest-pause                                           # Mac harvest
```

Reboot-safe: both units are enabled; the transfer loop resumes from the DB
queue with the expired-token preflight cleaning up anything mid-flight.
