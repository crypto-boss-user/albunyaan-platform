#!/usr/bin/env bash
#
# setup-vps.sh — idempotent bootstrap for the Albunyaan live-relay VPS.
# Target: fresh Ubuntu 24.04 (Hetzner CX22/CPX11 class). Safe to re-run:
# every step checks state before changing it.
#
# Usage (as root, from a checkout/copy of infra/live-relay/):
#   ./setup-vps.sh                  # primary profile: ffmpeg -> RTMP push
#   ./setup-vps.sh --with-fallback  # + nginx HLS origin (fallback profile)
#
# What it does:
#   1. system user `albunyaan` (no shell, no home login)
#   2. packages: ffmpeg, ufw, fail2ban (+ nginx with --with-fallback)
#   3. dirs: /etc/albunyaan (env files), /opt/albunyaan/live-relay (scripts),
#      /var/hls (fallback output; always created — relay@.service references it)
#   4. installs relay.sh / relay-watchdog.sh / healthcheck.sh + systemd units
#   5. ufw: deny incoming, allow OpenSSH (+ 80/tcp only with --with-fallback)
#   6. fail2ban: sshd jail enabled
#   7. enables relay-watchdog.timer
#
# What it does NOT do (on purpose):
#   * create /etc/albunyaan/relay-<channel>.env — secrets never ship in repo;
#     copy channels/example.env per channel and fill in real values (mode 600)
#   * enable relay@<channel> units — do that after env files exist
#   * TLS on nginx — the Bunny pull zone can pull over port 80 from a
#     firewalled origin; add certbot later only if you expose the origin.

set -euo pipefail

WITH_FALLBACK=0
[[ "${1:-}" == "--with-fallback" ]] && WITH_FALLBACK=1

if [[ "$(id -u)" -ne 0 ]]; then
    echo "ERROR: run as root (sudo $0 ${1:-})" >&2
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! grep -qs 'Ubuntu' /etc/os-release; then
    echo "WARNING: not Ubuntu — continuing, but this was written for 24.04" >&2
fi

echo "==> [1/7] system user"
if ! id -u albunyaan >/dev/null 2>&1; then
    useradd --system --home-dir /opt/albunyaan --create-home \
            --shell /usr/sbin/nologin albunyaan
    echo "    created user albunyaan"
else
    echo "    user albunyaan exists — ok"
fi

echo "==> [2/7] packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
pkgs=(ffmpeg ufw fail2ban)
(( WITH_FALLBACK )) && pkgs+=(nginx)
apt-get install -y -qq "${pkgs[@]}"

echo "==> [3/7] directories"
install -d -m 750 -o root -g albunyaan /etc/albunyaan
install -d -m 755 -o root -g root      /opt/albunyaan/live-relay
# Always created: relay@.service lists it in ReadWritePaths (must resolve),
# and it lets you flip a single channel to the fallback without re-running
# setup. www-data (nginx) only needs read; albunyaan writes.
install -d -m 755 -o albunyaan -g albunyaan /var/hls

echo "==> [4/7] scripts + systemd units"
install -m 755 -o root -g root \
    "$SCRIPT_DIR/relay.sh" \
    "$SCRIPT_DIR/relay-watchdog.sh" \
    "$SCRIPT_DIR/healthcheck.sh" \
    /opt/albunyaan/live-relay/
install -m 644 "$SCRIPT_DIR/README.md" /opt/albunyaan/live-relay/ 2>/dev/null || true
install -m 644 -o root -g root \
    "$SCRIPT_DIR/systemd/relay@.service" \
    "$SCRIPT_DIR/systemd/relay-watchdog.service" \
    "$SCRIPT_DIR/systemd/relay-watchdog.timer" \
    /etc/systemd/system/
systemctl daemon-reload

# Channel template on-box for convenience (never a live config by itself).
if [[ ! -e /etc/albunyaan/relay-example.env.sample ]]; then
    install -m 600 -o root -g root \
        "$SCRIPT_DIR/channels/example.env" \
        /etc/albunyaan/relay-example.env.sample
fi

echo "==> [5/7] firewall (ufw)"
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow OpenSSH >/dev/null
if (( WITH_FALLBACK )); then
    # Bunny pull zone fetches over HTTP from this origin. Tighten later to
    # Bunny edge IPs or a pull-key header (see nginx-hls.conf).
    ufw allow 80/tcp >/dev/null
fi
ufw --force enable >/dev/null
echo "    $(ufw status | head -1)"

echo "==> [6/7] fail2ban (sshd jail)"
if [[ ! -e /etc/fail2ban/jail.local ]]; then
    cat > /etc/fail2ban/jail.local <<'EOF'
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
EOF
    echo "    wrote /etc/fail2ban/jail.local"
else
    echo "    /etc/fail2ban/jail.local exists — leaving as-is"
fi
systemctl enable --now fail2ban >/dev/null

if (( WITH_FALLBACK )); then
    echo "==> [6b] nginx fallback profile"
    install -m 644 -o root -g root \
        "$SCRIPT_DIR/nginx-hls.conf" /etc/nginx/sites-available/albunyaan-hls.conf
    ln -sf /etc/nginx/sites-available/albunyaan-hls.conf \
           /etc/nginx/sites-enabled/albunyaan-hls.conf
    rm -f /etc/nginx/sites-enabled/default
    nginx -t
    systemctl enable --now nginx >/dev/null
    systemctl reload nginx
fi

echo "==> [7/7] watchdog timer"
systemctl enable --now relay-watchdog.timer >/dev/null

cat <<EOF

DONE. Next steps (per channel — see README.md runbook):
  1. cp /etc/albunyaan/relay-example.env.sample /etc/albunyaan/relay-basmah.env
     chmod 600 /etc/albunyaan/relay-basmah.env   # then edit real values
  2. systemctl enable --now relay@basmah
  3. journalctl -u relay@basmah -f          # watch it come up
  4. /opt/albunyaan/live-relay/healthcheck.sh
EOF
