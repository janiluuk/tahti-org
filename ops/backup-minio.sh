#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# @deprecated Use: /srv/tahti/scripts/backup.sh minio
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec "${ROOT}/scripts/backup.sh" minio "$@"
