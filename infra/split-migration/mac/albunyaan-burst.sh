#!/usr/bin/env bash
# albunyaan-burst — manual burst control for the split migration (Mac side).
#
#   albunyaan-burst start [duration]   default 2h (accepts 90m / 2h / 7200)
#   albunyaan-burst stop               immediate stop + 45-min drain, then sleep-release
#   albunyaan-burst status             one screen: state, today's counts, ETA
#   albunyaan-burst telegram-setup     one-time: resolve chat id, test, copy env to VPS
#
# Design contract (change-control notes):
# - Harvest ONLY while the VPS transfer service is active (hard rule).
# - Harvest itself is the untouched engine: worker/migrate-videos.ts --harvest 60
#   (sequential, one page, 1.8 s politeness — never parallelized here).
# - Sleep lock is `caffeinate -i -s -m -d -w <controller pid>`: macOS drops the
#   assertion the instant the controller dies, so no crash/power-loss can leave
#   a permanent keep-awake. No global energy settings are ever touched.
# - Drain tail: after harvesting stops we stay awake up to 45 min (Mux tokens
#   live ~159 min; VPS picks up within ~1 min) and release EARLY when the DB
#   shows zero pending harvested URLs.
# - Fail-safe: if the Mac slept/crashed mid-burst, the next command notices the
#   dead controller, logs an ABORTED event, and status shows it. Expired URLs
#   re-queue by design (engine preflight nulls them for re-harvest).
set -u

VPS="root@2.28.5.57"
SSH_KEY="$HOME/.ssh/albunyaan-vps"
SSH_OPTS=(-i "$SSH_KEY" -o ConnectTimeout=8 -o BatchMode=yes)
CC="$HOME/.albunyaan-cc"
WORKER="$HOME/projects/albunyaan-platform/worker"
BURST="$CC/burst"
LOG="$BURST/burst.log"
EVENTS="$BURST/events.log"
STATE_F="$BURST/state"          # RUNNING | DRAINING | IDLE
PID_F="$BURST/controller.pid"
STOP_F="$BURST/stop-flag"
ENDS_F="$BURST/ends_at"
BASE_F="$BURST/baseline"        # VPS counters at burst start: ok fail expired e403
CDP="http://127.0.0.1:9333"
DRAIN_SECS=2700                 # 45 min
TARGET_VISIBLE=15180

mkdir -p "$BURST"
log()   { echo "[$(date '+%F %T')] $*" >> "$LOG"; }
event() { echo "[$(date '+%F %T')] $*" >> "$EVENTS"; }
say()   { echo "$*"; }

tg() { # fail-soft outbound notification; never blocks the pipeline
  [ -f "$CC/telegram.env" ] || return 0
  ( set -a; . "$CC/telegram.env"; set +a
    [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ] || exit 0
    curl -s --max-time 10 "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d chat_id="${TELEGRAM_CHAT_ID}" --data-urlencode text="$1" >/dev/null ) || true
}

controller_alive() { [ -f "$PID_F" ] && kill -0 "$(cat "$PID_F")" 2>/dev/null; }

reap_stale() { # detect a controller that died without cleanup (sleep/crash/power)
  if [ -f "$STATE_F" ] && [ "$(cat "$STATE_F")" != "IDLE" ] && ! controller_alive; then
    event "ABORTED: controller died uncleanly in state $(cat "$STATE_F") (lid closed / power loss / crash). Expired URLs will re-harvest automatically."
    tg "⚠️ Previous burst ended uncleanly (Mac slept or lost power mid-burst). No harm done — expired URLs re-queue automatically."
    echo IDLE > "$STATE_F"; rm -f "$PID_F" "$STOP_F" "$ENDS_F"
  fi
}

parse_duration() { # -> seconds; accepts 2h / 90m / 7200
  local d="${1:-2h}"
  case "$d" in
    *h) echo $(( ${d%h} * 3600 ));;
    *m) echo $(( ${d%m} * 60 ));;
    ''|*[!0-9]*) echo 0;;
    *) echo "$d";;
  esac
}

vps_active() { ssh "${SSH_OPTS[@]}" "$VPS" 'systemctl is-active --quiet albunyaan-transfer' 2>/dev/null; }

