#!/usr/bin/env bash
# Albunyaan split-migration — progress & throughput at a glance (run on VPS).
# Read-only. Rates come from throughput.csv (10-min samples); ETA extrapolates
# the last 24h of member-visible progress over the member-visible backlog.
set -u
set -a; source /root/.albunyaan-cc/cloud.env; set +a
CSV=/var/log/albunyaan/throughput.csv
LOG=/var/log/albunyaan/transfer.log
TARGET_VISIBLE=15180

echo "══ Albunyaan migration status — $(date '+%F %T %Z')"
systemctl is-active albunyaan-transfer.service >/dev/null 2>&1 \
  && echo "service: albunyaan-transfer ACTIVE" || echo "service: albunyaan-transfer NOT ACTIVE"
echo "workers: $(pgrep -c ffmpeg 2>/dev/null || echo 0) ffmpeg, $(pgrep -fc 'video.bunnycdn.com' 2>/dev/null || echo 0) bunny-curl"

if [ -f "$CSV" ] && [ "$(wc -l < "$CSV")" -gt 1 ]; then
  now_line=$(tail -1 "$CSV")
  now_total=$(echo "$now_line" | cut -d, -f2); now_vis=$(echo "$now_line" | cut -d, -f3)
  echo "migrated: $now_total total / $now_vis of $TARGET_VISIBLE member-visible ($(awk "BEGIN{printf \"%.1f\", 100*$now_vis/$TARGET_VISIBLE}")%)"
  for span in "1 hour:6" "24 hours:144"; do
    label=${span%%:*}; back=${span##*:}
    old_line=$(tail -n "$((back + 1))" "$CSV" | head -1)
    case "$old_line" in utc*) continue;; esac
    old_vis=$(echo "$old_line" | cut -d, -f3)
    old_ts=$(echo "$old_line" | cut -d, -f1); now_ts=$(echo "$now_line" | cut -d, -f1)
    hrs=$(awk "BEGIN{printf \"%.2f\", ($(date -d "$now_ts" +%s) - $(date -d "$old_ts" +%s))/3600}")
    delta=$((now_vis - old_vis))
    [ "${hrs%.*}" = "0" ] && [ "${hrs#*.}" = "00" ] && continue
    rate=$(awk "BEGIN{printf \"%.1f\", $delta/$hrs}")
    echo "last $label: +$delta member-visible (${rate}/h)"
    if [ "$label" = "24 hours" ] && [ "$delta" -gt 0 ]; then
      left=$((TARGET_VISIBLE - now_vis))
      days=$(awk "BEGIN{printf \"%.1f\", $left/($delta/$hrs)/24}")
      echo "ETA (member-visible complete, at 24h pace): ~$days days"
    fi
  done
else
  echo "throughput.csv has <2 samples yet — rates appear after ~20 min"
fi

# Engine log lines carry time-only stamps, so video-count rates come from the
# CSV above; the log is for eyeballing recent completions and GB sizes.
echo "── recent completions (✓ lines)"
tail -c 200000 "$LOG" 2>/dev/null | grep '✓' | tail -3
echo "── last log lines"
tail -5 "$LOG" 2>/dev/null
echo "── disk"
df -h /tmp /opt | tail -2
