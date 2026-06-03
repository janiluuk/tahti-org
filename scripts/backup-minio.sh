#!/usr/bin/env bash
# @deprecated Use: ./scripts/backup.sh minio
exec "$(cd "$(dirname "$0")" && pwd)/backup.sh" minio "$@"
