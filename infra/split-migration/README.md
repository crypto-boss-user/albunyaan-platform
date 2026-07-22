# Split migration — Mac harvests, VPS transfers

Topology ratified in `CPLAT-MIGRATION-BRIEF.md` Task 3 Option B and
MASTER-PLAN v2.3 Phase 2 (2026-07-22). Full architecture notes:
`docs/MIGRATION-TOPOLOGY.md`.

**The cloud DB is the queue.** Harvest (Mac, founder's Uscreen session in the
:9333 twin Chrome, sequential + 1.8 s politeness) writes fresh Mux HLS URLs to
`videos.uscreen_hls_url`; the VPS transfer loop consumes them (ffmpeg pull →
curl -T upload to Bunny, CONCURRENCY=5, all fail-closed paths intact). Mux
tokens live ~159 min; the VPS picks URLs up within ~1 min of harvest. Ordering:
`member_visible` DESC, `duration_seconds` ASC (migration 0012 +
`worker/set-member-visible.ts` — 15,180 member-visible videos first, smallest
first).

**Hard rule: exactly ONE transfer runner.** Never run `migrate-overnight.sh`
(single-machine mode) while `albunyaan-transfer.service` is enabled on the VPS.
`mac/harvest-loop.sh` refuses to start if it sees migrate-overnight running.

## First-time bringup

1. **Founder:** create/confirm the Hetzner server; the SSH public key
   `~/.ssh/albunyaan-vps.pub` must be in root's `authorized_keys`.
2. Mac: `infra/split-migration/deploy-from-mac.sh root@<VPS_IP>`
   (hardens VPS, installs deps, syncs worker, copies `cloud.env` → mode 600,
   installs systemd units, starts the throughput sampler — but NOT the
   transfer service).
3. **Founder:** launch twin Chrome (:9333) and log into Uscreen admin
   ("session ready").
4. Mac pilot (10 videos): `cd worker && node_modules/.bin/tsx migrate-videos.ts --harvest 10`
   then on the VPS: `node_modules/.bin/tsx /opt/albunyaan/worker/migrate-videos.ts --transfer`
   (from `/opt/albunyaan/worker`). Verify all 10 in Bunny non-zero-size, DB
   `bunny_video_id` set, no new 0-byte orphans.
5. Open the full queue:
   - VPS: `systemctl enable --now albunyaan-transfer`
   - Mac: `cp infra/split-migration/mac/harvest-loop.sh ~/.albunyaan-cc/ && chmod +x ~/.albunyaan-cc/harvest-loop.sh`
     then run it under nohup/tmux with the Mac kept awake:
     `caffeinate -i -s -m -d -t 43200 & nohup ~/.albunyaan-cc/harvest-loop.sh >/dev/null 2>&1 &`

## Monitoring (run anytime, from anywhere with the key)

```bash
# One-screen progress + rates + ETA:
ssh -i ~/.ssh/albunyaan-vps root@<VPS_IP> /opt/albunyaan/bin/status.sh

# Live transfer log:
ssh -i ~/.ssh/albunyaan-vps root@<VPS_IP> tail -f /var/log/albunyaan/transfer.log

# Raw 10-min throughput samples (utc,total_migrated,member_visible_migrated):
ssh -i ~/.ssh/albunyaan-vps root@<VPS_IP> tail -20 /var/log/albunyaan/throughput.csv

# Mac harvest side:
tail -f ~/.albunyaan-cc/harvest.log
```

72-hour extrapolation: `throughput.csv` accumulates a sample every 10 min;
`status.sh` prints the 24 h rate and the ETA for the 15,180 member-visible
target. For the Mon 28 Jul commit date, read the CSV deltas over the full 72 h.

## Stop / pause

- Pause harvest (Mac): `touch ~/.albunyaan-cc/harvest-pause` (resume: `rm` it)
- Stop transfer (VPS): `systemctl stop albunyaan-transfer` (in-flight ffmpeg
  workers get SIGTERM; the engine's fail-closed catch cleans temp files, nulls
  `uscreen_hls_url`, deletes empty Bunny placeholders on the next round's
  preflight if anything slips through)
- Everything survives VPS reboot: `albunyaan-transfer.service` +
  `albunyaan-throughput.timer` are `enabled` (start on boot, `Restart=always`).
