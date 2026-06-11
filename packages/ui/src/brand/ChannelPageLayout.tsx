// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import type { ReactNode } from 'react'

export type SiteNavId = 'home' | 'discover' | 'radio' | 'venues'

type ChannelHeaderProps = {
  /** Live member channel — hides site nav, shows @handle in header centre */
  isLive?: boolean
  artistHandle?: string
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

/** PLAT-020: sticky channel top bar — TAHTI logo + site nav or live channel context. */
export function ChannelHeader({
  isLive,
  artistHandle,
  activeNav,
  showLiveBadge,
  user,
}: ChannelHeaderProps) {
  const channelLiveMode = Boolean(isLive && artistHandle && !activeNav)

  return (
    <header className="ch-header">
      <Link href="/" className="ch-logo">
        <span className="ch-logo__bar" aria-hidden />
        TAHTI
      </Link>
      {channelLiveMode ? (
        <div className="ch-header__artist">@{artistHandle}</div>
      ) : (
        <nav className="ch-header__nav" aria-label="Site">
          {SITE_NAV.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={`ch-header__nav-link${activeNav === item.id ? ' ch-header__nav-link--active' : ''}`}
              aria-current={activeNav === item.id ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
      <div className="ch-header__right">
        {(showLiveBadge || channelLiveMode) && (
          <div className="ch-live">
            <span className="signal-dot" aria-hidden />
            LIVE
          </div>
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
