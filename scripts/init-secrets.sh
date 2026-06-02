#!/usr/bin/env bash
# Create all Docker Swarm secrets for production.
# Run ONCE on the Swarm manager node after `docker swarm init`.
#
# Usage: sudo ./scripts/init-secrets.sh
#
# Each secret is read from stdin or generated. Values never touch disk.
# Existing secrets are skipped (docker secret create exits 1 if name exists).

set -euo pipefail

green() { printf "\033[32m✓\033[0m %s\n" "$1"; }
yellow(){ printf "\033[33m⚠\033[0m %s\n" "$1"; }
red()   { printf "\033[31m✗\033[0m %s\n" "$1"; exit 1; }

create_secret() {
  local name="$1"
  local value="$2"
  if docker secret inspect "$name" &>/dev/null; then
    yellow "Secret '$name' already exists — skipping"
  else
    printf '%s' "$value" | docker secret create "$name" -
    green "Created secret: $name"
  fi
}

create_random() {
  local name="$1"
  local bytes="${2:-32}"
  local fmt="${3:-base64}"
  if docker secret inspect "$name" &>/dev/null; then
    yellow "Secret '$name' already exists — skipping"
    return
  fi
  case "$fmt" in
    base64) openssl rand -base64 "$bytes" | tr -d '\n' | docker secret create "$name" - ;;
    hex)    openssl rand -hex "$bytes"     | tr -d '\n' | docker secret create "$name" - ;;
  esac
  green "Generated secret: $name"
}

# ── Validate we're on a Swarm manager ─────────────────────────────────────

docker info --format '{{.Swarm.LocalNodeState}}' | grep -q active || \
  red "Not a Swarm manager. Run: docker swarm init --advertise-addr <ip>"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   Tahti — init production secrets    ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "Secrets are encrypted at rest in the Swarm raft store."
echo "They are mounted as files under /run/secrets/ inside containers."
echo ""

# ── Postgres password ─────────────────────────────────────────────────────
# Used by: Postgres service, API DATABASE_URL
echo -n "Postgres password (leave blank to generate): "
read -rs PG_PASS; echo
if [[ -z "$PG_PASS" ]]; then
  create_random "pg_password" 32 base64
else
  create_secret "pg_password" "$PG_PASS"
fi

# ── MinIO root password ───────────────────────────────────────────────────
echo -n "MinIO root password (leave blank to generate): "
read -rs MINIO_PASS; echo
if [[ -z "$MINIO_PASS" ]]; then
  create_random "minio_root_password" 32 base64
else
  create_secret "minio_root_password" "$MINIO_PASS"
fi

# ── Session / JWT secret ──────────────────────────────────────────────────
create_random "session_secret" 48 base64

# ── RTMP stream key encryption key ───────────────────────────────────────
create_random "rtmp_key_encryption_key" 32 base64

# ── Centrifugo HMAC secret ────────────────────────────────────────────────
create_random "centrifugo_secret" 32 base64

# ── Chat fingerprint salt (rotated monthly by a cron job) ─────────────────
create_random "chat_fingerprint_salt" 32 hex

# ── External API keys — require manual entry ─────────────────────────────
for secret_name in revelator_api_key mixcloud_client_secret smtp_password \
                   stripe_secret_key stripe_webhook_secret \
                   ses_access_key_id ses_secret_access_key ses_region; do
  if ! docker secret inspect "$secret_name" &>/dev/null; then
    echo -n "Enter $secret_name (or press Enter to set placeholder): "
    read -rs VAL; echo
    if [[ -z "$VAL" ]]; then
      create_secret "$secret_name" "placeholder_replace_before_using"
      yellow "$secret_name set to placeholder — replace before using this feature"
    else
      create_secret "$secret_name" "$VAL"
    fi
  else
    yellow "$secret_name already exists — skipping"
  fi
done

# ── Verify ────────────────────────────────────────────────────────────────
echo ""
echo "── Current secrets ──────────────────────────────────────"
docker secret ls
echo ""
echo "Done. Deploy the stack with: make deploy TAG=<git-sha>"
