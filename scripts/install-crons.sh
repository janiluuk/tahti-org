#!/usr/bin/env bash
# Install all Tahti cron jobs on the production node.
# Run as root on the Swarm manager.
# Idempotent — overwrites existing tahti cron files.

set -euo pipefail
[[ $EUID -eq 0 ]] || { echo "Run as root"; exit 1; }

SCRIPTS_DIR="/srv/tahti/scripts"
CRON_D="/etc/cron.d"

green() { printf "\033[32m✓\033[0m %s\n" "$1"; }

cat > "$CRON_D/tahti-backup" <<EOF
# Tahti backup cron jobs (unified: scripts/backup.sh)
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

# Postgres + MinIO DR mirror at 03:00 UTC
0 3 * * * root ${SCRIPTS_DIR}/backup.sh all >> /var/log/tahti-backup.log 2>&1

# Backup age check at 03:30 UTC (>26h WARN, >48h CRITICAL exit code)
30 3 * * * root ${SCRIPTS_DIR}/backup.sh status >> /var/log/tahti-backup.log 2>&1 || true

# Weekly restore verification — Sunday 05:00 UTC
0 5 * * 0 root ${SCRIPTS_DIR}/backup.sh restore-test >> /var/log/tahti-restore-test.log 2>&1
EOF
chmod 644 "$CRON_D/tahti-backup"
green "Installed: /etc/cron.d/tahti-backup (backup.sh all + status + restore-test)"

cat > "$CRON_D/tahti-backup-drill" <<EOF
# Quarterly operator backup drill (M29) — timed restore-test + status
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

# 06:00 UTC on 1 Jan, Apr, Jul, Oct (after nightly backup window)
0 6 1 1,4,7,10 * root ${SCRIPTS_DIR}/backup-drill.sh >> /var/log/tahti-backup-drill.log 2>&1
EOF
chmod 644 "$CRON_D/tahti-backup-drill"
green "Installed: /etc/cron.d/tahti-backup-drill (quarterly backup-drill.sh)"

# Remove legacy split cron file if present
rm -f "$CRON_D/tahti-restore-test"

# Ensure log files exist with correct permissions
touch /var/log/tahti-backup.log /var/log/tahti-restore-test.log /var/log/tahti-backup-drill.log
chmod 640 /var/log/tahti-backup.log /var/log/tahti-restore-test.log /var/log/tahti-backup-drill.log
green "Log files created"

echo ""
echo "Cron jobs installed. Verify with: crontab -l && cat /etc/cron.d/tahti-*"
