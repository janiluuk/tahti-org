// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// PLAT-050: subdomain routing + PLAT-051: custom domain routing.
//
// The reverse proxy sets X-Tahti-Channel-Slug for *.tahti.live hits (the subdomain label).
// It sets X-Tahti-Custom-Host for unknown hosts that have a custom domain configured.
// Both rewrite the bare root ("/") to /c/[slug], so typing the vanity URL lands on the
// channel page — but every other path (/dashboard, /login, /admin, ...) passes through
// untouched, so the full app works identically on <user>.tahti.live as on app.tahti.live.
// A user visiting their own subdomain while logged in should be able to use the whole app,
// not just see their own channel page.
//
// The site nav's "Home" link deliberately sends "/?home=1" instead of a bare "/" — see
// resolveHomeHref() in ChannelPageLayout.tsx. That marker means "the user explicitly clicked
// Home," so we skip the subdomain rewrite below and let the real homepage render on whatever
// origin they're already on. This keeps Home a same-origin relative link (so Next's <Link>
// can do a client-side transition) instead of forcing a cross-origin hard reload, which used
// to blow away the shared <audio> element and stop playback on every "go Home" click from a
// subdomain — never acceptable per the platform's "the music never stops" constitution value.

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const isRoot = request.nextUrl.pathname === '/'
  const isExplicitHomeNav = request.nextUrl.searchParams.get('home') === '1'
  const isRewritableRoot = isRoot && !isExplicitHomeNav

  // Fast path: reverse-proxy subdomain routing (slug.tahti.live → /c/slug)
  const channelSlug = request.headers.get('x-tahti-channel-slug')
  if (channelSlug) {
    if (isRewritableRoot) {
      const url = request.nextUrl.clone()
      // radio.tahti.live is the 24/7 Tahti Radio station, not an artist channel
      // (whose slug is 'tahti-radio', not 'radio') — send it to /radio instead.
      url.pathname = channelSlug === 'radio' ? '/radio' : `/c/${channelSlug}`
      return NextResponse.rewrite(url)
    }
    return NextResponse.next()
  }

  // Slow path: custom domain (artist.example.com → /c/slug via API lookup)
  const customHost = request.headers.get('x-tahti-custom-host')
  if (customHost && isRewritableRoot) {
    const apiUrl = process.env.API_URL ?? 'http://api:3001'
    try {
      const res = await fetch(
        `${apiUrl}/api/v1/custom-domain/resolve?host=${encodeURIComponent(customHost)}`,
        { cache: 'no-store' },
      )
      if (res.ok) {
        const { slug } = (await res.json()) as { slug: string }
        const url = request.nextUrl.clone()
        url.pathname = `/c/${slug}`
        return NextResponse.rewrite(url)
      }
    } catch {
      // API unreachable — fall through to normal routing
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
