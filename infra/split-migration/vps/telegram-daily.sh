#!/usr/bin/env bash
# Daily one-line migration status to Telegram (07:00 UTC ≈ 09:00 Amsterdam).
set -u
CSV=/var/log/albunyaan/throughput.csv
TARGET=15180
[ -f "$CSV" ] && [ "$(wc -l < "$CSV")" -gt 1 ] || exit 0
now_line=$(tail -1 "$CSV")
vis=$(echo "$now_line" | cut -d, -f3)
old_line=$(tail -n 145 "$CSV" | head -1)   # ~24h ago at 10-min samples
case "$old_line" in utc*) old_line=$(sed -n 2p "$CSV");; esac
old_vis=$(echo "$old_line" | cut -d, -f3)
delta=$(( vis - old_vis ))
left=$(( TARGET - vis ))
if [ "$delta" -gt 0 ]; then
  days=$(awk "BEGIN{printf \"%.1f\", $left/$delta}")
  eta="ETA ~${days} days at this pace"
else
  eta="no progress in last 24h"
fi
pct=$(awk "BEGIN{printf \"%.1f\", 100*$vis/$TARGET}")
/opt/albunyaan/bin/telegram-notify.sh "📊 Albunyaan migration: $vis/$TARGET member-visible on Bunny (${pct}%) · +$delta last 24h · $eta"
