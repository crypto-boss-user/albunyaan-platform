#!/usr/bin/env bash
#
# test-local-macos.sh — prove the relay logic on a Mac, no VPS, no real IPTV.
#
#   ./test-local-macos.sh                       # synthetic source (default)
#   ./test-local-macos.sh <public-test-hls-url> # use a real HLS URL as source
#
# What it does:
#   a) (default) generates a synthetic LIVE HLS stream with ffmpeg
#      (testsrc2 + sine, -re because a lavfi source is NOT realtime by
#      itself — the one legitimate use of -re) and serves it over local HTTP
#      so relay.sh exercises its real http input path (reconnect flags etc.);
#   b) runs the actual relay.sh in fallback (HLS_OUT_DIR) mode against it;
#   c) asserts live.m3u8 + segments appear and ADVANCE over ~30 s;
#   d) asserts the heartbeat file is fresh, sends SIGTERM, asserts clean
#      (exit 0) shutdown; cleans up.
#
# Requirements: ffmpeg on PATH (or FFMPEG_BIN=...), bash, python3 optional
# (without it the synthetic source is read via plain file path instead of
# HTTP, which skips the http-only flag branch of relay.sh).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FFMPEG_BIN="${FFMPEG_BIN:-$(command -v ffmpeg || true)}"
[[ -n "$FFMPEG_BIN" && -x "$FFMPEG_BIN" ]] || { echo "FAIL: ffmpeg not found (set FFMPEG_BIN)"; exit 1; }

WORKDIR="${WORKDIR:-$(mktemp -d "${TMPDIR:-/tmp}/albunyaan-relay-test.XXXXXX")}"
SRC_DIR="$WORKDIR/source"
OUT_DIR="$WORKDIR/out"
STATUS_DIR="$WORKDIR/status"
mkdir -p "$SRC_DIR" "$OUT_DIR" "$STATUS_DIR"

GEN_PID=""; HTTP_PID=""; RELAY_PID=""
PASS=0

cleanup() {
    for pid in "$RELAY_PID" "$GEN_PID" "$HTTP_PID"; do
        [[ -n "$pid" ]] && kill "$pid" 2>/dev/null || true
    done
    wait 2>/dev/null || true
    if (( PASS )); then
        rm -rf "$WORKDIR"
    else
        echo "NOTE: keeping workdir for inspection: $WORKDIR"
        echo "      relay log: $WORKDIR/relay.log ; generator log: $WORKDIR/gen.log"
    fi
}
trap cleanup EXIT

fail() { echo "FAIL: $*"; exit 1; }
say()  { printf '[test] %s\n' "$*"; }

# --------------------------------------------------------------------------
# 1. Source: user-supplied URL, or synthetic live HLS
# --------------------------------------------------------------------------
if [[ -n "${1:-}" ]]; then
    SOURCE_URL="$1"
    say "using supplied source: $SOURCE_URL"
else
    say "generating synthetic live HLS source (testsrc2 + sine)"
    # -re IS correct here: lavfi generates as fast as the CPU allows; we
    # need to pace it to realtime to imitate a live IPTV feed. (relay.sh
    # intentionally never uses -re — see the comment there.)
    "$FFMPEG_BIN" -hide_banner -loglevel warning -nostdin -re \
        -f lavfi -i "testsrc2=size=640x360:rate=25" \
        -f lavfi -i "sine=frequency=440:sample_rate=44100" \
        -map 0:v -map 1:a \
        -c:v libx264 -preset ultrafast -tune zerolatency -pix_fmt yuv420p \
        -g 50 -b:v 800k \
        -c:a aac -b:a 96k \
        -f hls -hls_time 2 -hls_list_size 8 \
        -hls_flags delete_segments+omit_endlist+temp_file \
        -hls_segment_filename "$SRC_DIR/src_%05d.ts" \
        "$SRC_DIR/index.m3u8" >"$WORKDIR/gen.log" 2>&1 &
    GEN_PID=$!

    for _ in $(seq 1 40); do [[ -s "$SRC_DIR/index.m3u8" ]] && break; sleep 0.5; done
    [[ -s "$SRC_DIR/index.m3u8" ]] || fail "synthetic source manifest never appeared (see $WORKDIR/gen.log)"
    say "synthetic source is up"

    if command -v python3 >/dev/null 2>&1; then
        PORT=8931
        python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$SRC_DIR" \
            >"$WORKDIR/http.log" 2>&1 &
        HTTP_PID=$!
        sleep 1
        kill -0 "$HTTP_PID" 2>/dev/null || fail "local http server died (port $PORT busy? see $WORKDIR/http.log)"
        SOURCE_URL="http://127.0.0.1:$PORT/index.m3u8"
        say "serving source over $SOURCE_URL (exercises relay.sh http branch)"
    else
        SOURCE_URL="$SRC_DIR/index.m3u8"
        say "python3 not found — using file path source (http branch untested)"
    fi
