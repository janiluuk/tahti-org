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
// Public channel links must always use https://<slug>.tahti.live — never
// app.tahti.live/c/<slug> or tahti.live/c/<slug> (apex is the marketing site).
// This middleware 308-redirects bare /c/<slug> paths on public hosts to the
// subdomain form so old path links and in-app relative /c/… URLs canonicalize.
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

/** Root domain for artist subdomains (tahti.live / staging.tahti.live). Null on local/dev. */
function artistRootDomain(hostname: string): string | null {
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)
  ) {
    return null
  }
  if (hostname.startsWith('app.')) return hostname.slice('app.'.length)
  if (hostname === 'tahti.live' || hostname === 'www.tahti.live') return 'tahti.live'
  if (hostname === 'staging.tahti.live' || hostname === 'www.staging.tahti.live') {
    return 'staging.tahti.live'
  }
  // <slug>.tahti.live or <slug>.staging.tahti.live
  const parts = hostname.split('.')
  if (parts.length >= 3) return parts.slice(1).join('.')
  return null
}

/** /c/<slug> or /c/<slug>/ — not /c/<slug>/… nested routes and not /embed/c/…. */
function channelPathSlug(pathname: string): string | null {
  const match = pathname.match(/^\/c\/([a-z0-9-]+)\/?$/)
  return match?.[1] ?? null
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const hostname = request.headers.get('host')?.split(':')[0]?.toLowerCase() ?? ''
  const pathSlug = channelPathSlug(pathname)
  const root = artistRootDomain(hostname)

  // Canonicalize public channel URLs to https://<slug>.<root>/…
  if (pathSlug && root) {
    const target = new URL(`https://${pathSlug}.${root}/`)
    target.search = search
    return NextResponse.redirect(target, 308)
  }

  const isRoot = pathname === '/'
  const isExplicitHomeNav = request.nextUrl.searchParams.get('home') === '1'
  const isRewritableRoot = isRoot && !isExplicitHomeNav

  // Fast path: reverse-proxy subdomain routing (slug.tahti.live → /c/slug)
  const channelSlug = request.headers.get('x-tahti-channel-slug')

  // tahti-radio.tahti.live is a legacy address for the same station as
  // radio.tahti.live (the dedicated /radio page below) — 'radio' itself can't
  // be the channel's actual slug since it's reserved (RESERVED_CHANNEL_SLUGS),
  // so fold the old subdomain into the canonical one instead of leaving two
  // live URLs for the same station.
  if (channelSlug === 'tahti-radio' && root) {
    const target = new URL(`https://radio.${root}${pathname}`)
    target.search = search
    return NextResponse.redirect(target, 308)
  }

  // On radio.tahti.live itself, bare "/" already renders /radio via the rewrite
  // below — so a literal "/radio" link (used by every OTHER page/subdomain to
  // reach the station) is redundant and shows up in the address bar as the
  // ugly "radio.tahti.live/radio". Canonicalize it back to the bare root here
  // instead of hunting down every Link that points at "/radio".
  if (channelSlug === 'radio' && (pathname === '/radio' || pathname === '/radio/')) {
    const target = new URL('/', request.url)
    target.search = search
    return NextResponse.redirect(target, 308)
  }

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
