#!/usr/bin/env bash
# Install all Tahti cron jobs on the production node.
# Run as root on the Swarm manager.
# Idempotent — overwrites existing tahti cron files.

set -euo pipefail
[[ $EUID -eq 0 ]] || { echo "Run as root"; exit 1; }

SCRIPTS_DIR="/srv/tahti/scripts"
CRON_D="/etc/cron.d"

green() { printf "\033[32m✓\033[0m %s\n" "$1"; }

cat > "$CRON_D/tahti-backup" <<'EOF'
# Tahti backup cron jobs
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

# Postgres daily backup at 03:00 UTC
0 3 * * * root /srv/tahti/scripts/backup-postgres.sh >> /var/log/tahti-backup.log 2>&1

# MinIO mirror at 04:00 UTC
0 4 * * * root /srv/tahti/scripts/backup-minio.sh >> /var/log/tahti-backup.log 2>&1
EOF
chmod 644 "$CRON_D/tahti-backup"
green "Installed: /etc/cron.d/tahti-backup"

cat > "$CRON_D/tahti-restore-test" <<'EOF'
# Tahti weekly restore verification — Sunday 05:00 UTC
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

0 5 * * 0 root /srv/tahti/scripts/restore-test.sh >> /var/log/tahti-restore-test.log 2>&1
EOF
chmod 644 "$CRON_D/tahti-restore-test"
green "Installed: /etc/cron.d/tahti-restore-test"

# Ensure log files exist with correct permissions
touch /var/log/tahti-backup.log /var/log/tahti-restore-test.log
chmod 640 /var/log/tahti-backup.log /var/log/tahti-restore-test.log
green "Log files created"

echo ""
echo "Cron jobs installed. Verify with: crontab -l && cat /etc/cron.d/tahti-*"
