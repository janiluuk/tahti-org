#!/usr/bin/env bash
# @deprecated Use: ./scripts/backup.sh postgres
exec "$(cd "$(dirname "$0")" && pwd)/backup.sh" postgres "$@"
