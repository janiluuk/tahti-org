// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { config } from '../config.js'

function apexRoot(hostname: string): string | null {
  if (hostname.startsWith('app.')) {
    return hostname.slice('app.'.length)
  }
  if (hostname === 'tahti.live' || hostname === 'www.tahti.live') {
    return 'tahti.live'
  }
  if (hostname === 'staging.tahti.live' || hostname === 'www.staging.tahti.live') {
    return 'staging.tahti.live'
  }
  return null
}

/**
 * Full artist site URL on the wildcard subdomain (username.tahti.live).
 * Local/dev hosts without wildcard DNS fall back to the in-app `/u/` path.
 */
export function resolveArtistUrl(slugOrUsername: string): string {
  const appUrl = config.appUrl.replace(/\/$/, '')
  try {
    const { protocol, hostname } = new URL(appUrl)
    const root = apexRoot(hostname)
    if (root) {
      return `${protocol}//${slugOrUsername}.${root}`
    }
  } catch {
    // fall through to path-based URL
  }
  return `${appUrl}/u/${slugOrUsername}`
}

/**
 * Short Link page URL on the apex path (`tahti.live/u/username`) — the
 * Instagram / Linktree bio target. Distinct from {@link resolveArtistUrl}.
 */
export function resolveLinkPageUrl(username: string): string {
  const appUrl = config.appUrl.replace(/\/$/, '')
  try {
    const { protocol, hostname } = new URL(appUrl)
    const root = apexRoot(hostname)
    if (root) {
      return `${protocol}//${root}/u/${username}`
    }
  } catch {
    // fall through
  }
  return `${appUrl}/u/${username}`
}
