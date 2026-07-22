#!/usr/bin/env bash
# Albunyaan split-migration — throughput sampler (albunyaan-throughput.timer,
# every 10 min). Appends one CSV row: utc_iso,total_migrated,member_visible_migrated
# Counts come from Supabase exact-count headers (never row reads — the REST
# API clamps pages to 1000 rows silently).
set -euo pipefail
set -a; source /root/.albunyaan-cc/cloud.env; set +a
CSV=/var/log/albunyaan/throughput.csv
count() {
  curl -s --max-time 20 "${SUPABASE_URL}/rest/v1/videos?select=id&source=eq.uscreen&bunny_video_id=not.is.null${1:-}&limit=1" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Prefer: count=exact" -I | tr -d '\r' | awk -F/ 'tolower($0) ~ /^content-range/ {print $2}'
}
total=$(count "")
vis=$(count "&member_visible=is.true")
[ -n "$total" ] && [ -n "$vis" ] || { echo "$(date -u +%FT%TZ) sample FAILED" >> /var/log/albunyaan/throughput.err; exit 1; }
[ -f "$CSV" ] || echo "utc,total_migrated,member_visible_migrated" > "$CSV"
echo "$(date -u +%FT%TZ),$total,$vis" >> "$CSV"
