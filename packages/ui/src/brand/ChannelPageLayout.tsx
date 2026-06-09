// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import type { ReactNode } from 'react'

type ChannelHeaderProps = {
  isLive?: boolean
  artistHandle?: string
  activeNav?: 'discover' | 'radio' | 'venues'
}

/** PLAT-020: sticky channel top bar — TAHTI logo + live indicator. */
export function ChannelHeader({ isLive, artistHandle, activeNav }: ChannelHeaderProps) {
  return (
    <header className="ch-header">
      <Link href="/" className="ch-logo">
        <span className="ch-logo__bar" aria-hidden />
        TAHTI
      </Link>
      {isLive && artistHandle ? (
        <div className="ch-header__artist">@{artistHandle}</div>
      ) : (
        <nav className="ch-header__nav" aria-label="Site">
          <Link
            href="/listen"
            className={`ch-header__nav-link${activeNav === 'discover' ? ' ch-header__nav-link--active' : ''}`}
          >
            Discover
          </Link>
          <Link href="/radio" className="ch-header__nav-link">
            Radio
          </Link>
          <Link href="/venues" className="ch-header__nav-link">
            Venues
          </Link>
        </nav>
      )}
      <div className="ch-header__right">
        {isLive && (
          <div className="ch-live">
            <span className="signal-dot" aria-hidden />
            LIVE
          </div>
        )}
        {!isLive && (
          <Link href="/login" className="ch-header__signin">
            Sign in
          </Link>
        )}
      </div>
    </header>
  )
}

type ChannelPageLayoutProps = {
  isLive?: boolean
  artistHandle?: string
  main: ReactNode
  sidebar: ReactNode
}

/** PLAT-020: two-column channel layout (main + chat sidebar). */
export function ChannelPageLayout({ isLive, artistHandle, main, sidebar }: ChannelPageLayoutProps) {
  return (
    <>
      <ChannelHeader isLive={isLive} artistHandle={artistHandle} />
      <div className="ch-body">
        <div className="ch-main">{main}</div>
        <aside className="ch-sidebar">{sidebar}</aside>
      </div>
    </>
  )
}
