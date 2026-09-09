#!/usr/bin/env bash
set -euo pipefail

# Clean up giggi-e2e-app containers
echo "── Cleanup giggi-e2e-app containers ───────────────────────"
CONTAINERS=$(docker ps -a --filter "name=giggi-e2e-app" --format "{{.ID}}")
if [ -n "$CONTAINERS" ]; then
  echo "Removing giggi-e2e-app containers..."
  for container in $CONTAINERS; do
    docker rm -f "$container" > /dev/null
    echo "  Removed $container"
  done
else
  echo "No giggi-e2e-app containers found."
fi

# Clean up giggi-ci-* containers (CI containers that may have been running too long)
echo ""
echo "── Cleanup giggi-ci-* containers ──────────────────────────"
CI_CONTAINERS=$(docker ps -a --filter "name=giggi-ci-*" --format "{{.ID}} {{.CreatedAt}}")
if [ -n "$CI_CONTAINERS" ]; then
  echo "Found CI containers, checking age..."
  echo "$CI_CONTAINERS" | while read -r container created; do
    # Calculate container age in hours
    created_epoch=$(date -d "$created" +%s 2>/dev/null || echo 0)
    now_epoch=$(date +%s)
    age_hours=$(( (now_epoch - created_epoch) / 3600 ))
    # Remove if older than 24 hours (unreasonable for CI)
    if [ "$age_hours" -gt 24 ] 2>/dev/null; then
      docker rm -f "$container" > /dev/null
      echo "  Removed old CI container $container (age: ${age_hours}h)"
    else
      echo "  Kept CI container $container (age: ${age_hours}h, under 24h limit)"
    fi
  done
else
  echo "No giggi-ci-* containers found."
fi

echo ""
echo "Cleanup complete."