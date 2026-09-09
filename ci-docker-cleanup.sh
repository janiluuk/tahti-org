#!/usr/bin/env bash
set -euo pipefail

CONTAINERS=$(docker ps -a --filter "name=giggi-e2e-app" --format "{{.ID}}")

if [ -z "$CONTAINERS" ]; then
  echo "No giggi-e2e-app containers found."
  exit 0
fi

echo "Removing giggi-e2e-app containers..."
for container in $CONTAINERS; do
  docker rm -f "$container" > /dev/null
  echo "  Removed $container"
done

echo "Cleanup complete."