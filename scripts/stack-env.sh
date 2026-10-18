#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Tahti ry <https://tahti.live>
#
# Read and change production overrides in infra/stack.env on the deploy host,
# then restart only the services that read them. Every change makes a dated
# backup first, so `restore` can undo it.
#
# Usage:
#   ./scripts/stack-env.sh list [PATTERN]          keys and values (secrets masked)
#   ./scripts/stack-env.sh get KEY [--reveal]      one value
#   ./scripts/stack-env.sh set KEY=VALUE [...]     add or replace keys
#   ./scripts/stack-env.sh unset KEY [...]         remove keys (stack defaults apply again)
#   ./scripts/stack-env.sh preset NAME             apply a named preset (see `presets`)
#   ./scripts/stack-env.sh presets                 list presets
#   ./scripts/stack-env.sh backups                 list backups
#   ./scripts/stack-env.sh diff [BACKUP]           compare with a backup (default: latest)
#   ./scripts/stack-env.sh restore [BACKUP]        put a backup back (default: latest)
#   ./scripts/stack-env.sh apply [SERVICE ...]     recreate services so they pick the file up (default: api)
#
#   set / unset / preset / restore take --apply to restart the api right away,
#   and --dry-run to only print what would change.
#
# Examples:
#   ./scripts/stack-env.sh preset ratelimit-loose --apply
#   ./scripts/stack-env.sh set RATE_LIMIT_AUTH_MAX=600 --apply
#   ./scripts/stack-env.sh preset ratelimit-default --apply
#
# Targets (same as deploy_prod.sh):
#   DEPLOY_HOST         SSH host alias (default: vimage); `local` runs on this machine
#   DEPLOY_PATH         project path on the host (default: /srv/tahti)
#   SWARM_STACK         Swarm stack name when the api runs as a service (default: tahti)
#   SWARM_ENV_PREFIXES  keys pushed to Swarm services on apply (default: RATE_LIMIT_ DOWNLOAD_RATE_);
#                       compose reads the whole file, Swarm only gets these via --env-add. A key is
#                       only --env-rm'd if this script pushed it earlier (infra/stack.env.swarm-<svc>),
#                       so values set in docker-stack.yml (RATE_LIMIT_REDIS_FAIL_OPEN) are left alone
#
set -euo pipefail

HOST="${DEPLOY_HOST:-vimage}"
REMOTE_PATH="${DEPLOY_PATH:-/srv/tahti}"
SWARM_STACK="${SWARM_STACK:-tahti}"
SWARM_ENV_PREFIXES="${SWARM_ENV_PREFIXES:-RATE_LIMIT_ DOWNLOAD_RATE_}"

preset_body() {
  case "$1" in
    ratelimit-loose)
      echo "set RATE_LIMIT_AUTH_MAX=2000 RATE_LIMIT_API_MAX=20000"
      ;;
    ratelimit-default)
      echo "unset RATE_LIMIT_AUTH_MAX RATE_LIMIT_API_MAX"
      ;;
    *)
      return 1
      ;;
  esac
}

preset_help() {
  cat <<'EOF'
ratelimit-loose    RATE_LIMIT_AUTH_MAX=2000, RATE_LIMIT_API_MAX=20000 (load and e2e runs)
ratelimit-default  remove both overrides, back to the stack defaults (120 / 2000 per IP per minute)
EOF
}

usage() {
  sed -n '6,36p' "$0" | sed 's/^# \{0,1\}//'
}

die() {
  echo "stack-env: $*" >&2
  exit 1
}

run_remote() {
  if [[ "$HOST" == "local" ]]; then
    bash -s -- "$@"
  else
    ssh "$HOST" bash -s -- "$@"
  fi
}

