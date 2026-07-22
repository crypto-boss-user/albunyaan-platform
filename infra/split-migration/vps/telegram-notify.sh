#!/usr/bin/env bash
# Outbound-only Telegram send (VPS). Fail-soft: silent no-op without a token.
set -u
ENV=/root/.albunyaan-cc/telegram.env
[ -f "$ENV" ] || exit 0
set -a; . "$ENV"; set +a
[ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ] || exit 0
curl -s --max-time 10 "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d chat_id="${TELEGRAM_CHAT_ID}" --data-urlencode text="$1" >/dev/null || true
