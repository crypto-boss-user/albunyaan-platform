#!/usr/bin/env bash
# Albunyaan split-migration — Mac-side harvest loop.
# Harvest MUST stay on the Mac: it drives the founder's logged-in Uscreen
# session in the shared Chrome-for-Testing (CDP :9333) and must stay
# sequential (hCaptcha). Transfer runs on the VPS; the cloud DB is the queue.
#
# Refuses to start while migrate-overnight.sh (single-machine mode) runs —
# that script also transfers, and two transfer runners duplicate uploads.
#
# Pause:   touch ~/.albunyaan-cc/harvest-pause
# Resume:  rm    ~/.albunyaan-cc/harvest-pause
# Log:     ~/.albunyaan-cc/harvest.log
set -u
CC="$HOME/.albunyaan-cc"
LOG="$CC/harvest.log"
WORKER="$HOME/projects/albunyaan-platform/worker"
BATCH=60

if pgrep -f migrate-overnight.sh >/dev/null 2>&1; then
  echo "[$(date '+%F %T')] migrate-overnight.sh is running — split mode forbidden alongside it; exiting." | tee -a "$LOG"
  exit 1
fi
echo "[$(date '+%F %T')] harvest loop starting (batch $BATCH, transfer runs on VPS)" >> "$LOG"

while true; do
  if [ -f "$CC/harvest-pause" ]; then
    echo "[$(date '+%F %T')] paused (harvest-pause flag present)" >> "$LOG"; sleep 300; continue
  fi
  if ! curl -s --max-time 3 http://127.0.0.1:9333/json/version >/dev/null 2>&1; then
    echo "[$(date '+%F %T')] :9333 Chrome not reachable — founder must launch twin Chrome + confirm Uscreen login. Waiting." >> "$LOG"
    sleep 300; continue
  fi
  ( cd "$WORKER" && node_modules/.bin/tsx migrate-videos.ts --harvest "$BATCH" ) >> "$LOG" 2>&1
  # Session expired? The engine prints LOGGED OUT and stops — back off so we
  # don't hammer the login page every half-minute.
  if tail -5 "$LOG" | grep -q "USCREEN LOGGED OUT"; then
    echo "[$(date '+%F %T')] session lost — founder re-login needed; backing off 15 min." >> "$LOG"
    sleep 900; continue
  fi
  sleep 20
done
