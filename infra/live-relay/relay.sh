#!/usr/bin/env bash
#
# relay.sh — Albunyaan live-channel relay (WS6)
#
# Pulls one third-party IPTV source (HLS or MPEG-TS over HTTP, or any
# ffmpeg-readable URL) and pushes it to ONE of two pluggable targets:
#
#   PRIMARY : TARGET_RTMP_URL  -> generic RTMP(S) ingest (Bunny Stream Live)
#   FALLBACK: HLS_OUT_DIR      -> local HLS packaging (served by nginx behind
#                                 a Bunny CDN pull zone; see nginx-hls.conf)
#
# Exactly one of TARGET_RTMP_URL / HLS_OUT_DIR must be set.
#
# Normally launched by systemd as `relay@<channel>.service`, which loads
# /etc/albunyaan/relay-<channel>.env via EnvironmentFile= and sets CHANNEL=%i.
# For local testing you may pass an env file as $1: `relay.sh my.env`.
#
# Environment (see channels/example.env for full documentation):
#   SOURCE_URL        (required) IPTV source URL
#   TARGET_RTMP_URL   (primary)  rtmp(s)://.../<stream-key>
#   HLS_OUT_DIR       (fallback) e.g. /var/hls/basmah
#   CHANNEL / CHANNEL_NAME, USER_AGENT, HEADERS, TRANSCODE,
#   VIDEO_BITRATE, AUDIO_BITRATE, EXTRA_INPUT_ARGS, FFMPEG_BIN, STATUS_DIR
#
# Design notes:
#   * ONE ffmpeg run per script invocation. On any ffmpeg exit the script
#     exits non-zero and systemd restarts it with backoff (RestartSteps).
#     That keeps restart policy in one place (systemd) and every restart
#     visible in journald.
#   * A heartbeat file ($STATUS_DIR/relay-<channel>.heartbeat) is touched
#     for every ffmpeg progress block. The watchdog treats a stale mtime as
#     "ffmpeg process alive but frozen" and restarts the unit. We use
#     ffmpeg's -progress stream rather than log tailing because a healthy
#     `-loglevel warning` relay can be silent for hours.

set -euo pipefail

# ---------------------------------------------------------------------------
# Optional env file argument (local testing convenience; systemd uses
# EnvironmentFile= instead).
# ---------------------------------------------------------------------------
if [[ -n "${1:-}" ]]; then
    set -a
    # shellcheck disable=SC1090
    . "$1"
    set +a
fi

CHANNEL="${CHANNEL:-${CHANNEL_NAME:-unknown}}"
CHANNEL_NAME="${CHANNEL_NAME:-$CHANNEL}"
FFMPEG_BIN="${FFMPEG_BIN:-ffmpeg}"
STATUS_DIR="${STATUS_DIR:-${RUNTIME_DIRECTORY:-/run/albunyaan}}"
HEARTBEAT_FILE="$STATUS_DIR/relay-${CHANNEL}.heartbeat"

log() {
    # Structured, journald-friendly: ts=<iso8601> channel=<name> event=... k=v...
    printf 'ts=%s channel=%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$CHANNEL" "$*"
}

die() {
    log "event=fatal msg=\"$*\""
    exit 64
}

# ---------------------------------------------------------------------------
# Validate configuration
# ---------------------------------------------------------------------------
[[ -n "${SOURCE_URL:-}" ]] || die "SOURCE_URL is not set"

MODE=""
if [[ -n "${TARGET_RTMP_URL:-}" && -n "${HLS_OUT_DIR:-}" ]]; then
    die "set only ONE of TARGET_RTMP_URL / HLS_OUT_DIR (got both)"
elif [[ -n "${TARGET_RTMP_URL:-}" ]]; then
    MODE="rtmp"
elif [[ -n "${HLS_OUT_DIR:-}" ]]; then
    MODE="hls"
else
    die "set TARGET_RTMP_URL (primary) or HLS_OUT_DIR (fallback)"
fi

mkdir -p "$STATUS_DIR"
[[ "$MODE" == "hls" ]] && mkdir -p "$HLS_OUT_DIR"

# Never log the RTMP URL itself — the stream key is a secret. Log host only.
target_desc="hls:$( [[ "$MODE" == hls ]] && printf '%s' "$HLS_OUT_DIR" )"
if [[ "$MODE" == "rtmp" ]]; then
    target_host="${TARGET_RTMP_URL#*://}"; target_host="${target_host%%/*}"
    target_desc="rtmp:${target_host}"
fi

# ---------------------------------------------------------------------------
# Build ffmpeg argument list
# ---------------------------------------------------------------------------
args=( -hide_banner -nostdin -nostats -loglevel warning )

# NOTE: we deliberately do NOT use -re here. -re throttles input reads to the
# stream's native framerate and exists for pushing *files* as if they were
# live. Our SOURCE_URL is already a real-time live feed — it arrives at 1x by
# itself. Adding -re on top of a live pull causes gradual drift and buffer
# underruns during network jitter, which is the classic way a 24/7 relay dies
# slowly. (The macOS test generator DOES use -re, because there the input is
# a synthetic non-realtime source — that is the correct use of the flag.)

# Generic I/O timeout so a dead source makes ffmpeg exit (and systemd restart
# us) instead of blocking forever. Microseconds; applies to all protocols.
args+=( -rw_timeout 15000000 )

