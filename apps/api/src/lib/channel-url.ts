// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { config } from '../config.js'

/**
 * A channel's default public URL is its wildcard subdomain (slug.tahti.live),
 * proxied by Caddy and rewritten to /c/[slug] by apps/web/src/middleware.ts. Only
 * derivable when the app origin follows the app.<root> convention (production) —
 * local/dev hosts (localhost, IPs) have no wildcard DNS, so fall back to the
 * in-app path. Mirrors apps/web/src/lib/app-url.ts's resolveChannelUrl — kept as
 * a separate copy since the API and web app don't share a runtime package for this.
 *
 * Pass `hash` to link to a specific element on the channel page (e.g. a track).
 */
export function resolveChannelUrl(slug: string, opts?: { hash?: string }): string {
  const suffix = opts?.hash ? `#${opts.hash}` : ''
  const appUrl = config.appUrl.replace(/\/$/, '')
  try {
    const { protocol, hostname } = new URL(appUrl)
    if (hostname.startsWith('app.')) {
      return `${protocol}//${slug}.${hostname.slice('app.'.length)}${suffix}`
    }
  } catch {
    // fall through to path-based URL
  }
  return `${appUrl}/c/${slug}${suffix}`
}
