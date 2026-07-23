// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** Production app origin — never localhost in user-facing fallbacks. */
export const DEFAULT_APP_URL = 'https://app.tahti.live'

export function resolveAppUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? DEFAULT_APP_URL
  return raw.replace(/\/$/, '')
}

/**
 * An artist's default public URL is their wildcard subdomain (slug.tahti.live),
 * proxied by Caddy and rewritten to /c/[slug] by middleware.ts. Only derivable
 * when the app origin follows the app.<root> convention (production) — local/dev
 * hosts (localhost, IPs) have no wildcard DNS, so fall back to the in-app path.
 *
 * Pass `hash` to link to a specific element on the channel page (e.g. a track),
 * e.g. resolveChannelUrl('nova-drift', { hash: 'archive-item-123' }).
 */
export function resolveChannelUrl(slug: string, opts?: { hash?: string }): string {
  const suffix = opts?.hash ? `#${opts.hash}` : ''
  const appUrl = resolveAppUrl()
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
