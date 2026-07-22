'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { WatcherCount } from './WatcherCount'

export type SiteNavId = 'home' | 'discover' | 'radio' | 'venues'

type HeaderContextLink = { href: string; label: string }

type ChannelHeaderProps = {
  /** Live member channel — hides site nav, shows @handle in header centre */
  isLive?: boolean
  artistHandle?: string
  /** Chat/presence listeners — shown beside LIVE pill on member channels */
  listenerCount?: number | null
  /** Smart link / subscribe — back link in header centre (replaces site nav) */
  contextLink?: HeaderContextLink
  /** Highlights the current top-nav item (Discover, Radio, Venues, Home) */
  activeNav?: SiteNavId
  /** LIVE pill on the right without hiding site nav (e.g. Tahti Radio) */
  showLiveBadge?: boolean
  user?: { username: string; displayName: string } | null
}

const SITE_NAV: { id: SiteNavId; href: string; label: string }[] = [
  { id: 'home', href: '/', label: 'Home' },
  { id: 'discover', href: '/listen', label: 'Discover' },
  { id: 'radio', href: '/radio', label: 'Radio' },
  { id: 'venues', href: '/venues', label: 'Venues' },
]

/** This header also renders on wildcard subdomains (radio.tahti.live, an artist's
 * own slug.tahti.live) where middleware.ts rewrites a bare "/" straight back to
 * the current page — a relative Home link there is a dead click, not a no-op by
 * accident. app.tahti.live is never subdomain-rewritten, so resolve Home to that
 * absolute origin always; it's a harmless same-page reload on app.tahti.live itself. */
function resolveHomeHref(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.tahti.live'
  return `${raw.replace(/\/$/, '')}/`
}

/** PLAT-020: sticky channel top bar — TAHTI logo + site nav or live channel context.
 * A single instance of this header, rendered from one shared layout, persists across
 * client-side navigation between the public site-nav routes instead of remounting per
 * page — so `activeNav` is optional and falls back to matching the current pathname,
 * letting one <ChannelHeader> serve every route in that shared layout without each
 * page having to pass its own id down through props it may not even receive. */
export function ChannelHeader({
  isLive,
  artistHandle,
  listenerCount,
  contextLink,
  activeNav,
  showLiveBadge,
  user,
}: ChannelHeaderProps) {
  const pathname = usePathname()
  const resolvedActiveNav = activeNav ?? SITE_NAV.find((item) => item.href === pathname)?.id
  const channelLiveMode = Boolean(isLive && artistHandle && !resolvedActiveNav && !contextLink)
  const homeHref = resolveHomeHref()

  return (
    <header className="ch-header">
      <Link href={homeHref} className="ch-logo">
        <span className="ch-logo__bar" aria-hidden />
        TAHTI
      </Link>
      {channelLiveMode ? (
        <div className="ch-header__artist">@{artistHandle}</div>
      ) : contextLink ? (
        <Link href={contextLink.href} className="ch-header__context">
          {contextLink.label}
        </Link>
      ) : (
        <nav className="ch-header__nav" aria-label="Site">
          {SITE_NAV.map((item) => (
            <Link
              key={item.id}
              href={item.id === 'home' ? homeHref : item.href}
              className={`ch-header__nav-link${resolvedActiveNav === item.id ? ' ch-header__nav-link--active' : ''}`}
              aria-current={resolvedActiveNav === item.id ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
      <div className="ch-header__right">
        {(showLiveBadge || channelLiveMode) && (
          <>
            <div className="ch-live">
              <span className="signal-dot" aria-hidden />
              LIVE
            </div>
            {channelLiveMode && listenerCount != null && listenerCount > 0 && (
              <WatcherCount count={listenerCount} className="ch-header__listeners" />
            )}
          </>
        )}
        {!channelLiveMode &&
          (user ? (
            <Link href="/dashboard" className="ch-header__user">
              <span className="ch-header__user-avatar" aria-hidden>
                {user.displayName.charAt(0).toUpperCase()}
              </span>
              {user.displayName}
            </Link>
          ) : (
            <Link href="/login" className="ch-header__signin">
              Sign in
            </Link>
          ))}
      </div>
    </header>
  )
}

type ChannelPageLayoutProps = {
  isLive?: boolean
  artistHandle?: string
  listenerCount?: number | null
  activeNav?: SiteNavId
  showLiveBadge?: boolean
  user?: { username: string; displayName: string } | null
  main: ReactNode
  sidebar: ReactNode
}

/** PLAT-020: two-column channel layout (main + chat sidebar). */
export function ChannelPageLayout({
  isLive,
  artistHandle,
  listenerCount,
  activeNav,
  showLiveBadge,
  user,
  main,
  sidebar,
}: ChannelPageLayoutProps) {
  return (
    <>
      <ChannelHeader
        isLive={isLive}
        artistHandle={artistHandle}
        listenerCount={listenerCount}
        activeNav={activeNav}
        showLiveBadge={showLiveBadge}
        user={user}
      />
      <div className="ch-body shell-channel">
        <div className="ch-main">{main}</div>
        <aside className="ch-sidebar">{sidebar}</aside>
      </div>
    </>
  )
}