remote_script() {
  cat <<'REMOTE'
set -euo pipefail
cd "$1"
cmd="$2"
shift 2
ENV_FILE="infra/stack.env"
BACKUP_DIR="infra/stack.env.backups"

mask() {
  local key="$1" value="$2"
  if [[ "$key" =~ (SECRET|PASS|TOKEN|_KEY$|PRIVATE|DSN|CREDENTIAL) ]] || [[ "$value" =~ ://[^/]*@ ]]; then
    if [[ -n "$value" ]]; then
      printf '%s***' "${value:0:2}"
    fi
  else
    printf '%s' "$value"
  fi
}

latest_backup() {
  ls -1t "$BACKUP_DIR"/stack.env.* 2>/dev/null | head -1
}

backup() {
  mkdir -p "$BACKUP_DIR"
  local dest
  dest="$BACKUP_DIR/stack.env.$(date +%Y%m%d-%H%M%S)"
  cp -p "$ENV_FILE" "$dest"
  echo "backup: $dest"
}

[[ -f "$ENV_FILE" ]] || touch "$ENV_FILE"

case "$cmd" in
  list)
    pattern="${1:-}"
    grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$ENV_FILE" | while IFS= read -r line; do
      key="${line%%=*}"
      [[ -z "$pattern" || "$key" == *"$pattern"* ]] || continue
      printf '%s=%s\n' "$key" "$(mask "$key" "${line#*=}")"
    done || true
    ;;
  get)
    key="$1"
    reveal="${2:-}"
    line="$(grep -E "^${key}=" "$ENV_FILE" | tail -1 || true)"
    [[ -n "$line" ]] || { echo "(not set — the stack default applies)"; exit 0; }
    if [[ "$reveal" == "--reveal" ]]; then
      printf '%s\n' "${line#*=}"
    else
      printf '%s\n' "$(mask "$key" "${line#*=}")"
    fi
    ;;
  set | unset)
    dry="$1"
    shift
    if [[ "$dry" != "1" ]]; then
      backup
    fi
    for arg in "$@"; do
      decoded="$(printf '%s' "$arg" | base64 -d)"
      key="${decoded%%=*}"
      old="$(grep -E "^${key}=" "$ENV_FILE" | tail -1 || true)"
      before="(unset)"
      [[ -n "$old" ]] && before="$(mask "$key" "${old#*=}")"
      after="(unset)"
      [[ "$cmd" == "set" ]] && after="$(mask "$key" "${decoded#*=}")"
      echo "${key}: ${before} -> ${after}"
      [[ "$dry" == "1" ]] && continue
      tmp="$(mktemp)"
      grep -vE "^${key}=" "$ENV_FILE" > "$tmp" || true
      if [[ "$cmd" == "set" ]]; then
        printf '%s\n' "$decoded" >> "$tmp"
      fi
      cat "$tmp" > "$ENV_FILE"
      rm -f "$tmp"
    done
    ;;
  backups)
    ls -1t "$BACKUP_DIR"/stack.env.* 2>/dev/null || echo "(no backups)"
    ;;
  diff)
    target="${1:-$(latest_backup)}"
    [[ -n "$target" && -f "$target" ]] || { echo "no backup to compare with"; exit 1; }
    echo "--- $target"
    echo "+++ $ENV_FILE"
    diff <(grep -E '^[A-Za-z_]' "$target" | sort) <(grep -E '^[A-Za-z_]' "$ENV_FILE" | sort) \
      | sed -E 's/^([<>] [A-Za-z0-9_]*(SECRET|PASS|TOKEN|_KEY|PRIVATE|DSN|CREDENTIAL)[A-Za-z0-9_]*=).*/\1***/' || true
    ;;
  restore)
    dry="$1"
    target="${2:-$(latest_backup)}"
    [[ -n "$target" && -f "$target" ]] || { echo "no backup to restore"; exit 1; }
    echo "restore: $target -> $ENV_FILE"
    [[ "$dry" == "1" ]] && exit 0
    backup
    cp -p "$target" "$ENV_FILE"
    ;;
  apply)
    stack="$1"
    prefixes="$2"
    shift 2
    services=("$@")
    if command -v docker >/dev/null 2>&1 \
      && docker service ls --format '{{.Name}}' 2>/dev/null | grep -qx "${stack}_${services[0]}"; then
      for svc in "${services[@]}"; do
        managed="infra/stack.env.swarm-${svc}"
        touch "$managed"
        args=()
        pushed=()
        for prefix in $prefixes; do
          while IFS= read -r line; do
            [[ -n "$line" ]] || continue
            args+=(--env-add "$line")
            pushed+=("${line%%=*}")
          done < <(grep -E "^${prefix}[A-Z0-9_]*=" "$ENV_FILE" || true)
        done
        while IFS= read -r key; do
          [[ -n "$key" ]] || continue
          grep -qE "^${key}=" "$ENV_FILE" || args+=(--env-rm "$key")
        done <"$managed"
        if [[ ${#args[@]} -eq 0 ]]; then
          echo "swarm: nothing to change on ${stack}_${svc}"
          continue
        fi
        echo "swarm: docker service update ${args[*]%%=*} ${stack}_${svc}"
        docker service update --detach=false "${args[@]}" "${stack}_${svc}"
        printf '%s\n' "${pushed[@]+"${pushed[@]}"}" | sed '/^$/d' >"$managed"
      done
    else
      echo "compose: up -d --no-deps ${services[*]}"
      docker compose -f infra/docker-compose.stack.yml --profile marketing \
        --env-file "$ENV_FILE" up -d --no-deps "${services[@]}"
      for _ in $(seq 1 30); do
        if curl -sf http://127.0.0.1:15011/health >/dev/null 2>&1; then
          echo "api healthy"
          break
        fi
        sleep 2
      done
    fi
    ;;
  *)
    echo "unknown remote command: $cmd" >&2
    exit 1
    ;;
esac
REMOTE
}

remote() {
  run_remote "$REMOTE_PATH" "$@" < <(remote_script)
}

DRY=0
APPLY=0
ARGS=()
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY=1 ;;
    --apply) APPLY=1 ;;
    -h | --help)
      usage
      exit 0
      ;;
    *) ARGS+=("$arg") ;;
  esac
