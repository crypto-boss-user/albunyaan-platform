#!/usr/bin/env bash
# Albunyaan split-migration — VPS transfer loop (run by albunyaan-transfer.service).
#
# Consumes videos.uscreen_hls_url rows written by the Mac-side harvest loop;
# the cloud DB is the queue — no files are shipped between machines. Every
# fail-closed behavior lives in migrate-videos.ts itself (expired-token
# preflight, on-failure deleteVideo + uscreen_hls_url null + temp rm): this
# loop only sequences rounds. Every 5th round runs --poll (Bunny encode
# status → export_manifest 'done').
#
# HARD RULE: exactly ONE transfer runner may exist. Never run this while the
# Mac-side migrate-overnight.sh (single-machine mode) is active — two runners
# double-createVideo the same rows.
set -u
WORKER=/opt/albunyaan/worker
LOG=/var/log/albunyaan/transfer.log
mkdir -p /var/log/albunyaan
cd "$WORKER"
round=0
while true; do
  round=$((round + 1))
  echo "[$(date '+%F %T')] ═ ROUND $round (transfer)" >> "$LOG"
  # direct binary, never npx (hangs unpredictably — repo-wide rule)
  node_modules/.bin/tsx migrate-videos.ts --transfer >> "$LOG" 2>&1
  if (( round % 5 == 0 )); then
    echo "[$(date '+%F %T')] ═ ROUND $round (poll)" >> "$LOG"
    node_modules/.bin/tsx migrate-videos.ts --poll >> "$LOG" 2>&1
  fi
  # Breather between rounds; also paces the "0 videos ready" idle case while
  # the Mac side harvests. Tokens live ~159 min, so a 60s pickup lag is free.
  sleep 60
done