fi

# --------------------------------------------------------------------------
# 2. Run the real relay.sh in fallback (HLS) mode
# --------------------------------------------------------------------------
say "starting relay.sh (fallback HLS mode) -> $OUT_DIR"
env -i PATH="$PATH" HOME="$HOME" \
    SOURCE_URL="$SOURCE_URL" \
    HLS_OUT_DIR="$OUT_DIR" \
    CHANNEL=testchan CHANNEL_NAME="Test Channel" \
    STATUS_DIR="$STATUS_DIR" \
    FFMPEG_BIN="$FFMPEG_BIN" \
    bash "$SCRIPT_DIR/relay.sh" >"$WORKDIR/relay.log" 2>&1 &
RELAY_PID=$!

MANIFEST="$OUT_DIR/live.m3u8"
for _ in $(seq 1 60); do
    [[ -s "$MANIFEST" ]] && break
    kill -0 "$RELAY_PID" 2>/dev/null || fail "relay.sh exited early (see $WORKDIR/relay.log)"
    sleep 0.5
done
[[ -s "$MANIFEST" ]] || fail "live.m3u8 never appeared (see $WORKDIR/relay.log)"
say "live.m3u8 appeared"

# --------------------------------------------------------------------------
# 3. Assert the output ADVANCES for ~30 s
#    metric = media-sequence + number of segment entries (monotonic while
#    the window fills AND after it starts sliding)
# --------------------------------------------------------------------------
progress_metric() {
    local seq segs
    seq=$(awk -F: '/^#EXT-X-MEDIA-SEQUENCE/{print $2; exit}' "$MANIFEST" 2>/dev/null)
    segs=$(grep -c '\.ts$' "$MANIFEST" 2>/dev/null) || segs=0
    echo $(( ${seq:-0} + segs ))
}

m0=$(progress_metric)
sleep 15
m1=$(progress_metric)
sleep 15
m2=$(progress_metric)
say "advance metric (media-seq + segment count): t0=$m0 t15=$m1 t30=$m2"
(( m1 > m0 )) || fail "output did not advance between t0 and t+15s"
(( m2 > m1 )) || fail "output did not advance between t+15s and t+30s"

seg_count=$(find "$OUT_DIR" -name 'seg_*.ts' | wc -l | tr -d ' ')
(( seg_count >= 2 )) || fail "expected >=2 segments on disk, found $seg_count"
say "segments on disk: $seg_count"

# Heartbeat file must exist and be fresh (relay touches it every ~5 s).
HB="$STATUS_DIR/relay-testchan.heartbeat"
[[ -e "$HB" ]] || fail "heartbeat file missing: $HB"
hb_age=$(( $(date +%s) - $(stat -f %m "$HB" 2>/dev/null || stat -c %Y "$HB") ))
(( hb_age <= 30 )) || fail "heartbeat is stale (${hb_age}s)"
say "heartbeat fresh (${hb_age}s old)"

# --------------------------------------------------------------------------
# 4. Clean shutdown on SIGTERM must exit 0
# --------------------------------------------------------------------------
say "sending SIGTERM to relay.sh"
kill -TERM "$RELAY_PID"
set +e
wait "$RELAY_PID"
rc=$?
set -e
RELAY_PID=""
(( rc == 0 )) || fail "relay.sh exit code on SIGTERM was $rc, expected 0 (see $WORKDIR/relay.log)"
grep -q 'event=stopped' "$WORKDIR/relay.log" || fail "no clean-shutdown log line found"
say "clean shutdown confirmed (exit 0, event=stopped logged)"

PASS=1
echo "PASS: relay pulled the live source, packaged advancing HLS for 30s, heartbeat fresh, clean SIGTERM shutdown."