done
set -- "${ARGS[@]+"${ARGS[@]}"}"

[[ $# -ge 1 ]] || {
  usage
  exit 1
}
CMD="$1"
shift

encode_pairs() {
  local pair
  for pair in "$@"; do
    printf '%s' "$pair" | base64 | tr -d '\n'
    printf ' '
  done
}

check_key() {
  [[ "$1" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || die "invalid key: $1"
}

change() {
  local verb="$1"
  shift
  [[ $# -ge 1 ]] || die "$verb needs at least one key"
  local pair
  for pair in "$@"; do
    if [[ "$verb" == "set" ]]; then
      [[ "$pair" == *=* ]] || die "set expects KEY=VALUE, got: $pair"
      check_key "${pair%%=*}"
    else
      check_key "$pair"
    fi
  done
  local encoded
  read -r -a encoded <<<"$(encode_pairs "$@")"
  remote "$verb" "$DRY" "${encoded[@]}"
}

finish() {
  if [[ "$APPLY" == "1" && "$DRY" == "0" ]]; then
    remote apply "$SWARM_STACK" "$SWARM_ENV_PREFIXES" api
  elif [[ "$DRY" == "0" ]]; then
    echo "Not applied yet. Run: $0 apply"
  fi
}

case "$CMD" in
  list) remote list "${1:-}" ;;
  get)
    [[ $# -ge 1 ]] || die "get needs a key"
    check_key "$1"
    remote get "$1" "${2:-}"
    ;;
  set | unset)
    change "$CMD" "$@"
    finish
    ;;
  preset)
    [[ $# -ge 1 ]] || die "preset needs a name (see: $0 presets)"
    body="$(preset_body "$1")" || die "unknown preset: $1 (see: $0 presets)"
    read -r -a words <<<"$body"
    change "${words[0]}" "${words[@]:1}"
    finish
    ;;
  presets) preset_help ;;
  backups) remote backups ;;
  diff) remote diff "${1:-}" ;;
  restore)
    remote restore "$DRY" "${1:-}"
    finish
    ;;
  apply)
    if [[ $# -eq 0 ]]; then
      set -- api
    fi
    remote apply "$SWARM_STACK" "$SWARM_ENV_PREFIXES" "$@"
    ;;
  *)
    usage
    exit 1
    ;;
esac
