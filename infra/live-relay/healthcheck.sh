#!/usr/bin/env bash
#
# healthcheck.sh — per-channel status as JSON on stdout. Linux (systemctl).
#
# Fields per channel:
#   channel        instance name (from /etc/albunyaan/relay-<ch>.env)
#   mode           "rtmp" | "hls" | "unconfigured"
#   unit_state     systemctl is-active output (active/inactive/failed/...)
#   heartbeat_age_s  seconds since ffmpeg last reported progress (null = none)
#   manifest_age_s   [hls mode only] seconds since live.m3u8 was rewritten
#   healthy        true iff unit active AND heartbeat fresh AND (hls) manifest fresh
#
# Consumption paths:
#   * over SSH             : ssh vps /opt/albunyaan/live-relay/healthcheck.sh
#   * fallback profile     : relay-watchdog.service writes this output to
#                            /run/albunyaan/status.json after every sweep and
#                            nginx-hls.conf exposes it as /relay-status.json —
#                            the platform admin dashboard can poll that URL
#                            (through the Bunny pull zone or direct).
#
# No jq dependency: JSON is assembled by hand. Channel names are expected to
# be [a-z0-9-] (enforced by convention in channels/example.env), so no
# escaping is required.

set -euo pipefail

ENV_DIR="${ENV_DIR:-/etc/albunyaan}"
STATUS_DIR="${STATUS_DIR:-/run/albunyaan}"
HEARTBEAT_MAX_AGE="${HEARTBEAT_MAX_AGE:-45}"
MANIFEST_MAX_AGE="${MANIFEST_MAX_AGE:-30}"

# mtime age in seconds, or "null" if missing (JSON-ready).
file_age_json() {
    local mtime
    if mtime=$(stat -c %Y "$1" 2>/dev/null); then
        printf '%s' "$(( $(date +%s) - mtime ))"
    else
        printf 'null'
    fi
}

shopt -s nullglob
entries=""
for envf in "$ENV_DIR"/relay-*.env; do
    ch=$(basename "$envf"); ch="${ch#relay-}"; ch="${ch%.env}"
    unit="relay@${ch}.service"

    unit_state=$(systemctl is-active "$unit" 2>/dev/null || true)
    [[ -n "$unit_state" ]] || unit_state="unknown"

    read -r mode hls_dir < <(
        # shellcheck disable=SC1090
        . "$envf" >/dev/null 2>&1 || true
        if [[ -n "${TARGET_RTMP_URL:-}" ]]; then m=rtmp
        elif [[ -n "${HLS_OUT_DIR:-}" ]]; then m=hls
        else m=unconfigured; fi
        printf '%s %s\n' "$m" "${HLS_OUT_DIR:--}"
    )

    hb_age=$(file_age_json "$STATUS_DIR/relay-${ch}.heartbeat")

    manifest_field=""
    manifest_ok=1
    if [[ "$mode" == "hls" ]]; then
        mf_age=$(file_age_json "$hls_dir/live.m3u8")
        manifest_field=",\"manifest_age_s\":$mf_age"
        if [[ "$mf_age" == "null" ]] || (( mf_age > MANIFEST_MAX_AGE )); then
            manifest_ok=0
        fi
    fi

    healthy=false
    if [[ "$unit_state" == "active" && "$hb_age" != "null" ]] \
        && (( hb_age <= HEARTBEAT_MAX_AGE )) && (( manifest_ok )); then
        healthy=true
    fi

    entry=$(printf '{"channel":"%s","mode":"%s","unit_state":"%s","heartbeat_age_s":%s%s,"healthy":%s}' \
        "$ch" "$mode" "$unit_state" "$hb_age" "$manifest_field" "$healthy")
    entries="${entries:+$entries,}$entry"
done

printf '{"generated_at":"%s","host":"%s","channels":[%s]}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$(hostname)" "$entries"
