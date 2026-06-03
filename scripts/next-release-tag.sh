#!/usr/bin/env bash
# Print the next release tag: YYmmdd-buildnr (UTC date, daily incrementing buildnr).
# Example: 260603-1, 260603-2
set -euo pipefail

PREFIX="$(date -u +%y%m%d)"

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
