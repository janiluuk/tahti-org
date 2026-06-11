#!/usr/bin/env bash
# Maps reference HTML files to production routes for Pass 3 screenshot conformance.
# Capture at 1280×900 and 375×812; compare side-by-side with reference/.
set -euo pipefail

cat <<'EOF'
Design conformance routes (reference → production)

  reference/dashboard.html     → /dashboard          (artist session)
  reference/channel-live.html  → /c/<live-slug>      (channel LIVE)
  reference/release.html       → /r/<smart-link>     (release smart link)

Public routes (no reference file — use docs/e2e-screenshots/):

  /                        homepage
  /listen                  discover
  /u/<username>            artist profile
  /u/<username>/subscribe  fan subscribe
  /transparency            financial transparency
  /venues                  venue directory

Capture (local stack):

  ./scripts/stack-up.sh --seed
  WEB_PORT=17777 API_PORT=15011 ./scripts/stack-screenshots.sh
  ./scripts/stack-up.sh --down

Manual reference preview:

  npx --yes serve reference -p 8888
  # Open http://localhost:8888/dashboard.html at 1280px width
EOF
