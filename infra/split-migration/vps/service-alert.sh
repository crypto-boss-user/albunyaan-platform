#!/usr/bin/env bash
# Alert (once) if the transfer service is not active; clear the latch when it recovers.
set -u
FLAG=/var/run/albunyaan-transfer-alerted
if systemctl is-active --quiet albunyaan-transfer; then
  [ -f "$FLAG" ] && { /opt/albunyaan/bin/telegram-notify.sh "✅ VPS transfer service is active again."; rm -f "$FLAG"; }
else
  [ -f "$FLAG" ] || {
    /opt/albunyaan/bin/telegram-notify.sh "🚨 VPS transfer service is NOT running ($(systemctl is-active albunyaan-transfer 2>/dev/null)). Harvest bursts will refuse to start. Check: systemctl status albunyaan-transfer"
    touch "$FLAG"
  }
fi
