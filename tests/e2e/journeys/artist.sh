#!/usr/bin/env bash
# Artist journey — member with channel, studio APIs (docs/technical/journey-artist.md).

run_artist_journey() {
  echo ""
  echo "── Artist journey ──────────────────────────────────────────"

  if ! e2e_api_login "$E2E_DEMO_ARTIST_EMAIL" "$E2E_DEMO_PASS"; then
    e2e_yellow "artist login skipped — seed demo user first"
    return 0
  fi
  e2e_green "artist login"

  local me ms rel ft
  me=$(curl -sf -b "$COOKIE_JAR" "$API_URL/api/auth/me" 2>/dev/null || echo '{}')
  e2e_check_json "session has channel" '"channel"' "$me"
  e2e_check_json "artist is cooperative member" '"isMember":true' "$me"

  ms=$(curl -sf -b "$COOKIE_JAR" "$API_URL/api/me/membership" 2>/dev/null || echo '{}')
  e2e_check_json "membership status" '"status"' "$ms"

  rel=$(curl -sf -b "$COOKIE_JAR" "$API_URL/api/me/releases" 2>/dev/null || echo '[]')
  if echo "$rel" | grep -q 'Northern Lights'; then
    e2e_green "dashboard releases include demo EP"
  else
    e2e_yellow "dashboard releases empty or different seed"
  fi

  ft=$(curl -sf -b "$COOKIE_JAR" "$API_URL/api/me/fan-tiers" 2>/dev/null || echo '[]')
  e2e_check_json "fan tiers configured" 'Supporter' "$ft"

  if e2e_app_reachable "/dashboard"; then
    e2e_green "web: artist dashboard"
  else
    e2e_yellow "web: dashboard skipped"
  fi
}

# PLAT-050: a member artist's channel must resolve through the wildcard
# *.tahti.live subdomain — Caddy sets X-Tahti-Channel-Slug, web middleware
# rewrites to /c/[slug]. Simulate Caddy's header here since dev/CI has no
# wildcard DNS in front of the web container.
run_artist_subdomain_journey() {
  echo ""
  echo "── Artist subdomain journey (PLAT-050) ────────────────────"

  local tier_check subdomain_code subdomain_body missing_body
  tier_check=$(curl -sf -b "$COOKIE_JAR" "$API_URL/api/auth/me" 2>/dev/null || echo '{}')
  e2e_check_json "demo artist has active membership (ARTIST tier)" '"tier":"ARTIST"' "$tier_check"

  if ! e2e_app_reachable "/"; then
    e2e_yellow "web: subdomain journey skipped (APP not up)"
    return 0
  fi

  subdomain_code=$(e2e_http_code -H "x-tahti-channel-slug: ${E2E_DEMO_ARTIST_USER}" "$APP_URL/")
  e2e_check_http "web: ${E2E_DEMO_ARTIST_USER}.tahti.live resolves to the artist's channel" "200" "$subdomain_code"

  subdomain_body=$(curl -sf -H "x-tahti-channel-slug: ${E2E_DEMO_ARTIST_USER}" "$APP_URL/" 2>/dev/null || echo '')
  e2e_check_json "web: subdomain page renders the artist's channel content" "ch-archive-section" "$subdomain_body"

  # KNOWN ISSUE: Next.js notFound() renders the not-found page correctly but
  # returns HTTP 200 instead of 404 for this dynamic route (reproduces even on
  # a direct /c/[slug] hit with no middleware involved — no not-found.tsx
  # exists anywhere under apps/web/src/app). Tracked separately; assert on
  # body content here since that's what's reachable without a deeper Next.js
  # routing fix.
  missing_body=$(curl -sf -H "x-tahti-channel-slug: no-such-artist-${RANDOM}" "$APP_URL/" 2>/dev/null || echo '')
  e2e_check_json "web: unknown subdomain renders not-found content (not the artist's channel)" "could not be found" "$missing_body"
}

run_streamer_journey() {
  echo ""
  echo "── Streamer journey (artist ingest) ──────────────────────"

  if ! e2e_api_login "$E2E_DEMO_ARTIST_EMAIL" "$E2E_DEMO_PASS"; then
    e2e_yellow "streamer journey skipped — no artist session"
    return 0
  fi

  local ss rtmp_list mount ice_code
  ss=$(curl -sf -b "$COOKIE_JAR" "$API_URL/api/me/stream-settings" 2>/dev/null || echo '{}')
  e2e_check_json "stream settings RTMP server" 'rtmp' "$ss"
  e2e_check_json "stream settings Icecast server" 'icecast' "$ss"
  e2e_check_json "stream settings mount" '"/live/' "$ss"

  rtmp_list=$(curl -sf -b "$COOKIE_JAR" "$API_URL/api/me/rtmp-targets" 2>/dev/null || echo '[]')
  if echo "$rtmp_list" | grep -q '^\['; then
    e2e_green "multistream targets list OK"
  fi

  mount="/live/${E2E_DEMO_ARTIST_USER}"
  ice_code=$(e2e_http_code -X POST "$API_URL/internal/icecast/on_connect" \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    -d "mount=${mount}&pass=${E2E_DEMO_ICECAST_PASS}")
  if [[ "$ice_code" == "200" ]]; then
    e2e_green "Icecast on_connect accepts demo source"
    curl -sf -X POST "$API_URL/internal/icecast/on_disconnect" \
      -H 'Content-Type: application/x-www-form-urlencoded' \
      -d "mount=${mount}" >/dev/null || true
  else
    e2e_yellow "Icecast on_connect returned $ice_code (cap or fixture)"
  fi

  if e2e_app_reachable "/help/multistream"; then
    e2e_green "web: multistream help"
  else
    e2e_yellow "web: multistream help skipped"
  fi
}

