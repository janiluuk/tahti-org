#!/usr/bin/env bash
# Print the next release tag: YYYY-MM-DD-buildnr (UTC calendar date, daily incrementing buildnr).
# Example: 2026-06-03-1, 2026-06-03-2
set -euo pipefail

PREFIX="$(date -u +%Y-%m-%d)"

git fetch --tags origin 2>/dev/null || true

max=0
while IFS= read -r tag; do
  [[ "$tag" =~ ^${PREFIX}-([0-9]+)$ ]] || continue
  n="${BASH_REMATCH[1]}"
  if (( n > max )); then
    max=$n
  fi
done < <(git tag -l "${PREFIX}-*")

echo "${PREFIX}-$((max + 1))"
