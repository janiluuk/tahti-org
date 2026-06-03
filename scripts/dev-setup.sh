#!/usr/bin/env bash
# First-time developer setup for Tahti.
# Run once after cloning the repo.
#
# Usage: ./scripts/dev-setup.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

green() { printf "\033[32m✓\033[0m %s\n" "$1"; }
blue()  { printf "\033[34m→\033[0m %s\n" "$1"; }
red()   { printf "\033[31m✗\033[0m %s\n" "$1"; exit 1; }

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   Tahti dev environment setup        ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── Prerequisites ─────────────────────────────────────────────────────────

blue "Checking prerequisites..."

command -v docker   &>/dev/null || red "docker not found — install Docker Desktop or Docker Engine"
command -v node     &>/dev/null || red "node not found — install Node.js 24 LTS"
command -v pnpm     &>/dev/null || red "pnpm not found — run: npm install -g pnpm"
command -v make     &>/dev/null || red "make not found"

NODE_VER=$(node -e "process.stdout.write(process.versions.node)")
NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
[[ $NODE_MAJOR -ge 24 ]] || red "Node.js 24+ required (found $NODE_VER)"

green "Prerequisites OK (node $NODE_VER)"

# ── Env files ─────────────────────────────────────────────────────────────

blue "Copying env templates..."

if [[ ! -f api/.env ]]; then
  [[ -f api/.env.dev.example ]] && cp api/.env.dev.example api/.env && green "api/.env created" || true
fi

if [[ ! -f web/.env.local ]]; then
  [[ -f web/.env.dev.example ]] && cp web/.env.dev.example web/.env.local && green "web/.env.local created" || true
fi

# ── Dependencies ──────────────────────────────────────────────────────────

blue "Installing pnpm dependencies..."
pnpm install --frozen-lockfile 2>/dev/null || pnpm install
green "Dependencies installed"

# ── Infra ─────────────────────────────────────────────────────────────────

blue "Starting local infra (postgres, redis, minio, chat, mailhog)..."
make dev
sleep 8   # let postgres + minio reach healthy state

blue "Waiting for postgres to be ready..."
for i in $(seq 1 30); do
  docker compose -f infra/docker-compose.dev.yml exec -T postgres \
    pg_isready -U tahti -d tahti &>/dev/null && break
  sleep 2
done
green "Postgres ready"

# ── Database migrations ───────────────────────────────────────────────────

if [[ -d packages/db ]]; then
  blue "Running database migrations..."
  pnpm --filter @tahti/db db:migrate 2>/dev/null || \
    pnpm --filter @tahti/db exec prisma migrate dev --skip-seed 2>/dev/null || true
  green "Migrations applied"
fi

# ── Done ──────────────────────────────────────────────────────────────────

echo ""
echo "── Ready ────────────────────────────────────────────────"
echo "   Marketing site:   http://localhost:8080"
echo "   API (start with): pnpm --filter @tahti/api dev  → :3000"
echo "   Web (start with): pnpm --filter @tahti/web dev  → :3001"
echo "   MailHog:          http://localhost:8025"
echo "   MinIO console:    http://localhost:9001  (tahti / tahti_dev_secret)"
echo "   Centrifugo admin: http://localhost:8000/admin  (password: dev)"
echo "   Icecast:          http://localhost:8100"
echo ""
echo "   Run tests:        pnpm test"
echo "   Phase 2 checks:   ./tests/e2e/phase-2.sh"
echo ""
