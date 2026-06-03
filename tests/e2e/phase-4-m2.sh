#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Tahti ry <https://tahti.live>
#
# Phase 4 M2 exit-criteria smoke test.
# Usage: API_URL=http://localhost:3001 tests/e2e/phase-4-m2.sh
set -euo pipefail

API="${API_URL:-http://localhost:3001}"
PASS=0
FAIL=0

ok()   { echo "  PASS: $*"; ((PASS++)); }
fail() { echo "  FAIL: $*"; ((FAIL++)); }

echo "=== Phase 4 M2 smoke tests ==="
echo "    API: $API"
echo ""

# 1. Prepare upload without auth should return 401
echo "1. Prepare upload requires auth"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/api/uploads/prepare" \
  -H "Content-Type: application/json" \
  -d '{"filename":"test.mp3","contentType":"audio/mpeg","fileSizeBytes":1024,"title":"Test"}')
if [ "$STATUS" = "401" ]; then ok "401 without session"; else fail "expected 401, got $STATUS"; fi

# 2. Register + login to get a session
echo ""
echo "2. Register and login"
RND=$RANDOM
EMAIL="m2test${RND}@example.com"
USERNAME="m2tst${RND}"

REG=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"testpassword123\",\"username\":\"$USERNAME\",\"displayName\":\"M2 Test\"}")
if [ "$REG" = "201" ]; then ok "registration returned 201"; else fail "registration returned $REG"; fi

# Manually verify email (patch DB) — skip in simple e2e; assume dev DB is available via psql
# Instead test channel page (public) without auth

# 3. GET /api/channels/:slug returns 404 for unknown slug
echo ""
echo "3. Channel GET"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API/api/channels/nonexistent-slug-xyz123")
if [ "$STATUS" = "404" ]; then ok "404 for unknown channel"; else fail "expected 404, got $STATUS"; fi

# 4. GET /api/channels/:slug/items returns 404 for unknown slug
echo ""
echo "4. Channel items"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API/api/channels/nonexistent-slug-xyz123/items")
if [ "$STATUS" = "404" ]; then ok "404 for unknown channel items"; else fail "expected 404, got $STATUS"; fi

# 5. Known channel (slug = username) — created by registration
CHANNEL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API/api/channels/$USERNAME")
if [ "$CHANNEL_STATUS" = "200" ]; then
  ok "GET /api/channels/$USERNAME returns 200"
else
  fail "GET /api/channels/$USERNAME returned $CHANNEL_STATUS (channel might not exist yet)"
fi

ITEMS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API/api/channels/$USERNAME/items")
if [ "$ITEMS_STATUS" = "200" ]; then
  ok "GET /api/channels/$USERNAME/items returns 200"
else
  fail "GET /api/channels/$USERNAME/items returned $ITEMS_STATUS"
fi

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ]
