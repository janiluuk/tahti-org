#!/usr/bin/env bash
# Fails if any raw hex color codes appear outside packages/ui/src/tokens.css.
# All colors must be referenced via CSS custom properties defined there
# (see docs/agent-brief.md / docs/CONSTITUTION.md). Add new tokens to
# tokens.css instead of inlining hex values in components or stylesheets.
set -euo pipefail

cd "$(dirname "$0")/.."

ALLOWLIST=(
  "packages/ui/src/tokens.css"
)

EXCLUDE_ARGS=()
for path in "${ALLOWLIST[@]}"; do
  EXCLUDE_ARGS+=(":(exclude)$path")
done

MATCHES=$(grep -rEon '#[0-9a-fA-F]{3,8}\b' \
  --include="*.css" --include="*.tsx" --include="*.ts" \
  -- packages/ui/src apps/web/src "${EXCLUDE_ARGS[@]}" 2>/dev/null \
  | grep -v 'design-token-allow' || true)

if [ -n "$MATCHES" ]; then
  echo "Raw hex color codes found outside packages/ui/src/tokens.css:"
  echo "$MATCHES"
  echo ""
  echo "Use a token from packages/ui/src/tokens.css (var(--token-name)) instead."
  exit 1
fi

echo "OK: no raw hex codes outside packages/ui/src/tokens.css"
