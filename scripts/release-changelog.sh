#!/usr/bin/env bash
# Generate GitHub release notes (markdown) for a dated build tag.
#
# Usage:
#   scripts/release-changelog.sh <tag> <sha> [previous-tag]
#
# Uses `gh api …/releases/generate-notes` in CI; falls back to git log locally.

set -euo pipefail

TAG="${1:?tag required}"
SHA="${2:?commit sha required}"
PREV="${3:-}"

if command -v gh >/dev/null 2>&1 && [[ -n "${GITHUB_REPOSITORY:-}" ]]; then
  args=(-f "tag_name=${TAG}" -f "target_commitish=${SHA}")
  if [[ -n "$PREV" ]]; then
    args+=(-f "previous_tag_name=${PREV}")
  fi
  gh api "repos/${GITHUB_REPOSITORY}/releases/generate-notes" "${args[@]}" --jq .body
  exit 0
fi

echo "## Changes"
if [[ -n "$PREV" ]]; then
  git log --pretty=format:'- %s (%h)' "${PREV}..${SHA}"
else
  git log --pretty=format:'- %s (%h)' -20 "${SHA}"
fi
