#!/usr/bin/env bash
# Reclaims Docker Desktop disk space that silently accumulates on this host:
# build cache (grows unbounded, 0% of it is ever "active" once a build
# finishes) and dangling images (superseded layers from repeated local
# builds of api/web/worker/orchestrator). Confirmed live 2026-09-11: build
# cache alone was 17.9GB with 0 active entries, and the host had only 6.7GB
# free — see docs/todo/HISTORY.md for the incident this was written for.
#
# Safe to run anytime: never touches running containers, named volumes, or
# tagged images still in use (only dangling/untagged ones and build cache).
set -euo pipefail

echo "── Docker disk usage before ──────────────────────────────"
docker system df

echo ""
echo "── Pruning build cache ───────────────────────────────────"
docker builder prune -af

echo ""
echo "── Pruning dangling images ───────────────────────────────"
docker image prune -f

echo ""
echo "── Docker disk usage after ───────────────────────────────"
docker system df

echo ""
df -h / | awk 'NR==1 || NR==2'
