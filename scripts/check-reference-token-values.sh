#!/usr/bin/env bash
# Verifies core layout + color values in production tokens match reference/tokens.css.
set -euo pipefail

cd "$(dirname "$0")/.."

REF="reference/tokens.css"
PROD="packages/ui/src/tokens.css"

if [[ ! -f "$REF" || ! -f "$PROD" ]]; then
  echo "Missing token files: $REF or $PROD"
  exit 1
fi

check_value() {
  local name="$1"
  local ref_val prod_val
  ref_val=$(grep -E "^\s*${name}:" "$REF" | head -1 | sed 's/.*:\s*//' | sed 's/;.*//' | tr -d ' ')
  prod_val=$(grep -E "^\s*${name}:" "$PROD" | head -1 | sed 's/.*:\s*//' | sed 's/;.*//' | tr -d ' ')
  if [[ -z "$ref_val" || -z "$prod_val" ]]; then
    echo "SKIP $name (not in both files)"
    return 0
  fi
  if [[ "$ref_val" != "$prod_val" ]]; then
    echo "MISMATCH $name: reference=$ref_val production=$prod_val"
    return 1
  fi
  echo "OK $name=$ref_val"
}

failed=0
for name in --sidebar-w --chat-w --content-max --public-max --narrow-max; do
  check_value "$name" || failed=1
done

if ! grep -qE '^\s*--cover-lg:\s*140px' "$PROD"; then
  echo "MISMATCH --cover-lg: expected 140px in $PROD"
  failed=1
else
  echo "OK --cover-lg=140px"
fi

# Stat colors — production aliases must point at legacy tokens with reference hex
declare -A stat_hex=(
  [--stat-plays]=FFB840
  [--stat-downloads]=3FE07A
  [--stat-fans]=A78BFA
  [--stat-revenue]=22D3EE
)
for name in "${!stat_hex[@]}"; do
  hex="${stat_hex[$name]}"
  target=$(grep -E "^\s*${name}:" "$PROD" | head -1 | sed 's/.*var(--\([^)]*\)).*/\1/' || true)
  if [[ -z "$target" ]]; then
    echo "SKIP $name"
    continue
  fi
  if grep -qi "#${hex}" "$PROD"; then
    echo "OK $name -> --$target (#${hex})"
  else
    echo "MISMATCH $name: hex #${hex} not found in production tokens"
    failed=1
  fi
done

if [[ "$failed" -ne 0 ]]; then
  echo ""
  echo "Reference token values diverge from production. Sync packages/ui/src/tokens.css."
  exit 1
fi

echo ""
echo "OK: reference layout tokens and stat colors match production"
