// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { config } from '../config.js'

/**
 * A channel's default public URL is its wildcard subdomain (slug.tahti.live),
 * served by the tahti-player SPA (packages/tahti-web), which maps the host to the
 * channel. Only derivable when the app origin is the apex or follows the app.<root> convention —
 * local/dev hosts (localhost, IPs) have no wildcard DNS, so fall back to the
 * in-app path.
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
    if (hostname === 'tahti.live' || hostname === 'www.tahti.live') {
      return `${protocol}//${slug}.tahti.live${suffix}`
    }
    if (hostname === 'staging.tahti.live' || hostname === 'www.staging.tahti.live') {
      return `${protocol}//${slug}.staging.tahti.live${suffix}`
    }
  } catch {
    // fall through to path-based URL
  }
  return `${appUrl}/c/${slug}${suffix}`
}
