#!/usr/bin/env bash
# @deprecated Use: ./scripts/backup.sh restore-test
exec "$(cd "$(dirname "$0")" && pwd)/backup.sh" restore-test "$@"
