#!/usr/bin/env bash
# CI-quality checks — lint, format, typecheck. No Docker stack, no screenshots.
#
# Usage:
#   ./scripts/ci-check.sh
#   pnpm ci:check

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "── CI check: lint ────────────────────────────────────────"
pnpm lint

echo ""
echo "── CI check: format (Prettier) ─────────────────────────────"
pnpm format:check

echo ""
echo "── CI check: typecheck ─────────────────────────────────────"
pnpm typecheck

echo ""
echo "── CI check: design tokens (no raw hex) ───────────────────"
bash scripts/check-design-tokens.sh

echo ""
echo "── CI check: reference token values ──────────────────────"
bash scripts/check-reference-token-values.sh

echo ""
echo "── CI check: Tor exit list freshness (M18) ───────────────"
node scripts/check-tor-exit-list-fresh.mjs

echo ""
echo "✓ ci-check passed (lint, format, typecheck, design tokens)"
