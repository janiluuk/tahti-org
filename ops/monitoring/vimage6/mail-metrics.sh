#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Tahti ry <https://tahti.live>
#
# Contact-inbox metrics for hello@tahti.live / support@tahti.live.
#
# Both addresses are aliases to jani@tahti.live on vimage6-mailserver, so a
# plain IMAP UNSEEN count would mix them. doveadm HEADER searches keep them
# separate. Output is Prometheus text exposition, served to the
# tahti_mail_metrics scrape job by the mail-exporter container.
#
# Deployed by ops/monitoring/vimage6/deploy.sh to jani@vimage6.local:
#   ~/infra/mail/metrics/mail-metrics.sh  (this file)
#   ~/infra/mail/metrics/mail.prom        (generated, served on :9275)
# Cron (every 5 min):
#   */5 * * * * ~/infra/mail/metrics/mail-metrics.sh
#
set -euo pipefail

OUT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_TMP="${OUT_DIR}/mail.prom.$$"
MAILBOX="${MAIL_METRICS_MAILBOX:-jani@tahti.live}"
ADDRESSES="${MAIL_METRICS_ADDRESSES:-hello@tahti.live support@tahti.live}"

count_search() {
  docker exec vimage6-mailserver doveadm search -u "$MAILBOX" "$@" 2>/dev/null | wc -l
}

{
  echo '# HELP mail_inbox_unseen Unread mails in the contact mailbox filtered by To header.'
  echo '# TYPE mail_inbox_unseen gauge'
  echo '# HELP mail_inbox_total Total mails in the contact mailbox filtered by To header.'
  echo '# TYPE mail_inbox_total gauge'
  for addr in $ADDRESSES; do
    unseen="$(count_search UNSEEN HEADER To "$addr")"
    total="$(count_search HEADER To "$addr")"
    echo "mail_inbox_unseen{mailbox=\"${addr}\"} ${unseen}"
    echo "mail_inbox_total{mailbox=\"${addr}\"} ${total}"
  done
} >"$OUT_TMP"
mv "$OUT_TMP" "${OUT_DIR}/mail.prom"
