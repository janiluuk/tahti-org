// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Same-origin proxy for a widget bundle's raw JS — so the sandbox page's
// <script src integrity="..."> can reference a same-origin path (satisfying
// the sandbox route's `script-src 'self'` CSP in next.config.mjs) instead of
// pointing at the API's own origin directly.

import { isValidBundleHashHex } from '@tahti/shared'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

export async function GET(
  _request: Request,
  { params }: { params: { bundleHash: string } },
): Promise<Response> {
  if (!isValidBundleHashHex(params.bundleHash)) {
    return new Response('Not found', { status: 404 })
  }

  const upstream = await fetch(`${apiUrl}/api/v1/addons/bundle/${params.bundleHash}`, {
    cache: 'no-store',
  })
  if (!upstream.ok) {
    return new Response('Not found', { status: 404 })
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
