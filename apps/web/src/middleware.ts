// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// PLAT-050: subdomain routing + PLAT-051: custom domain routing.
//
// Caddy sets X-Tahti-Channel-Slug for *.tahti.live hits (labels.0 of the wildcard match).
// Caddy sets X-Tahti-Custom-Host for unknown hosts that have a custom domain configured.
// Both rewrite to /c/[slug] so the channel page renders regardless of entry point.

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Fast path: Caddy subdomain routing (slug.tahti.live → /c/slug)
  const channelSlug = request.headers.get('x-tahti-channel-slug')
  if (channelSlug) {
    const url = request.nextUrl.clone()
    if (!url.pathname.startsWith('/c/')) {
      url.pathname = `/c/${channelSlug}`
      return NextResponse.rewrite(url)
    }
    return NextResponse.next()
  }

  // Slow path: custom domain (artist.example.com → /c/slug via API lookup)
  const customHost = request.headers.get('x-tahti-custom-host')
  if (customHost) {
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
