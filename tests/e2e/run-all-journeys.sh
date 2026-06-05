#!/usr/bin/env bash
# Run all persona journey e2e (bash + Vitest). Requires Postgres + Redis and a running API.
#
# Usage:
#   SEED_JOURNEY_FIXTURES=1 DATABASE_URL=postgres://... API_URL=http://localhost:3001 \
#     bash tests/e2e/run-all-journeys.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

echo "── Tahti journey test suite ──────────────────────────────"
echo ""

bash tests/e2e/vital-flows.sh
bash tests/e2e/user-journeys.sh

echo ""
echo "── Vitest persona-journeys ───────────────────────────────"
pnpm --filter @tahti/api test -- src/routes/journeys/persona-journeys.test.ts

echo ""
echo "── All journey tests passed ──────────────────────────────"
