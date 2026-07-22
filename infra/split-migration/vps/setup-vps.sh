#!/usr/bin/env bash
# Albunyaan split-migration — VPS one-time setup (run ON the VPS as root).
# Hetzner CX22, Ubuntu 24.04. Hardening + runtime deps, nothing else.
# Per CPLAT-MIGRATION-BRIEF.md Task 3: SSH key-only, firewall SSH-only inbound,
# unattended security updates, ffmpeg + curl + node. No other services.
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get -y install ffmpeg curl rsync ufw unattended-upgrades ca-certificates gnupg

# Node 22 LTS via NodeSource (Ubuntu 24.04 ships an older node)
if ! command -v node >/dev/null || [ "$(node -v | cut -c2-3)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get -y install nodejs
fi

# Firewall: SSH only inbound
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw --force enable

# SSH: key-only (the key used to reach this script keeps working)
install -d /etc/ssh/sshd_config.d
cat > /etc/ssh/sshd_config.d/90-albunyaan-hardening.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
EOF
systemctl reload ssh || systemctl reload sshd

# Unattended security updates
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF

# Layout
install -d -m 755 /opt/albunyaan/worker /opt/albunyaan/bin /var/log/albunyaan
install -d -m 700 /root/.albunyaan-cc

echo "setup-vps: OK — $(node -v), $(ffmpeg -version 2>/dev/null | head -1)"
