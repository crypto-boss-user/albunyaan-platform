#!/usr/bin/env bash
#
# relay-watchdog.sh — restart relay@ instances whose OUTPUT stopped advancing
# even though the process is still "active". Run as root from
# relay-watchdog.service (timer: every minute). Linux-only (systemctl).
#
# Freshness signals:
#   all modes : $STATUS_DIR/relay-<ch>.heartbeat mtime (touched from ffmpeg's
#               -progress stream every ~5 s by relay.sh)
#   hls mode  : $HLS_OUT_DIR/live.m3u8 mtime (manifest rewritten every
#               segment, i.e. every ~4 s)
#
# Policy: only ACTIVE units are judged. Failed/restarting units are already
# systemd's problem; units an admin stopped or disabled are left alone.

set -euo pipefail

ENV_DIR="${ENV_DIR:-/etc/albunyaan}"
STATUS_DIR="${STATUS_DIR:-/run/albunyaan}"
HEARTBEAT_MAX_AGE="${HEARTBEAT_MAX_AGE:-45}"   # s; heartbeat ticks every ~5 s
MANIFEST_MAX_AGE="${MANIFEST_MAX_AGE:-30}"     # s; manifest ticks every ~4 s

mkdir -p "$STATUS_DIR"

log() {
    printf 'ts=%s watchdog %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"
}

# mtime age in seconds; empty output if the file does not exist.
file_age() {
    local mtime
    mtime=$(stat -c %Y "$1" 2>/dev/null) || return 0
    printf '%s' "$(( $(date +%s) - mtime ))"
}

shopt -s nullglob
found=0
for envf in "$ENV_DIR"/relay-*.env; do
    found=1
    ch=$(basename "$envf")
    ch="${ch#relay-}"
    ch="${ch%.env}"
    unit="relay@${ch}.service"

    if ! systemctl is-active --quiet "$unit"; then
        log "channel=$ch event=skip reason=unit-not-active"
        continue
    fi

    # Read HLS_OUT_DIR (if any) from the env file in a throwaway subshell so
    # nothing leaks between channels.
    hls_dir=$(
        # shellcheck disable=SC1090
        . "$envf" >/dev/null 2>&1 || true
        printf '%s' "${HLS_OUT_DIR:-}"
    )

    stale_reason=""

    hb_age=$(file_age "$STATUS_DIR/relay-${ch}.heartbeat")
    if [[ -z "$hb_age" ]]; then
        # Unit active but heartbeat never written: give slow starts a grace
        # period by checking how long the unit has been up.
        started=$(systemctl show -p ActiveEnterTimestampMonotonic --value "$unit" 2>/dev/null || echo 0)
        up_us=$(( $(cat /proc/uptime | cut -d. -f1) * 1000000 - ${started:-0} ))
        if (( up_us > HEARTBEAT_MAX_AGE * 2 * 1000000 )); then
            stale_reason="no-heartbeat-after-start"
        fi
    elif (( hb_age > HEARTBEAT_MAX_AGE )); then
        stale_reason="heartbeat-age-${hb_age}s"
    fi

    if [[ -z "$stale_reason" && -n "$hls_dir" ]]; then
        mf_age=$(file_age "$hls_dir/live.m3u8")
        if [[ -z "$mf_age" ]]; then
            stale_reason="manifest-missing"
        elif (( mf_age > MANIFEST_MAX_AGE )); then
            stale_reason="manifest-age-${mf_age}s"
        fi
    fi

    if [[ -n "$stale_reason" ]]; then
        log "channel=$ch event=watchdog_restart reason=$stale_reason"
        systemctl restart "$unit"
    else
        log "channel=$ch event=ok heartbeat_age=${hb_age:-n/a}s"
    fi
done

(( found )) || log "event=noop msg=\"no $ENV_DIR/relay-*.env files found\""
exit 0
