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

# These stylesheets contain intentionally self-contained visual palettes (brand
# gradients, the map palette, and the legacy public/studio theme layers). Keep
# them explicit and reviewable without making every consumer import a token
# that only exists for that visual system.
for allowed_path in \
  'packages/ui/src/styles/about-page.css' \
  'packages/ui/src/styles/brand-channel.css' \
  'packages/ui/src/styles/brand-public.css' \
  'packages/ui/src/styles/brand-studio.css' \
  'packages/ui/src/styles/admin-ui.css' \
  'apps/web/src/components/themes/theme-editor.tsx' \
  'apps/web/src/components/themes/theme-preview-card.tsx'; do
  MATCHES=$(echo "$MATCHES" | grep -v -F "$allowed_path:" || true)
done

# CSS variable fallbacks are compatibility values, not app-owned palette
# declarations. They are intentionally allowed when the primary value is a
# design token.
MATCHES=$(echo "$MATCHES" | grep -vE 'var\([^)]*,[[:space:]]*#[0-9a-fA-F]{3,8}\b' || true)

if [ -n "$MATCHES" ]; then
  echo "Raw hex color codes found outside token source files:"
  echo "$MATCHES"
  echo ""
  echo "Use a token from packages/ui/src/tokens.css (var(--token-name)) instead."
  exit 1
fi

echo "OK: no raw hex codes outside token source files"
