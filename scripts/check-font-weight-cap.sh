#!/usr/bin/env bash
# Fails if font-weight above 500 (600/700/bold) appears in @tahti/ui brand styles.
set -euo pipefail

cd "$(dirname "$0")/.."

PATHS=(
  packages/ui/src/components.css
  packages/ui/src/styles/brand-channel.css
  packages/ui/src/styles/brand-studio.css
  packages/ui/src/styles/brand-public.css
  packages/ui/src/styles/brand-gallery.css
  packages/ui/src/styles/embed.css
)

MATCHES=""
for path in "${PATHS[@]}"; do
  if [[ ! -f "$path" ]]; then
    continue
  fi
  found=$(grep -En 'font-weight:\s*(6|7)00|font-weight:\s*bold' "$path" || true)
  if [[ -n "$found" ]]; then
    MATCHES+="${path}:\n${found}\n"
  fi
done

if [[ -n "$MATCHES" ]]; then
  echo -e "Font-weight above 500 in brand UI CSS (v8 max is 500):"
  echo -e "$MATCHES"
  exit 1
fi

echo "OK: brand UI font-weights capped at 500"