vps_counts() { # prints: ok fail expired e403  (cumulative, whole log)
  ssh "${SSH_OPTS[@]}" "$VPS" '
    L=/var/log/albunyaan/transfer.log
    ok=$(grep -c "✓" $L 2>/dev/null || echo 0)
    fail=$(grep -c "✗" $L 2>/dev/null || echo 0)
    exp=$(grep -oE "clearing [0-9]+ expired" $L 2>/dev/null | awk "{s+=\$2} END{print s+0}")
    e403=$(grep -c "403 Forbidden" $L 2>/dev/null || echo 0)
    echo "$ok $fail $exp $e403"' 2>/dev/null
}

pending_urls() { # unmigrated rows still holding a harvested URL (drain check)
  ( set -a; . "$CC/cloud.env"; set +a
    curl -s --max-time 15 -I \
      "${SUPABASE_URL}/rest/v1/videos?select=id&source=eq.uscreen&bunny_video_id=is.null&uscreen_hls_url=not.is.null&limit=1" \
      -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
      -H "Prefer: count=exact" | tr -d '\r' | awk -F/ 'tolower($0) ~ /^content-range/ {print $2}' )
}

chrome_up() { curl -s --max-time 3 "$CDP/json/version" >/dev/null 2>&1; }

launch_chrome() {
  local app
  app=$(ls -d "$HOME/Library/Caches/ms-playwright"/chromium-*/chrome-mac-arm64/*.app 2>/dev/null | tail -1)
  [ -n "$app" ] || { say "ERROR: Chrome for Testing not found under ms-playwright cache."; return 1; }
  nohup "$app/Contents/MacOS/Google Chrome for Testing" \
    --remote-debugging-port=9333 --user-data-dir="$CC/chrome-emdb-clone" \
    --profile-directory=Default >/dev/null 2>&1 &
  for _ in $(seq 1 15); do chrome_up && return 0; sleep 2; done
  return 1
}

session_valid() { # opens a Uscreen admin tab, watches for a login redirect
  curl -s -X PUT "$CDP/json/new?https://app.uscreen.tv/manage/videos" >/dev/null 2>&1
  sleep 10
  local urls
  urls=$(curl -s --max-time 5 "$CDP/json/list" | /usr/bin/python3 -c \
    'import json,sys; print("\n".join(p.get("url","") for p in json.load(sys.stdin) if p.get("type")=="page"))' 2>/dev/null)
  echo "$urls" | grep -qiE "uscreen.*(login|sign_in|users/sign)" && return 1
  echo "$urls" | grep -q "app.uscreen.tv/manage" && return 0
  return 1
}

controller() { # runs detached; $1 = duration seconds
  local dur=$1 ends=$(( $(date +%s) + $1 ))
  echo $$ > "$PID_F"; echo RUNNING > "$STATE_F"; echo "$ends" > "$ENDS_F"; rm -f "$STOP_F"
  vps_counts > "$BASE_F" || echo "0 0 0 0" > "$BASE_F"
  # Sleep lock scoped to THIS process: released automatically when we exit, however we exit.
  caffeinate -i -s -m -d -w $$ &
  log "BURST START: $((dur/60)) min (until $(date -r "$ends" '+%H:%M'))"
  local harvested=0 hfailed=0 reason="duration reached"
  while [ "$(date +%s)" -lt "$ends" ] && [ ! -f "$STOP_F" ]; do
    if ! vps_active; then
      reason="VPS transfer service not active — harvesting halted (hard rule)"
      log "$reason"; tg "⚠️ Burst halted: VPS transfer service is not active."; break
    fi
    ( cd "$WORKER" && node_modules/.bin/tsx migrate-videos.ts --harvest 60 ) >> "$LOG" 2>&1
    local done_line
    done_line=$(tail -5 "$LOG" | grep "HARVEST DONE" | tail -1)
    harvested=$(( harvested + $(echo "$done_line" | grep -oE '[0-9]+ harvested' | grep -oE '[0-9]+' || echo 0) ))
    hfailed=$((   hfailed   + $(echo "$done_line" | grep -oE '[0-9]+ failed'    | grep -oE '[0-9]+' || echo 0) ))
    if tail -8 "$LOG" | grep -q "USCREEN LOGGED OUT"; then
      reason="Uscreen session expired — founder re-login needed"
      log "$reason"; tg "⚠️ Burst halted: Uscreen session expired. Log in again in the twin Chrome, then 'albunyaan-burst start'."; break
    fi
    sleep 10
  done
  [ -f "$STOP_F" ] && reason="stopped manually"
  log "HARVEST PHASE OVER ($reason) — harvested $harvested ($hfailed failed). Draining up to 45 min."
  echo DRAINING > "$STATE_F"
  local drain_end=$(( $(date +%s) + DRAIN_SECS )) pend=""
  while [ "$(date +%s)" -lt "$drain_end" ]; do
    pend=$(pending_urls)
    [ -n "$pend" ] && [ "$pend" -eq 0 ] 2>/dev/null && { log "drain complete early (0 pending URLs)"; break; }
    sleep 120
  done
  # Burst summary vs baseline
  local b n
  b=$(cat "$BASE_F"); n=$(vps_counts || echo "$b")
  local d_ok=$(( $(echo "$n"|cut -d' ' -f1) - $(echo "$b"|cut -d' ' -f1) ))
  local d_exp=$(( $(echo "$n"|cut -d' ' -f3) - $(echo "$b"|cut -d' ' -f3) ))
  local d_403=$(( $(echo "$n"|cut -d' ' -f4) - $(echo "$b"|cut -d' ' -f4) ))
  log "BURST END: harvested $harvested ($hfailed failed), transferred $d_ok, expired $d_exp, new-403s $d_403 ($reason)"
  event "BURST END: harvested $harvested, transferred $d_ok, expired $d_exp, 403s $d_403 ($reason)"
  tg "✅ Burst finished ($reason). Harvested $harvested ($hfailed failed) · transferred $d_ok · expired $d_exp · 403s $d_403. Mac may now sleep."
  echo IDLE > "$STATE_F"; rm -f "$PID_F" "$STOP_F" "$ENDS_F"
}

cmd_start() {
  reap_stale
  controller_alive && { say "A burst is already running (state: $(cat "$STATE_F")). Use 'albunyaan-burst status'."; exit 1; }
  if pgrep -f "migrate-overnight.sh" >/dev/null || pgrep -f "harvest-loop.sh" >/dev/null || pgrep -f "migrate-videos.ts --harvest" >/dev/null; then
    say "REFUSED: another harvest/orchestrator process is running (single-runner rule)."; exit 1
  fi
  local secs; secs=$(parse_duration "${1:-2h}")
  [ "$secs" -ge 300 ] 2>/dev/null || { say "Bad duration '${1:-}' (use 2h, 90m, …, min 5m)."; exit 1; }
  say "Checking VPS transfer service…"
  vps_active || { say "REFUSED: VPS transfer service is NOT active. Fix first: ssh -i $SSH_KEY $VPS systemctl start albunyaan-transfer"; exit 1; }
  say "Checking twin Chrome + Uscreen session…"
  chrome_up || { say "Twin Chrome not running — launching it…"; launch_chrome || { say "ERROR: could not launch twin Chrome."; exit 1; }; }
  if ! session_valid; then
    say "REFUSED: Uscreen session is logged out."
    say "→ Log in at app.uscreen.tv in the 'Chrome for Testing' window (it is open now), then run: albunyaan-burst start"
    exit 1
  fi
  nohup "$0" __controller "$secs" >/dev/null 2>&1 &
  disown
  say "Burst started: $((secs/60)) min of harvesting, then 45-min drain, then the Mac may sleep."
  say "Stop early anytime: albunyaan-burst stop   ·   Watch: albunyaan-burst status"
}

cmd_stop() {
  reap_stale
  touch "$STOP_F"
  pkill -f "migrate-videos.ts --harvest" 2>/dev/null && say "Harvest process stopped."
  if controller_alive; then
    say "Controller notified — it now drains the tail (≤45 min, releases early when empty), then frees the sleep lock."
  else
    # controller is gone (crash earlier?) — run the drain ourselves so URLs never expire in bulk
    say "No live controller — running a standalone 45-min drain hold…"
    echo DRAINING > "$STATE_F"
    nohup bash -c '
      caffeinate -i -s -m -d -w $$ &
      end=$(( $(date +%s) + '"$DRAIN_SECS"' ))
      while [ "$(date +%s)" -lt "$end" ]; do sleep 120; done
      echo IDLE > "'"$STATE_F"'"' >/dev/null 2>&1 &
    disown
  fi
}

cmd_status() {
  reap_stale
  local st; st=$(cat "$STATE_F" 2>/dev/null || echo IDLE)
  echo "══ albunyaan-burst — $(date '+%F %H:%M')"
  case "$st" in
    RUNNING)  echo "state: BURSTING (harvesting until $(date -r "$(cat "$ENDS_F" 2>/dev/null || echo 0)" '+%H:%M' 2>/dev/null), then 45-min drain)";;
    DRAINING) echo "state: DRAINING (harvest done; Mac stays awake ≤45 min for the VPS tail)";;
    *)        echo "state: IDLE (Mac free to sleep)";;
  esac
  tail -2 "$EVENTS" 2>/dev/null | sed 's/^/recent: /'
  echo "── today (VPS log)"
  ssh "${SSH_OPTS[@]}" "$VPS" '
    L=/var/log/albunyaan/transfer.log; d=$(date -u +%F)
    seg=$(awk -v d="[$d" "index(\$0,d)==1 && /ROUND/ {on=1} on" $L 2>/dev/null)
    echo "transferred: $(echo "$seg" | grep -c "✓") ok, $(echo "$seg" | grep -c "✗") failed"
    echo "expired-token clears: $(echo "$seg" | grep -oE "clearing [0-9]+ expired" | awk "{s+=\$2} END{print s+0}")"
    echo "403 mentions: $(echo "$seg" | grep -c "403 Forbidden")"' 2>/dev/null \
    || echo "VPS unreachable for today-counts"
  echo "── overall"
  ssh "${SSH_OPTS[@]}" "$VPS" '/opt/albunyaan/bin/status.sh' 2>/dev/null \
    | grep -E "service:|migrated:|last 24|last 1 hour|ETA" || echo "VPS unreachable for overall status"
  echo "── mac harvested today"
  awk -v d="[$(date +%F)" 'index($0,d)==1 {on=1} on' "$LOG" 2>/dev/null \
    | grep -oE '[0-9]+ harvested' | awk '{s+=$1} END{print s+0 " (burst log)"}'
}

cmd_telegram_setup() {
  [ -f "$CC/telegram.env" ] || { say "First create $CC/telegram.env with TELEGRAM_BOT_TOKEN (see setup instructions)."; exit 1; }
  ( set -a; . "$CC/telegram.env"; set +a
    [ -n "${TELEGRAM_BOT_TOKEN:-}" ] || { echo "TELEGRAM_BOT_TOKEN missing in telegram.env"; exit 1; }
    if [ -z "${TELEGRAM_CHAT_ID:-}" ]; then
      cid=$(curl -s --max-time 10 "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates" \
        | /usr/bin/python3 -c 'import json,sys; u=json.load(sys.stdin)["result"]; print(u[-1]["message"]["chat"]["id"] if u else "")')
      [ -n "$cid" ] || { echo "No message found — send any message to your bot in Telegram first, then rerun."; exit 1; }
      printf 'TELEGRAM_CHAT_ID=%s\n' "$cid" >> "$CC/telegram.env"
      export TELEGRAM_CHAT_ID="$cid"
    fi
    curl -s --max-time 10 "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d chat_id="${TELEGRAM_CHAT_ID}" --data-urlencode text="✅ Albunyaan migration bot connected." >/dev/null \
      && echo "Test message sent — check Telegram." ) || exit 1
  chmod 600 "$CC/telegram.env"
  scp -i "$SSH_KEY" "$CC/telegram.env" "$VPS:/root/.albunyaan-cc/telegram.env" >/dev/null \
    && ssh "${SSH_OPTS[@]}" "$VPS" 'chmod 600 /root/.albunyaan-cc/telegram.env' \
    && echo "Token deployed to VPS (daily status + service alerts now active)." \
    || echo "WARNING: could not copy telegram.env to VPS — VPS-side alerts stay silent."
}

case "${1:-}" in
  start)          cmd_start "${2:-}";;
  stop)           cmd_stop;;
  status)         cmd_status;;
  telegram-setup) cmd_telegram_setup;;
  __controller)   controller "$2";;
  *) say "usage: albunyaan-burst start [2h|90m] | stop | status | telegram-setup"; exit 1;;
esac
