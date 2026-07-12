// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { config } from '../config.js'

/**
 * An artist's default public URL is their wildcard subdomain (slug.tahti.live),
 * proxied by Caddy and rewritten to /c/[slug] by apps/web/src/middleware.ts. Only
 * derivable when the app origin follows the app.<root> convention (production) —
 * local/dev hosts (localhost, IPs) have no wildcard DNS, so fall back to the
 * in-app path. Mirrors apps/web/src/lib/app-url.ts's resolveChannelUrl — kept as
 * a separate copy since the API and web app don't share a runtime package for this.
 */
export function resolveArtistUrl(slugOrUsername: string): string {
  const appUrl = config.appUrl.replace(/\/$/, '')
  try {
    const { protocol, hostname } = new URL(appUrl)
    if (hostname.startsWith('app.')) {
      return `${protocol}//${slugOrUsername}.${hostname.slice('app.'.length)}`
    }
  } catch {
    // fall through to path-based URL
  }
  return `${appUrl}/u/${slugOrUsername}`
}
