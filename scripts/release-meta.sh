#!/usr/bin/env bash
# Print release metadata for CI (tag, date, build number, display name).
#
# Usage:
#   eval "$(scripts/release-meta.sh)"   # exports TAG DATE BUILD NAME
#   scripts/release-meta.sh github     # append key=value lines to GITHUB_OUTPUT

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
TAG="$("${ROOT}/next-release-tag.sh")"
BUILD="${TAG##*-}"
DATE="${TAG%-${BUILD}}"
NAME="${DATE} #${BUILD}"

case "${1:-}" in
  github)
    {
      echo "tag=${TAG}"
      echo "date=${DATE}"
      echo "build=${BUILD}"
      echo "name=${NAME}"
    } >> "${GITHUB_OUTPUT:?GITHUB_OUTPUT required for github mode}"
    ;;
  *)
    echo "TAG=${TAG}"
    echo "DATE=${DATE}"
    echo "BUILD=${BUILD}"
    echo "NAME=${NAME}"
    ;;
esac
