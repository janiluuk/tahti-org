#!/usr/bin/env bash
# Initialize MinIO buckets, lifecycle policies, and access rules for production.
# Run ONCE after the first production deploy (Phase 3).
#
# Usage: ./scripts/init-minio-buckets.sh
# Requires: mc (MinIO Client) installed and the Swarm stack running.

set -euo pipefail

green() { printf "\033[32m✓\033[0m %s\n" "$1"; }
blue()  { printf "\033[34m→\033[0m %s\n" "$1"; }

# ── Read MinIO credentials from Docker secret ─────────────────────────────
MINIO_PASS=$(docker exec "$(docker ps -qf name=tahti_minio)" \
  cat /run/secrets/minio_root_password 2>/dev/null) || \
  read -rsp "MinIO root password: " MINIO_PASS

# ── Configure mc alias ────────────────────────────────────────────────────
blue "Configuring mc alias..."
mc alias set tahti http://localhost:9000 tahti "$MINIO_PASS" --api s3v4
green "mc alias set"

# ── Create buckets ────────────────────────────────────────────────────────
for bucket in audio covers hls-live recordings backups; do
  mc mb --ignore-existing "tahti/$bucket"
  green "Bucket: $bucket"
done

# ── Lifecycle policies ────────────────────────────────────────────────────

blue "Setting lifecycle: hls-live → 1 day expiry (live HLS segments)"
mc ilm add --expiry-days 1 tahti/hls-live
green "hls-live lifecycle set"

blue "Setting lifecycle: recordings → 7 days expiry (raw before transcode)"
mc ilm add --expiry-days 7 tahti/recordings
green "recordings lifecycle set"

blue "Setting lifecycle: backups → 90 days expiry"
mc ilm add --expiry-days 90 tahti/backups
green "backups lifecycle set"

# audio and covers: no expiry — data lives as long as artist is active

# ── Access policies ───────────────────────────────────────────────────────

blue "Setting public-read on covers/ (artwork, avatars — public assets)"
mc anonymous set download tahti/covers
green "covers: public-read"

# hls-live is served via Caddy (not directly from MinIO), so no public access needed.
# audio, recordings, backups: private — API serves via presigned URLs.

# ── Verify ────────────────────────────────────────────────────────────────
echo ""
echo "── Bucket summary ───────────────────────────────────────"
mc ls tahti/
echo ""
echo "── Lifecycle rules ──────────────────────────────────────"
mc ilm ls tahti/hls-live
mc ilm ls tahti/recordings
mc ilm ls tahti/backups
echo ""
echo "Done."