# HTTP(S)-only input options (reconnect family + header spoofing). These are
# http-protocol private options; only attach them for http(s) sources so the
# same script also works with file://, rtsp://, udp:// etc.
case "$SOURCE_URL" in
    http://*|https://*)
        args+=( -reconnect 1                 # reconnect on connection loss
                -reconnect_streamed 1        # ...even for streamed (non-seekable) input
                -reconnect_on_network_error 1
                -reconnect_delay_max 15 )    # exponential backoff cap, seconds
        [[ -n "${USER_AGENT:-}" ]] && args+=( -user_agent "$USER_AGENT" )
        # HEADERS must be full raw header lines, CRLF-separated, e.g.
        # HEADERS=$'Referer: https://example.com/\r\nOrigin: https://example.com\r\n'
        [[ -n "${HEADERS:-}" ]] && args+=( -headers "$HEADERS" )
        ;;
esac

# Tolerate the usual IPTV mess: regenerate missing PTS, drop corrupt packets.
args+=( -fflags +genpts+discardcorrupt )

# Escape hatch for picky sources (e.g. "-rtsp_transport tcp", bigger
# -probesize/-analyzeduration for slow-to-identify MPEG-TS). Word-split on
# purpose — document values without shell metacharacters.
if [[ -n "${EXTRA_INPUT_ARGS:-}" ]]; then
    # shellcheck disable=SC2206
    args+=( ${EXTRA_INPUT_ARGS} )
fi

args+=( -i "$SOURCE_URL" )

# IPTV MPEG-TS often carries multiple audio tracks, teletext/DVB subs and
# data streams. Pick first video + first audio (audio optional) — required
# for FLV/RTMP (single A/V only) and keeps the fallback HLS lean.
args+=( -map 0:v:0 -map 0:a:0? )

# --- Codec profile ---------------------------------------------------------
# Default: -c copy passthrough. Zero CPU, zero quality loss, a €6 VPS relays
# many channels. Works whenever the source is H.264 + AAC (the overwhelming
# IPTV norm).
#
# TRANSCODE=1 profile: for incompatible sources (HEVC video, MP2/MP3/AC3
# audio, broken timestamps that survive copy). Costs real CPU — roughly one
# core per SD/HD channel at veryfast — so size the VPS accordingly.
if [[ "${TRANSCODE:-0}" == "1" ]]; then
    args+=( -c:v libx264 -preset veryfast -pix_fmt yuv420p
            -b:v "${VIDEO_BITRATE:-2500k}"
            -maxrate "${VIDEO_BITRATE:-2500k}" -bufsize 5000k
            -g 100
            -c:a aac -b:a "${AUDIO_BITRATE:-128k}" -ar 44100 -ac 2 )
else
    args+=( -c copy )
fi

# --- Output ----------------------------------------------------------------
if [[ "$MODE" == "rtmp" ]]; then
    # FLV needs AAC as ASC, not ADTS (which is what MPEG-TS/HLS carry).
    # Harmless no-op only for already-ASC audio; REMOVE this bsf if the
    # source audio is not AAC and you are running -c copy (it will error) —
    # though in that case you need TRANSCODE=1 anyway, which strips ADTS.
    [[ "${TRANSCODE:-0}" == "1" ]] || args+=( -bsf:a aac_adtstoasc )
    args+=( -flvflags no_duration_filesize -f flv "$TARGET_RTMP_URL" )
else
    args+=( -f hls
            -hls_time 4
            -hls_list_size 12          # ~48 s live window
            -hls_delete_threshold 6
            -hls_flags delete_segments+omit_endlist+program_date_time+temp_file
            -hls_segment_filename "$HLS_OUT_DIR/seg_%08d.ts"
            "$HLS_OUT_DIR/live.m3u8" )
fi

# Emit machine-readable progress every 5 s on stdout; the loop below turns it
# into heartbeat-file mtime updates for the watchdog. ffmpeg's own warnings/
# errors stay on stderr and flow to journald untouched.
args+=( -stats_period 5 -progress pipe:1 )

heartbeat_pump() {
    while IFS= read -r line; do
        [[ "$line" == progress=* ]] && touch "$HEARTBEAT_FILE"
    done
}

# ---------------------------------------------------------------------------
# Run, with clean SIGTERM shutdown
# ---------------------------------------------------------------------------
SHUTDOWN=0
FFMPEG_PID=""
# shellcheck disable=SC2329  # invoked indirectly via trap
on_term() {
    SHUTDOWN=1
    log "event=shutdown msg=\"signal received, stopping ffmpeg\""
    [[ -n "$FFMPEG_PID" ]] && kill -TERM "$FFMPEG_PID" 2>/dev/null || true
}
trap on_term TERM INT

log "event=start mode=$MODE name=\"$CHANNEL_NAME\" target=$target_desc transcode=${TRANSCODE:-0}"

"$FFMPEG_BIN" "${args[@]}" > >(heartbeat_pump) &
FFMPEG_PID=$!

set +e
wait "$FFMPEG_PID"
rc=$?
if (( rc > 128 )); then
    # wait was interrupted by our trap; collect the real exit status.
    wait "$FFMPEG_PID" 2>/dev/null
    rc=$?
fi
set -e

rm -f "$HEARTBEAT_FILE"

if (( SHUTDOWN )); then
    log "event=stopped msg=\"clean shutdown\" rc=$rc"
    exit 0
fi

# Any other exit means the source dropped, the target rejected us, or ffmpeg
# hit a fatal stream error. Exit non-zero; systemd restarts us with backoff.
log "event=ffmpeg_exit rc=$rc msg=\"relay ended unexpectedly, systemd will restart\""
exit 1
