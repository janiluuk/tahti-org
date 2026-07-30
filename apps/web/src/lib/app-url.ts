// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** Production app origin — never localhost in user-facing fallbacks. */
export const DEFAULT_APP_URL = 'https://tahti.live'

export function resolveAppUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? DEFAULT_APP_URL
  return raw.replace(/\/$/, '')
}

/**
 * An artist's default public URL is their wildcard subdomain (slug.tahti.live),
 * proxied at the edge and rewritten to /c/[slug] by middleware.ts. Derivable when
 * the app origin is the apex (`tahti.live` / `www.tahti.live`) or the legacy
 * `app.<root>` host — local/dev hosts (localhost, IPs) have no wildcard DNS, so
 * fall back to the in-app path. Production never exposes /c/[slug] as a public
 * URL: Caddy + middleware 308 to the subdomain form.
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
    if (hostname === 'tahti.live' || hostname === 'www.tahti.live') {
      return `${protocol}//${slug}.tahti.live${suffix}`
    }
  } catch {
    // fall through to path-based URL
  }
  return `${appUrl}/c/${slug}${suffix}`
}
