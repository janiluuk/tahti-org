#!/usr/bin/env bash
# Fails if any raw hex color codes appear outside token source files.
# All colors must be referenced via CSS custom properties (see AGENT-INSTRUCTIONS.md).
set -euo pipefail

cd "$(dirname "$0")/.."

TOKEN_PATHS=(
  'packages/ui/src/tokens.css'
  'packages/ui/src/tokens.ts'
  'packages/ui/src/styles/admin-tokens.css'
)

MATCHES=$(grep -rEn '#[0-9a-fA-F]{3,8}\b' \
  --include="*.css" --include="*.tsx" --include="*.ts" \
  packages/ui/src apps/web/src 2>/dev/null || true)

for token_path in "${TOKEN_PATHS[@]}"; do
  MATCHES=$(echo "$MATCHES" | grep -v -F "$token_path" || true)
done

MATCHES=$(echo "$MATCHES" | grep -v 'design-token-allow' || true)

if [ -n "$MATCHES" ]; then
  echo "Raw hex color codes found outside token source files:"
  echo "$MATCHES"
  echo ""
  echo "Use a token from packages/ui/src/tokens.css (var(--token-name)) instead."
  exit 1
fi

echo "OK: no raw hex codes outside token source files"
