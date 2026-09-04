#!/usr/bin/env bash
# Print the Tahti Radio Discord bot source directory (must contain Dockerfile).
# Used by deploy_prod.sh and stack-up.sh.
#
# Override: RADIO_DISCORD_BOT_SRC=/path/to/tahti-radio-discord-bot
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

candidates=()
if [[ -n "${RADIO_DISCORD_BOT_SRC:-}" ]]; then
  candidates+=("$RADIO_DISCORD_BOT_SRC")
fi
candidates+=("$ROOT/../tahti-radio-discord-bot")
candidates+=("$ROOT/services/radio-discord-bot")

for dir in "${candidates[@]}"; do
  if [[ -f "$dir/Dockerfile" ]]; then
    cd "$dir" && pwd
    exit 0
  fi
done

exit 1