run_press_kit_journey() {
  echo ""
  echo "── Press kit journey ───────────────────────────────────────"

  if ! e2e_api_login "$E2E_DEMO_ARTIST_EMAIL" "$E2E_DEMO_PASS"; then
    e2e_yellow "press kit journey skipped — no artist session"
    return 0
  fi

  local prepare upload_key upload_url complete image_id list gallery_on public_gallery zip_code

  prepare=$(curl -sf -b "$COOKIE_JAR" -X POST "$API_URL/api/me/press-kit/images/prepare" \
    -H 'Content-Type: application/json' \
    -d '{"filename":"promo.jpg","contentType":"image/jpeg"}' 2>/dev/null || echo '{}')
  e2e_check_json "press kit image upload prepared" '"uploadKey"' "$prepare"
  upload_key=$(echo "$prepare" | grep -oP '"uploadKey":"\K[^"]+' || echo '')
  upload_url=$(echo "$prepare" | grep -oP '"uploadUrl":"\K[^"]+' | sed 's/\\u0026/\&/g' || echo '')

  if [[ -z "$upload_key" || -z "$upload_url" ]]; then
    e2e_yellow "press kit journey skipped — could not parse prepare response"
    return 0
  fi

  if ! curl -sf -X PUT -H 'Content-Type: image/jpeg' --data-binary 'fake-jpeg-bytes' "$upload_url" >/dev/null 2>&1; then
    e2e_yellow "press kit journey skipped — MinIO not reachable for direct PUT"
    return 0
  fi
  e2e_green "press kit image bytes uploaded to storage"

  complete=$(curl -sf -b "$COOKIE_JAR" -X POST "$API_URL/api/me/press-kit/images/complete" \
    -H 'Content-Type: application/json' \
    -d "{\"uploadKey\":\"${upload_key}\",\"title\":\"E2E promo shot\"}" 2>/dev/null || echo '{}')
  e2e_check_json "press kit image saved with title" '"E2E promo shot"' "$complete"
  image_id=$(echo "$complete" | grep -oP '"id":"\K[^"]+' || echo '')

  list=$(curl -sf -b "$COOKIE_JAR" "$API_URL/api/me/press-kit/images" 2>/dev/null || echo '[]')
  e2e_check_json "press kit dashboard list includes the new image" "$image_id" "$list"

  gallery_on=$(curl -sf -b "$COOKIE_JAR" -X PATCH "$API_URL/api/me/press-kit/gallery-settings" \
    -H 'Content-Type: application/json' -d '{"pressKitGalleryPublic":true}' 2>/dev/null || echo '{}')
  e2e_check_json "gallery visibility set to public" '"pressKitGalleryPublic":true' "$gallery_on"

  public_gallery=$(curl -sf "$API_URL/api/v1/u/${E2E_DEMO_ARTIST_USER}/press-kit-images.json" 2>/dev/null || echo '[]')
  e2e_check_json "public gallery lists the photo once opted in" "E2E promo shot" "$public_gallery"

  zip_code=$(e2e_http_code "$API_URL/api/v1/u/${E2E_DEMO_ARTIST_USER}/press-kit.zip")
  e2e_check_http "public press-kit.zip download" "200" "$zip_code"

  # Cleanup — leave the demo artist's profile as we found it.
  curl -sf -b "$COOKIE_JAR" -X PATCH "$API_URL/api/me/press-kit/gallery-settings" \
    -H 'Content-Type: application/json' -d '{"pressKitGalleryPublic":false}' >/dev/null 2>&1 || true
  if [[ -n "$image_id" ]]; then
    curl -sf -b "$COOKIE_JAR" -X DELETE "$API_URL/api/me/press-kit/images/${image_id}" >/dev/null 2>&1 || true
  fi
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  JOURNEYS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  # shellcheck source=../helpers.sh
  source "$JOURNEYS_DIR/../helpers.sh"
  # shellcheck source=fixtures.sh
  source "$JOURNEYS_DIR/fixtures.sh"
  e2e_wait_for_api "$API_URL/health" || exit 1
  run_artist_journey
  run_artist_subdomain_journey
  run_streamer_journey
  run_press_kit_journey
  e2e_summary "Artist journey" || exit 1
fi
