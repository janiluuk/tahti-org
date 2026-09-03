// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// The ONLY place an Addon's code ever executes. Deliberately a plain
// Route Handler, not a page.tsx — a React/Next page would pull in the
// framework's own hydration bootstrap scripts, which the sandbox route's
// `script-src 'self'` CSP (next.config.mjs) would then also have to permit,
// widening what's allowed to run here well past "exactly one widget bundle".
// A hand-written HTML string has none of that: the only script this document
// ever references is the one <script> tag below.
//
// AddonFrame (apps/web) embeds this in a sandboxed <iframe
// sandbox="allow-scripts"> with no allow-same-origin — that's what actually
// contains the widget's code (opaque origin: no cookies, no parent DOM, no
// storage). The bundle's own integrity is separately pinned by Subresource
// Integrity on the <script> tag (bundleHashToIntegrity, @tahti/shared),
// computed from the URL's bundleHash alone — a bundle can't be silently
// swapped post-approval without a version bump minting a new hash/URL.
// An unknown hash isn't rejected here; the /widget-sandbox/bundle/[hash]
// script request 404s on its own, leaving an inert (not broken-looking to
// anyone but the widget author) empty sandboxed page.

import { bundleHashToIntegrity, isValidBundleHashHex } from '@tahti/shared'
import { ADDON_ROOT_ELEMENT_ID } from '@tahti/addon-sdk'

function escapeHtmlAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

export async function GET(
  _request: Request,
  { params }: { params: { bundleHash: string } },
): Promise<Response> {
  if (!isValidBundleHashHex(params.bundleHash)) {
    return new Response('Not found', { status: 404 })
  }

  const bundleSrc = `/widget-sandbox/bundle/${params.bundleHash}`
  const integrity = escapeHtmlAttr(bundleHashToIntegrity(params.bundleHash))

  const html = `<!doctype html>
<html>
<head><meta charset="utf-8"></head>
<body>
<div id="${ADDON_ROOT_ELEMENT_ID}"></div>
<script type="module" src="${bundleSrc}" integrity="${integrity}"></script>
</body>
</html>`

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
