#!/usr/bin/env bash
# Albunyaan split-migration — deploy the VPS transfer side (run ON THE MAC).
#
#   infra/split-migration/deploy-from-mac.sh root@<VPS_IP>
#
# Idempotent: safe to re-run after code changes (re-syncs + restarts service
# only if it was active). Does NOT start the transfer service on first deploy —
# run the 10-video pilot first (see README.md), then:
#   ssh -i ~/.ssh/albunyaan-vps root@<VPS_IP> systemctl enable --now albunyaan-transfer
set -euo pipefail
VPS=${1:?usage: deploy-from-mac.sh root@<VPS_IP>}
KEY="$HOME/.ssh/albunyaan-vps"
SSH_OPTS=(-i "$KEY" -o StrictHostKeyChecking=accept-new)
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"

run() { ssh "${SSH_OPTS[@]}" "$VPS" "$@"; }

echo "── 1/5 base setup (hardening + deps)"
scp "${SSH_OPTS[@]}" "$HERE/vps/setup-vps.sh" "$VPS:/root/setup-vps.sh"
run 'bash /root/setup-vps.sh'

echo "── 2/5 worker sources + trimmed deps"
rsync -az -e "ssh ${SSH_OPTS[*]}" \
  "$REPO/worker/migrate-videos.ts" "$REPO/worker/lib" "$VPS:/opt/albunyaan/worker/"
scp "${SSH_OPTS[@]}" "$HERE/vps/package-vps.json" "$VPS:/opt/albunyaan/worker/package.json"
run 'cd /opt/albunyaan/worker && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-audit --no-fund --loglevel=error'

echo "── 3/5 secrets (cloud.env copied verbatim, mode 600 — contents never displayed)"
scp "${SSH_OPTS[@]}" "$HOME/.albunyaan-cc/cloud.env" "$VPS:/root/.albunyaan-cc/cloud.env"
run 'chmod 600 /root/.albunyaan-cc/cloud.env'

echo "── 4/5 loop scripts + systemd units"
scp "${SSH_OPTS[@]}" "$HERE/vps/transfer-loop.sh" "$HERE/vps/throughput-sample.sh" "$HERE/vps/status.sh" "$VPS:/opt/albunyaan/bin/"
run 'chmod +x /opt/albunyaan/bin/*.sh'
scp "${SSH_OPTS[@]}" "$HERE/vps/albunyaan-transfer.service" "$HERE/vps/albunyaan-throughput.service" "$HERE/vps/albunyaan-throughput.timer" "$VPS:/etc/systemd/system/"
run 'systemctl daemon-reload && systemctl enable --now albunyaan-throughput.timer'

echo "── 5/5 restart transfer service if it was already enabled (code update path)"
run 'systemctl is-enabled albunyaan-transfer.service >/dev/null 2>&1 && systemctl restart albunyaan-transfer.service || echo "transfer service not enabled yet (pilot first — see README)"'

echo "DEPLOY OK. Status: ssh -i $KEY $VPS /opt/albunyaan/bin/status.sh"
